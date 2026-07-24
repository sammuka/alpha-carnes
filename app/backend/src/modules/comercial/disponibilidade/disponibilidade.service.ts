import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { disponibilidadesVirtuais, operacoes } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import type { ListarDisponibilidadeQuery } from './dto/disponibilidade.dto';

type DisponibilidadeVirtual = typeof disponibilidadesVirtuais.$inferSelect;
type CompraProgramada = typeof schema.comprasProgramadas.$inferSelect;
type Tx = NodePgDatabase<typeof schema>;

export interface DisponibilidadeGerada {
  id: string;
  itemComercialId: string;
  quantidadeTotalGerada: string;
}

export interface ItemEsperado {
  disponibilidadeId: string;
  itemComercialId: string;
  quantidadeTotalGerada: string;
}

export interface PedidoEmRisco {
  pedidoId: string;
  itemComercialId: string;
  quantidadeReservada: string;
  quantidadeRecebida: string;
}

@Injectable()
export class DisponibilidadeService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /**
   * Gera a disponibilidade virtual de uma compra confirmada, DENTRO da transação
   * de confirmação. Para cada item comercial: total = Σ (fator × quantidade_comprada)
   * das regras de desdobramento ativas e vigentes na data da operação.
   *
   * Cálculo feito em SQL com NUMERIC nativo (sem drift de float — S4).
   * Idempotente: ON CONFLICT DO NOTHING na unique (compra, item) — confirmar 2×
   * (caminho que chega aqui só uma vez por S5) nunca duplica saldo.
   */
  async gerarParaCompra(tx: Tx, compra: CompraProgramada): Promise<DisponibilidadeGerada[]> {
    const inseridas = await tx.execute<{
      id: string;
      item_comercial_id: string;
      quantidade_total_gerada: string;
    }>(sql`
      INSERT INTO disponibilidades_virtuais
        (compra_programada_id, operacao_id, item_comercial_id,
         quantidade_total_gerada, quantidade_reservada, quantidade_disponivel, status)
      SELECT
        ${compra.id},
        ${compra.operacaoId},
        r.item_comercial_id,
        SUM(r.fator_quantidade * cpi.quantidade_comprada),
        0,
        SUM(r.fator_quantidade * cpi.quantidade_comprada),
        'gerada'
      FROM compras_programadas_itens cpi
      JOIN regras_desdobramento_comercial r
        ON r.item_compra_id = cpi.item_compra_id
       AND r.deleted_at IS NULL
       AND r.status = 'ativo'
       AND r.vigencia_inicio <= now()
       AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
      WHERE cpi.compra_programada_id = ${compra.id}
        AND cpi.deleted_at IS NULL
      GROUP BY r.item_comercial_id
      ON CONFLICT (compra_programada_id, item_comercial_id) DO NOTHING
      RETURNING id, item_comercial_id, quantidade_total_gerada
    `);

    const linhas = inseridas.rows.map((r) => ({
      id: r.id,
      itemComercialId: r.item_comercial_id,
      quantidadeTotalGerada: r.quantidade_total_gerada,
    }));

    for (const linha of linhas) {
      await this.auditoria.registrar(tx, {
        tabela: 'disponibilidades_virtuais',
        registroId: linha.id,
        operacao: 'INSERT',
        modulo: 'comercial',
        usuarioId: compra.usuarioConfirmacaoId,
        dadosAnteriores: {},
        dadosNovos: linha,
      });
    }

    return linhas;
  }

  /**
   * Itens esperados do recebimento, derivados da disponibilidade do dia (F4a,
   * Refino 1): a disponibilidade é a fonte de verdade imutável do que a compra
   * comprometeu — não recomputamos o desdobramento (evita drift se a regra mudar).
   */
  async listarEsperadoDaCompra(tx: Tx, compraProgramadaId: string): Promise<ItemEsperado[]> {
    const linhas = await tx
      .select({
        disponibilidadeId: disponibilidadesVirtuais.id,
        itemComercialId: disponibilidadesVirtuais.itemComercialId,
        quantidadeTotalGerada: disponibilidadesVirtuais.quantidadeTotalGerada,
      })
      .from(disponibilidadesVirtuais)
      .where(eq(disponibilidadesVirtuais.compraProgramadaId, compraProgramadaId));
    return linhas;
  }

  /**
   * Aplica o impacto físico do recebimento (F4a) à disponibilidade do dia, na
   * MESMA transação. Soma os deltas (novo − anterior) em quantidade_recebida e
   * quantidade_com_divergencia. NÃO mexe em reservada/disponível (recebimento
   * registra fato físico, não rebalanceia o saldo virtual). CHECK >= 0 é backstop.
   * Retorna null se não houver disponibilidade (item excedente não tem linha).
   */
  async aplicarRecebimentoDelta(
    tx: Tx,
    params: { compraProgramadaId: string; itemComercialId: string; deltaRecebido: string; deltaComDivergencia: string },
    usuarioId?: string | null,
  ): Promise<{ quantidadeRecebida: string; quantidadeComDivergencia: string } | null> {
    const atualizada = await tx.execute<{
      id: string;
      quantidade_recebida: string;
      quantidade_com_divergencia: string;
    }>(sql`
      UPDATE disponibilidades_virtuais
      SET quantidade_recebida = quantidade_recebida + ${params.deltaRecebido}::numeric,
          quantidade_com_divergencia = quantidade_com_divergencia + ${params.deltaComDivergencia}::numeric
      WHERE compra_programada_id = ${params.compraProgramadaId}
        AND item_comercial_id = ${params.itemComercialId}
      RETURNING id, quantidade_recebida, quantidade_com_divergencia
    `);
    const linha = atualizada.rows[0];
    if (!linha) return null; // item excedente: sem disponibilidade — não falha.

    await this.auditoria.registrar(tx, {
      tabela: 'disponibilidades_virtuais',
      registroId: linha.id,
      operacao: 'UPDATE',
      modulo: 'operacao',
      usuarioId,
      dadosAnteriores: {},
      dadosNovos: {
        quantidadeRecebida: linha.quantidade_recebida,
        quantidadeComDivergencia: linha.quantidade_com_divergencia,
      },
    });

    return {
      quantidadeRecebida: linha.quantidade_recebida,
      quantidadeComDivergencia: linha.quantidade_com_divergencia,
    };
  }

  /**
   * Lista pedidos em risco para um item (RA-05/RA-06). O gatilho é no NÍVEL DO
   * ITEM: quando a soma das reservas ativas de TODOS os pedidos supera o recebido
   * do item (déficit coletivo), lista cada pedido com reserva ativa — nenhum
   * pedido individual precisa exceder o recebido. Ex.: 2 pedidos × 6, recebido 10
   * → Σ=12 > 10, ambos entram. Nunca silencioso.
   */
  async listarPedidosEmRisco(tx: Tx, compraProgramadaId: string, itemComercialId: string): Promise<PedidoEmRisco[]> {
    const linhas = await tx.execute<{
      pedido_id: string;
      item_comercial_id: string;
      quantidade_reservada: string;
      quantidade_recebida: string;
    }>(sql`
      WITH disp AS (
        SELECT id, item_comercial_id, quantidade_recebida
        FROM disponibilidades_virtuais
        WHERE compra_programada_id = ${compraProgramadaId}
          AND item_comercial_id = ${itemComercialId}
      ),
      reservas_ativas AS (
        SELECT pvi.pedido_venda_id AS pedido_id,
               SUM(r.quantidade_reservada) AS quantidade_reservada
        FROM reservas_disponibilidade r
        JOIN disp ON disp.id = r.disponibilidade_virtual_id
        JOIN pedidos_venda_itens pvi ON pvi.id = r.pedido_venda_item_id
        JOIN pedidos_venda pv ON pv.id = pvi.pedido_venda_id AND pv.deleted_at IS NULL
        WHERE r.status = 'ativa'
        GROUP BY pvi.pedido_venda_id
      ),
      total AS (
        SELECT COALESCE(SUM(quantidade_reservada), 0) AS reservado_item
        FROM reservas_ativas
      )
      SELECT reservas_ativas.pedido_id,
             ${itemComercialId} AS item_comercial_id,
             reservas_ativas.quantidade_reservada,
             (SELECT quantidade_recebida FROM disp) AS quantidade_recebida
      FROM reservas_ativas
      -- Déficit coletivo: Σ reservas do item > recebido → todos os pedidos em risco.
      WHERE (SELECT reservado_item FROM total) > (SELECT quantidade_recebida FROM disp)
      ORDER BY reservas_ativas.pedido_id
    `);
    return linhas.rows.map((r) => ({
      pedidoId: r.pedido_id,
      itemComercialId: r.item_comercial_id,
      quantidadeReservada: r.quantidade_reservada,
      quantidadeRecebida: r.quantidade_recebida,
    }));
  }

  async listar(query: ListarDisponibilidadeQuery): Promise<DisponibilidadeVirtual[]> {
    if (query.dataOperacao) {
      const filtros = [eq(operacoes.data, query.dataOperacao)];
      if (query.compraProgramadaId) {
        filtros.push(eq(disponibilidadesVirtuais.compraProgramadaId, query.compraProgramadaId));
      }
      return this.db
        .select({
          id: disponibilidadesVirtuais.id,
          compraProgramadaId: disponibilidadesVirtuais.compraProgramadaId,
          operacaoId: disponibilidadesVirtuais.operacaoId,
          itemComercialId: disponibilidadesVirtuais.itemComercialId,
          quantidadeTotalGerada: disponibilidadesVirtuais.quantidadeTotalGerada,
          quantidadeReservada: disponibilidadesVirtuais.quantidadeReservada,
          quantidadeDisponivel: disponibilidadesVirtuais.quantidadeDisponivel,
          quantidadeRecebida: disponibilidadesVirtuais.quantidadeRecebida,
          quantidadeComDivergencia: disponibilidadesVirtuais.quantidadeComDivergencia,
          status: disponibilidadesVirtuais.status,
          createdAt: disponibilidadesVirtuais.createdAt,
          updatedAt: disponibilidadesVirtuais.updatedAt,
        })
        .from(disponibilidadesVirtuais)
        .innerJoin(operacoes, eq(operacoes.id, disponibilidadesVirtuais.operacaoId))
        .where(and(...filtros))
        .orderBy(disponibilidadesVirtuais.itemComercialId);
    }

    const where = query.compraProgramadaId
      ? eq(disponibilidadesVirtuais.compraProgramadaId, query.compraProgramadaId)
      : undefined;
    return this.db.select().from(disponibilidadesVirtuais).where(where).orderBy(disponibilidadesVirtuais.itemComercialId);
  }
}
