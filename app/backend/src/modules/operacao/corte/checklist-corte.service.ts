import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  divergenciasTransformacao,
  operacoes,
  pecas,
  produtos,
  recebimentos,
  regrasTransformacao,
  regrasTransformacaoSaidas,
  subitens,
  transformacoes,
} from '../../../database/schema';
import { AprovacoesService } from '../../gestao/aprovacoes/aprovacoes.service';
import { EVENTOS } from '../../../realtime/events/eventos';
import type { AbrirDivergenciaTransformacaoDto } from './dto/divergencia-transformacao.dto';

type Tx = NodePgDatabase<typeof schema>;

export type ChecklistSlot = {
  produtoId: string;
  produtoCodigo: string;
  produtoNome: string;
  esperado: number;
  registrado: number;
  status: 'pendente' | 'parcial' | 'completo' | 'excedente';
};

export type ChecklistResponse = {
  transformacaoId: string;
  regraTransformacaoId: string | null;
  regraNome: string | null;
  regraProvisoria: boolean;
  slots: ChecklistSlot[];
  divergente: boolean;
  divergenciaAbertaId: string | null;
};

@Injectable()
export class ChecklistCorteService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly aprovacoes: AprovacoesService,
    private readonly auditoria: AuditoriaService,
    private readonly events: EventEmitter2,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async obter(transformacaoId: string): Promise<ChecklistResponse> {
    return this.db.transaction((tx) => this.obterNaTx(tx, transformacaoId));
  }

  async obterNaTx(tx: Tx, transformacaoId: string): Promise<ChecklistResponse> {
    const [transf] = await tx
      .select()
      .from(transformacoes)
      .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)));
    if (!transf) throw new NotFoundException('Transformação não encontrada');

    let regraNome: string | null = null;
    let regraProvisoria = false;
    const slots: ChecklistSlot[] = [];

    if (transf.regraTransformacaoId) {
      const [regra] = await tx
        .select()
        .from(regrasTransformacao)
        .where(eq(regrasTransformacao.id, transf.regraTransformacaoId));
      regraNome = regra?.nome ?? null;
      regraProvisoria = regra?.provisorio ?? false;

      const saidas = await tx
        .select({
          produtoId: produtos.id,
          produtoCodigo: produtos.codigo,
          produtoNome: produtos.nome,
          esperado: regrasTransformacaoSaidas.quantidadeFixa,
          legado: produtos.legadoItemComercialId,
        })
        .from(regrasTransformacaoSaidas)
        .innerJoin(produtos, eq(produtos.id, regrasTransformacaoSaidas.produtoId))
        .where(eq(regrasTransformacaoSaidas.regraId, transf.regraTransformacaoId));

      const ativos = await tx
        .select({
          itemComercialId: subitens.itemComercialId,
        })
        .from(subitens)
        .where(and(eq(subitens.transformacaoId, transformacaoId), isNull(subitens.deletedAt)));

      const contagem = new Map<string, number>();
      for (const s of ativos) {
        contagem.set(s.itemComercialId, (contagem.get(s.itemComercialId) ?? 0) + 1);
      }

      for (const s of saidas) {
        const esperado = Number.parseInt(String(s.esperado), 10) || 0;
        const registrado = s.legado ? (contagem.get(s.legado) ?? 0) : 0;
        let status: ChecklistSlot['status'] = 'pendente';
        if (registrado === 0) status = 'pendente';
        else if (registrado < esperado) status = 'parcial';
        else if (registrado === esperado) status = 'completo';
        else status = 'excedente';
        slots.push({
          produtoId: s.produtoId,
          produtoCodigo: s.produtoCodigo,
          produtoNome: s.produtoNome,
          esperado,
          registrado,
          status,
        });
      }
    }

    const [divAberta] = await tx
      .select({ id: divergenciasTransformacao.id })
      .from(divergenciasTransformacao)
      .where(
        and(
          eq(divergenciasTransformacao.transformacaoId, transformacaoId),
          isNull(divergenciasTransformacao.deletedAt),
        ),
      )
      .limit(1);

    const divergente = slots.some((s) => s.status !== 'completo');
    return {
      transformacaoId,
      regraTransformacaoId: transf.regraTransformacaoId,
      regraNome,
      regraProvisoria,
      slots,
      divergente,
      divergenciaAbertaId: divAberta?.id ?? null,
    };
  }

  async abrirDivergencia(
    transformacaoId: string,
    dto: AbrirDivergenciaTransformacaoDto,
    operadorId: string,
  ) {
    const { divergencia, aprovacao, dataOperacao } = await this.db.transaction(async (tx) => {
      const [transf] = await tx
        .select()
        .from(transformacoes)
        .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)))
        .for('update');
      if (!transf) throw new NotFoundException('Transformação não encontrada');
      if (['concluida', 'cancelada'].includes(transf.statusTransformacao)) {
        throw new ConflictException({
          codigo: 'TRANSFORMACAO_FECHADA',
          mensagem: 'Transformação fechada não aceita divergência',
        });
      }

      const [ctx] = await tx
        .select({
          operacaoId: recebimentos.operacaoId,
          dataOperacao: operacoes.data,
          etiqueta: pecas.etiquetaAtual,
        })
        .from(pecas)
        .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
        .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
        .where(eq(pecas.id, transf.pecaOrigemId))
        .limit(1);
      if (!ctx?.operacaoId) {
        throw new NotFoundException('Operação da transformação não encontrada');
      }

      const [divergencia] = await tx
        .insert(divergenciasTransformacao)
        .values({
          transformacaoId,
          tipo: dto.tipo,
          detalheJson: {
            ...dto.detalhe,
            observacao: dto.observacao ?? null,
          },
          abertoPorId: operadorId,
        })
        .returning();
      if (!divergencia) throw new Error('Falha ao abrir divergência de transformação');

      const descricao =
        `Divergência de transformação (${dto.tipo}) na peça ` +
        `${ctx.etiqueta ?? transf.pecaOrigemId}: checklist esperado×registrado não fecha. ` +
        (dto.observacao ? dto.observacao : 'Sem observação adicional do operador.');
      const impacto =
        'Conclusão da desossa fica condicionada à aprovação gestora; ' +
        'pedidos/cargas que dependem das saídas podem ficar sem cobertura.';

      const aprovacao = await this.aprovacoes.abrirNaTx(
        tx,
        {
          operacaoId: ctx.operacaoId,
          tipo: 'divergencia_transformacao',
          origem: 'desossa',
          descricao,
          impacto,
          referenciaTabela: 'divergencias_transformacao',
          referenciaId: divergencia.id,
        },
        operadorId,
      );

      const [comAprovacao] = await tx
        .update(divergenciasTransformacao)
        .set({ aprovacaoId: aprovacao.id, updatedAt: new Date() })
        .where(eq(divergenciasTransformacao.id, divergencia.id))
        .returning();

      await this.auditoria.registrar(tx, {
        tabela: 'divergencias_transformacao',
        registroId: divergencia.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: comAprovacao,
      });

      return {
        divergencia: comAprovacao,
        aprovacao,
        dataOperacao: ctx.dataOperacao,
      };
    });

    if (!divergencia) throw new Error('Divergência sem retorno após commit');
    this.events.emit(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA, {
      dataOperacao,
      transformacaoId,
      divergenciaId: divergencia.id,
      aprovacaoId: aprovacao.id,
      tipo: dto.tipo,
    });
    this.events.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
      dataOperacao,
      motivo: 'divergencia_transformacao_aberta',
    });

    return divergencia;
  }
}
