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
import { compararQtd } from '../../../common/crud/decimal';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { pedidosFornecedor,
  conclusoesConferencia,
  conclusoesConferenciaNfs,
  divergenciasRecebimento,
  notasFiscaisFornecedor,
  notasFiscaisFornecedorItens,
  operacoes,
  recebimentos,
 } from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import type { ConcluirConferenciaDto } from './dto/conferencia.dto';
import { OcorrenciaFornecedorService } from './ocorrencia/ocorrencia-fornecedor.service';

type Ocorrencia = typeof schema.ocorrenciasFornecedor.$inferSelect;

type TipoDivergenciaV11 =
  | 'falta'
  | 'excesso'
  | 'produto_nao_previsto'
  | 'peso_divergente'
  | 'outro';

interface QuadroRow {
  recebimento_item_id: string | null;
  item_comercial_id: string;
  previsto_no_pedido: boolean;
  qtd_pedido: string | null;
  qtd_nf: string;
  qtd_apurada: string;
  peso_nf: string | null;
  peso_apurado: string | null;
}

export interface QuadroItem {
  recebimentoItemId: string | null;
  itemComercialId: string;
  previstoNoPedido: boolean;
  qtdPedido: string | null;
  qtdNf: string;
  qtdApurada: string;
  pesoNf: string | null;
  pesoApurado: string | null;
  situacao: 'conforme' | 'divergente';
}

function classificarSituacao(
  item: Omit<QuadroItem, 'situacao'>,
): 'conforme' | 'divergente' {
  if (!item.previstoNoPedido) return 'divergente';
  if (compararQtd(item.qtdApurada, item.qtdNf) !== 0) return 'divergente';
  if (
    item.pesoNf !== null
    && item.pesoApurado !== null
    && compararQtd(item.pesoNf, item.pesoApurado) !== 0
  ) {
    return 'divergente';
  }
  return 'conforme';
}

export function classificarTipoV11(item: QuadroItem): TipoDivergenciaV11 {
  if (!item.previstoNoPedido) return 'produto_nao_previsto';
  if (compararQtd(item.qtdApurada, item.qtdNf) < 0) return 'falta';
  if (compararQtd(item.qtdApurada, item.qtdNf) > 0) return 'excesso';
  if (
    item.pesoNf !== null
    && item.pesoApurado !== null
    && compararQtd(item.pesoNf, item.pesoApurado) !== 0
  ) {
    return 'peso_divergente';
  }
  return 'outro';
}

function descreverDiferenca(item: QuadroItem): string {
  return [
    `item=${item.itemComercialId}`,
    `qtd_nf=${item.qtdNf}`,
    `qtd_apurada=${item.qtdApurada}`,
    `peso_nf=${item.pesoNf ?? 'n/a'}`,
    `peso_apurado=${item.pesoApurado ?? 'n/a'}`,
  ].join('; ');
}

@Injectable()
export class ConferenciaService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly ocorrencias: OcorrenciaFornecedorService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async calcularQuadro(
    db: NodePgDatabase<typeof schema>,
    recebimentoId: string,
  ): Promise<QuadroItem[]> {
    const resultado = await db.execute(sql`
      WITH nf_itens AS (
        SELECT nf.recebimento_id, nfi.item_comercial_id,
               SUM(nfi.quantidade_declarada) AS qtd_nf,
               SUM(nfi.peso_declarado)
                 FILTER (WHERE nfi.peso_declarado IS NOT NULL) AS peso_nf
        FROM notas_fiscais_fornecedor nf
        JOIN notas_fiscais_fornecedor_itens nfi
          ON nfi.nf_id=nf.id AND nfi.deleted_at IS NULL
        WHERE nf.recebimento_id=${recebimentoId} AND nf.deleted_at IS NULL
        GROUP BY nf.recebimento_id, nfi.item_comercial_id
      ), pecas_apuradas AS (
        SELECT recebimento_id, item_comercial_base_id AS item_comercial_id,
               COUNT(id)::numeric AS qtd_pecas,
               COALESCE(SUM(peso_original), 0) AS peso_apurado
        FROM pecas
        WHERE recebimento_id=${recebimentoId} AND deleted_at IS NULL
        GROUP BY recebimento_id, item_comercial_base_id
      ), item_ids AS (
        SELECT pfi.item_comercial_id
        FROM recebimentos r
        JOIN pedidos_fornecedor_itens pfi
          ON pfi.pedido_fornecedor_id=r.pedido_fornecedor_id AND pfi.deleted_at IS NULL
        WHERE r.id=${recebimentoId}
        UNION
        SELECT item_comercial_id FROM nf_itens
        UNION
        SELECT item_comercial_id
        FROM recebimentos_itens
        WHERE recebimento_id=${recebimentoId}
        UNION
        SELECT item_comercial_id FROM pecas_apuradas
      )
      SELECT ids.item_comercial_id,
             ri.id AS recebimento_item_id,
             pfi.quantidade_prevista AS qtd_pedido,
             COALESCE(nfi.qtd_nf, 0) AS qtd_nf,
             CASE WHEN COALESCE(ri.requer_balanca, false)
                  THEN COALESCE(pa.qtd_pecas, 0)
                  ELSE COALESCE(ri.quantidade_recebida, 0)
             END AS qtd_apurada,
             nfi.peso_nf,
             CASE WHEN COALESCE(ri.requer_balanca, false)
                  THEN COALESCE(pa.peso_apurado, 0)
                  ELSE NULL
             END AS peso_apurado,
             (pfi.id IS NOT NULL) AS previsto_no_pedido
      FROM recebimentos r
      JOIN item_ids ids ON true
      LEFT JOIN pedidos_fornecedor_itens pfi
        ON pfi.pedido_fornecedor_id=r.pedido_fornecedor_id
       AND pfi.item_comercial_id=ids.item_comercial_id
       AND pfi.deleted_at IS NULL
      LEFT JOIN recebimentos_itens ri
        ON ri.recebimento_id=r.id AND ri.item_comercial_id=ids.item_comercial_id
      LEFT JOIN nf_itens nfi
        ON nfi.recebimento_id=r.id AND nfi.item_comercial_id=ids.item_comercial_id
      LEFT JOIN pecas_apuradas pa
        ON pa.recebimento_id=r.id AND pa.item_comercial_id=ids.item_comercial_id
      WHERE r.id=${recebimentoId};
    `);

    return resultado.rows.map((raw: unknown) => {
      const r = raw as unknown as QuadroRow;
      const base = {
        recebimentoItemId: r.recebimento_item_id,
        itemComercialId: r.item_comercial_id,
        previstoNoPedido: Boolean(r.previsto_no_pedido),
        qtdPedido: r.qtd_pedido,
        qtdNf: String(r.qtd_nf ?? '0'),
        qtdApurada: String(r.qtd_apurada ?? '0'),
        pesoNf: r.peso_nf === null || r.peso_nf === undefined ? null : String(r.peso_nf),
        pesoApurado: r.peso_apurado === null || r.peso_apurado === undefined
          ? null
          : String(r.peso_apurado),
      } satisfies Omit<QuadroItem, 'situacao'>;
      return { ...base, situacao: classificarSituacao(base) };
    });
  }

  async concluirPesagem(recebimentoId: string, usuarioId: string) {
    return this.db.transaction(async (tx) => {
      const atual = await tx.select().from(recebimentos)
        .where(and(eq(recebimentos.id, recebimentoId), isNull(recebimentos.deletedAt)))
        .then((r) => r[0] ?? null);
      if (!atual) throw new NotFoundException('Recebimento não encontrado');
      if (atual.status !== 'pesagem_em_andamento') {
        throw new ConflictException('Recebimento não está em pesagem');
      }
      const atualizado = primeiroOuFalha(await tx.update(recebimentos)
        .set({ status: 'aguardando_conferencia_final', updatedAt: new Date() })
        .where(eq(recebimentos.id, recebimentoId))
        .returning());
      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos',
        registroId: recebimentoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: atual,
        dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async concluirConferencia(
    recebimentoId: string,
    dto: ConcluirConferenciaDto,
    usuarioId: string,
  ) {
    const resultado = await this.db.transaction(async (tx) => {
      const atual = await tx.select().from(recebimentos)
        .where(and(eq(recebimentos.id, recebimentoId), isNull(recebimentos.deletedAt)))
        .then((r) => r[0] ?? null);
      if (!atual) throw new NotFoundException('Recebimento não encontrado');

      const nfs = await tx.select().from(notasFiscaisFornecedor)
        .where(and(
          eq(notasFiscaisFornecedor.recebimentoId, recebimentoId),
          isNull(notasFiscaisFornecedor.deletedAt),
        ));
      if (nfs.length === 0) throw new ConflictException('NF do fornecedor obrigatória');

      for (const nf of nfs) {
        const nfItens = await tx.select({ id: notasFiscaisFornecedorItens.id })
          .from(notasFiscaisFornecedorItens)
          .where(and(
            eq(notasFiscaisFornecedorItens.nfId, nf.id),
            isNull(notasFiscaisFornecedorItens.deletedAt),
          ));
        if (nfItens.length === 0) {
          throw new ConflictException({
            code: 'NF_ITENS_OBRIGATORIOS',
            message: 'Carregue os itens da NF antes de concluir a conferência',
          });
        }
      }

      const quadro = await this.calcularQuadro(tx, recebimentoId);
      const temDivergencia = quadro.some((q) => q.situacao === 'divergente');
      if (dto.resultado === 'sem_divergencia' && temDivergencia) {
        throw new ConflictException('Resultado inconsistente com o quadro (há divergências)');
      }
      if (dto.resultado === 'com_divergencia' && !temDivergencia) {
        throw new ConflictException('Resultado inconsistente com o quadro (sem divergências)');
      }

      const [conclusao] = await tx.insert(conclusoesConferencia).values({
        recebimentoId,
        quadroJson: quadro,
        resultado: dto.resultado,
        observacao: dto.observacao,
        concluidaPorId: usuarioId,
        concluidaEm: new Date(),
      }).onConflictDoNothing().returning();
      if (!conclusao) throw new ConflictException('Conferência já concluída');

      await tx.insert(conclusoesConferenciaNfs).values(nfs.map((nf) => ({
        conclusaoId: conclusao.id,
        nfFornecedorId: nf.id,
      })));

      const recebimento = primeiroOuFalha(
        await tx.select({
          fornecedorId: recebimentos.fornecedorId,
          operacaoId: recebimentos.operacaoId,
          compraProgramadaId: pedidosFornecedor.compraProgramadaId,
        })
          .from(recebimentos)
          .innerJoin(pedidosFornecedor, eq(pedidosFornecedor.id, recebimentos.pedidoFornecedorId))
          .where(eq(recebimentos.id, recebimentoId)),
      );

      const ocorrenciasAbertas: Ocorrencia[] = [];
      for (const item of quadro.filter((q) => q.situacao === 'divergente')) {
        const divergencia = primeiroOuFalha(
          await tx.insert(divergenciasRecebimento).values({
            recebimentoId,
            recebimentoItemId: item.recebimentoItemId,
            itemComercialId: item.itemComercialId,
            conclusaoConferenciaId: conclusao.id,
            nfFornecedorId: nfs.length === 1 ? nfs[0]!.id : null,
            tipo: classificarTipoV11(item),
            descricao: descreverDiferenca(item),
            acaoImediata: 'Tratar divergência da conferência com o fornecedor',
            responsavelRegistroId: usuarioId,
          }).returning(),
        );
        const ocorrencia = await this.ocorrencias.abrirNaTx(
          tx,
          {
            fornecedorId: recebimento.fornecedorId,
            divergenciaId: divergencia.id,
            conclusaoConferenciaId: conclusao.id,
            compraProgramadaId: recebimento.compraProgramadaId,
            descricao: `Divergência ${divergencia.tipo}: ${divergencia.descricao}`,
          },
          usuarioId,
        );
        ocorrenciasAbertas.push(ocorrencia);
      }

      const statusFinal = dto.resultado === 'sem_divergencia'
        ? 'conferido_sem_divergencia'
        : 'conferido_com_divergencia';
      await tx.update(recebimentos)
        .set({
          status: statusFinal,
          usuarioConclusaoId: usuarioId,
          dataConclusao: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(recebimentos.id, recebimentoId));

      await this.auditoria.registrar(tx, {
        tabela: 'conclusoes_conferencia',
        registroId: conclusao.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: conclusao,
      });

      const op = await tx.select({ data: operacoes.data })
        .from(operacoes)
        .where(eq(operacoes.id, recebimento.operacaoId))
        .then((r) => r[0] ?? null);
      const dataOperacao = op?.data ?? '';

      return {
        conclusao,
        quadro,
        ocorrenciasAbertas,
        dataOperacao,
        statusAnterior: atual.status,
        statusFinal,
      };
    });

    for (const ocorrencia of resultado.ocorrenciasAbertas) {
      this.ocorrencias.emitirAbertura(ocorrencia, resultado.dataOperacao);
    }
    this.eventEmitter.emit(EVENTOS.CONFERENCIA_TRIPLA_CONCLUIDA, {
      conclusaoId: resultado.conclusao.id,
      recebimentoId,
      resultado: dto.resultado,
    });
    this.eventEmitter.emit(EVENTOS.RECEBIMENTO_ESTADO_ALTERADO, {
      recebimentoId,
      statusAnterior: resultado.statusAnterior,
      statusAtual: resultado.statusFinal,
    });

    return {
      conclusao: resultado.conclusao,
      quadro: resultado.quadro,
      ocorrencias: resultado.ocorrenciasAbertas.length,
    };
  }
}
