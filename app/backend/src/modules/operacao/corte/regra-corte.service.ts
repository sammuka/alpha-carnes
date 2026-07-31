import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  operacoes,
  pecas,
  recebimentos,
  regrasTransformacao,
  subitens,
  transformacoes,
} from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import type { VincularRegraDto } from './dto/regra-corte.dto';

type Tx = NodePgDatabase<typeof schema>;

@Injectable()
export class RegraCorteService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly events: EventEmitter2,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async vincular(transformacaoId: string, dto: VincularRegraDto, operadorId: string) {
    const row = await this.db.transaction(async (tx) => {
      const [transf] = await tx
        .select()
        .from(transformacoes)
        .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)))
        .for('update');
      if (!transf) throw new NotFoundException('Transformação não encontrada');
      if (['concluida', 'cancelada'].includes(transf.statusTransformacao)) {
        throw new ConflictException({
          codigo: 'TRANSFORMACAO_FECHADA',
          mensagem: 'Transformação fechada não aceita vínculo de regra',
        });
      }
      const [regra] = await tx
        .select()
        .from(regrasTransformacao)
        .where(
          and(
            eq(regrasTransformacao.id, dto.regraTransformacaoId),
            eq(regrasTransformacao.status, 'ativo'),
            isNull(regrasTransformacao.deletedAt),
          ),
        );
      if (!regra) throw new NotFoundException('Regra não encontrada');
      if (regra.produtoOrigemCodigo !== 'TZ') {
        throw new ConflictException({
          codigo: 'REGRA_ORIGEM_NAO_SUPORTADA_MVP',
          mensagem: 'Somente regras com origem TZ são aceitas nesta versão',
        });
      }
      const contagem = await tx
        .select({ c: sql<number>`count(*)::int` })
        .from(subitens)
        .where(and(eq(subitens.transformacaoId, transformacaoId), isNull(subitens.deletedAt)));
      const c = contagem[0]?.c ?? 0;
      if (
        c > 0 &&
        transf.regraTransformacaoId &&
        transf.regraTransformacaoId !== dto.regraTransformacaoId
      ) {
        throw new ConflictException({
          codigo: 'REGRA_BLOQUEADA_APOS_SAIDA',
          mensagem: 'A regra não pode ser alterada após registrar a primeira saída',
        });
      }
      const [upd] = await tx
        .update(transformacoes)
        .set({ regraTransformacaoId: dto.regraTransformacaoId, updatedAt: new Date() })
        .where(eq(transformacoes.id, transformacaoId))
        .returning();
      await this.auditoria.registrar(tx, {
        tabela: 'transformacoes',
        registroId: transformacaoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: transf,
        dadosNovos: upd,
      });
      const dataOperacao = await this.dataOperacaoPorPeca(tx, transf.pecaOrigemId);
      return { upd, dataOperacao };
    });
    this.events.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
      dataOperacao: row.dataOperacao,
      motivo: 'regra_vinculada',
    });
    return row.upd;
  }

  private async dataOperacaoPorPeca(tx: Tx, pecaId: string): Promise<string> {
    const [r] = await tx
      .select({ data: operacoes.data })
      .from(pecas)
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(eq(pecas.id, pecaId))
      .limit(1);
    return r?.data ?? '';
  }
}
