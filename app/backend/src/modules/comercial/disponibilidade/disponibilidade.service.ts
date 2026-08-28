import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { disponibilidadesVirtuais, operacoes } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  compararQtd,
  formatarQtd,
  subtrairQtd,
} from '../../../common/crud/decimal';
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

export interface ItemImpacto {
  itemComercialId: string;
  codigo: string;
  descricao: string;
  quantidadeGeradaAtual: string;
  quantidadeGeradaProjetada: string;
  delta: string;
  quantidadeReservada: string;
  saldoAtual: string;
  saldoProjetado: string;
  deficitProjetado: string;
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
  async listarPedidosEmRisco(tx: Tx, operacaoId: string, itemComercialId: string): Promise<PedidoEmRisco[]> {
    const linhas = await tx.execute<{
      pedido_id: string;
      item_comercial_id: string;
      quantidade_reservada: string;
      quantidade_recebida: string;
    }>(sql`
      WITH disp AS (
        SELECT id, item_comercial_id, quantidade_recebida
        FROM disponibilidades_virtuais
        WHERE operacao_id = ${operacaoId}
          AND item_comercial_id = ${itemComercialId}
      ),
      reservas_ativas AS (
        SELECT pvi.pedido_venda_id AS pedido_id,
               SUM(r.quantidade_reservada) AS quantidade_reservada
        FROM reservas_disponibilidade r
        JOIN pedidos_venda_itens pvi ON pvi.id = r.pedido_venda_item_id
          AND pvi.item_comercial_id = ${itemComercialId}
        JOIN pedidos_venda pv ON pv.id = pvi.pedido_venda_id AND pv.deleted_at IS NULL
          AND pv.operacao_id = ${operacaoId}
        WHERE r.status = 'ativa'
        GROUP BY pvi.pedido_venda_id
      ),
      total AS (
        SELECT COALESCE(SUM(quantidade_reservada), 0) AS reservado_item
        FROM reservas_ativas
      ),
      total_recebido AS (
        SELECT COALESCE(SUM(quantidade_recebida), 0) AS recebido
        FROM disp
      )
      SELECT reservas_ativas.pedido_id,
             ${itemComercialId} AS item_comercial_id,
             reservas_ativas.quantidade_reservada,
             (SELECT recebido FROM total_recebido) AS quantidade_recebida
      FROM reservas_ativas
      WHERE (SELECT reservado_item FROM total) > (SELECT recebido FROM total_recebido)
      ORDER BY reservas_ativas.pedido_id
    `);
    return linhas.rows.map((r) => ({
      pedidoId: r.pedido_id,
      itemComercialId: r.item_comercial_id,
      quantidadeReservada: r.quantidade_reservada,
      quantidadeRecebida: r.quantidade_recebida,
    }));
  }

  /**
   * Projeta, sem persistir, o efeito de novas quantidades compradas sobre a
   * disponibilidade virtual da compra. Todo cálculo em NUMERIC no banco (S4).
   * `simulacao` mapeia item_compra_id -> nova quantidade comprada.
   */
  async projetarImpacto(
    tx: Tx,
    compraId: string,
    simulacao: Map<string, string>,
  ): Promise<ItemImpacto[]> {
    const overrides = [...simulacao.entries()];
    const overrideSql = overrides.length
      ? sql`(VALUES ${sql.join(
        overrides.map(([itemCompraId, qtd]) => sql`(${itemCompraId}::uuid, ${qtd}::numeric)`),
        sql`, `,
      )}) AS o(item_compra_id, quantidade)`
      : sql`(SELECT NULL::uuid AS item_compra_id, NULL::numeric AS quantidade WHERE false) AS o`;

    const linhas = await tx.execute<{
      item_comercial_id: string; codigo: string; descricao: string;
      gerada_atual: string; gerada_projetada: string;
      reservada: string; saldo_atual: string;
    }>(sql`
    WITH projecao AS (
      SELECT r.item_comercial_id,
             SUM(r.fator_quantidade * COALESCE(o.quantidade, cpi.quantidade_comprada)) AS gerada_projetada
      FROM compras_programadas_itens cpi
      JOIN regras_desdobramento_comercial r
        ON r.item_compra_id = cpi.item_compra_id
       AND r.deleted_at IS NULL AND r.status = 'ativo'
       AND r.vigencia_inicio <= now()
       AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
      LEFT JOIN ${overrideSql} ON o.item_compra_id = cpi.item_compra_id
      WHERE cpi.compra_programada_id = ${compraId} AND cpi.deleted_at IS NULL
      GROUP BY r.item_comercial_id
    )
    SELECT p.item_comercial_id,
           ic.codigo, ic.descricao,
           COALESCE(dv.quantidade_total_gerada, 0)::text AS gerada_atual,
           p.gerada_projetada::text                      AS gerada_projetada,
           COALESCE(dv.quantidade_reservada, 0)::text    AS reservada,
           COALESCE(dv.quantidade_disponivel, 0)::text   AS saldo_atual
    FROM projecao p
    JOIN itens_comerciais ic ON ic.id = p.item_comercial_id
    LEFT JOIN disponibilidades_virtuais dv
      ON dv.compra_programada_id = ${compraId} AND dv.item_comercial_id = p.item_comercial_id
    ORDER BY ic.codigo
  `);

    return linhas.rows.map((l) => {
      const projetada = formatarQtd(l.gerada_projetada);
      const atual = formatarQtd(l.gerada_atual);
      const reservada = formatarQtd(l.reservada);
      const saldoProjetado = compararQtd(projetada, reservada) > 0
        ? subtrairQtd(projetada, reservada) : '0.000';
      const deficitProjetado = compararQtd(reservada, projetada) > 0
        ? subtrairQtd(reservada, projetada) : '0.000';
      return {
        itemComercialId: l.item_comercial_id,
        codigo: l.codigo,
        descricao: l.descricao,
        quantidadeGeradaAtual: atual,
        quantidadeGeradaProjetada: projetada,
        delta: subtrairQtd(projetada, atual),
        quantidadeReservada: reservada,
        saldoAtual: formatarQtd(l.saldo_atual),
        saldoProjetado,
        deficitProjetado,
      };
    });
  }

  /**
   * Aplica na disponibilidade virtual as quantidades já persistidas na compra.
   * Clampa o saldo em zero (o excedente reservado vira déficit visível — D5.12) e
   * deriva o status (D5.13). Sempre dentro da transação da alteração.
   */
  async recalcularParaCompra(
    tx: Tx,
    compra: CompraProgramada,
    usuarioId: string,
  ): Promise<void> {
    const anteriores = await tx.select().from(disponibilidadesVirtuais)
      .where(eq(disponibilidadesVirtuais.compraProgramadaId, compra.id));

    const atualizadas = await tx.execute<{
      id: string; item_comercial_id: string;
      quantidade_total_gerada: string; quantidade_reservada: string;
      quantidade_disponivel: string; status: string;
    }>(sql`
    WITH projecao AS (
      SELECT r.item_comercial_id,
             SUM(r.fator_quantidade * cpi.quantidade_comprada) AS gerada
      FROM compras_programadas_itens cpi
      JOIN regras_desdobramento_comercial r
        ON r.item_compra_id = cpi.item_compra_id
       AND r.deleted_at IS NULL AND r.status = 'ativo'
       AND r.vigencia_inicio <= now()
       AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
      WHERE cpi.compra_programada_id = ${compra.id} AND cpi.deleted_at IS NULL
      GROUP BY r.item_comercial_id
    )
    UPDATE disponibilidades_virtuais dv
       SET quantidade_total_gerada = p.gerada,
           quantidade_disponivel   = GREATEST(0, p.gerada - dv.quantidade_reservada),
           status = CASE
             WHEN dv.quantidade_reservada = 0 THEN 'gerada'
             WHEN GREATEST(0, p.gerada - dv.quantidade_reservada) = 0 THEN 'esgotada'
             ELSE 'parcialmente_reservada'
           END
      FROM projecao p
     WHERE dv.compra_programada_id = ${compra.id}
       AND dv.item_comercial_id = p.item_comercial_id
    RETURNING dv.id, dv.item_comercial_id, dv.quantidade_total_gerada,
              dv.quantidade_reservada, dv.quantidade_disponivel, dv.status
  `);

    for (const linha of atualizadas.rows) {
      const anterior = anteriores.find((a) => a.id === linha.id) ?? null;
      await this.auditoria.registrar(tx, {
        tabela: 'disponibilidades_virtuais',
        registroId: linha.id,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: anterior ?? {},
        dadosNovos: linha,
      });
    }
  }

  async listar(query: ListarDisponibilidadeQuery) {
    if (query.compraProgramadaId) {
      return this.listarPorCompra({
        dataOperacao: query.dataOperacao,
        compraProgramadaId: query.compraProgramadaId,
      });
    }
    return this.listarAgregado(query);
  }

  private async listarPorCompra(query: { dataOperacao?: string; compraProgramadaId: string }) {
    if (query.dataOperacao) {
      return this.db
        .select({
          modo: sql<'compra'>`'compra'`,
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
        .where(and(
          eq(operacoes.data, query.dataOperacao),
          eq(disponibilidadesVirtuais.compraProgramadaId, query.compraProgramadaId),
        ))
        .orderBy(disponibilidadesVirtuais.itemComercialId);
    }
    return this.db
      .select({
        modo: sql<'compra'>`'compra'`,
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
      .where(eq(disponibilidadesVirtuais.compraProgramadaId, query.compraProgramadaId))
      .orderBy(disponibilidadesVirtuais.itemComercialId);
  }

  private listarAgregado(query: { operacaoId?: string; dataOperacao?: string }) {
    return this.db
      .select({
        modo: sql<'agregado'>`'agregado'`,
        operacaoId: disponibilidadesVirtuais.operacaoId,
        itemComercialId: disponibilidadesVirtuais.itemComercialId,
        quantidadeTotalGerada: sql<string>`sum(${disponibilidadesVirtuais.quantidadeTotalGerada})`,
        quantidadeReservada: sql<string>`sum(${disponibilidadesVirtuais.quantidadeReservada})`,
        quantidadeDisponivel: sql<string>`sum(${disponibilidadesVirtuais.quantidadeDisponivel})`,
        quantidadeRecebida: sql<string>`sum(${disponibilidadesVirtuais.quantidadeRecebida})`,
        quantidadeComDivergencia: sql<string>`sum(${disponibilidadesVirtuais.quantidadeComDivergencia})`,
        status: sql<string>`CASE
          WHEN sum(${disponibilidadesVirtuais.quantidadeDisponivel}) = 0 THEN 'esgotada'
          WHEN sum(${disponibilidadesVirtuais.quantidadeReservada}) > 0 THEN 'parcialmente_reservada'
          ELSE 'gerada' END`,
      })
      .from(disponibilidadesVirtuais)
      .innerJoin(operacoes, eq(operacoes.id, disponibilidadesVirtuais.operacaoId))
      .where(and(
        query.operacaoId ? eq(disponibilidadesVirtuais.operacaoId, query.operacaoId) : undefined,
        query.dataOperacao ? eq(operacoes.data, query.dataOperacao) : undefined,
      ))
      .groupBy(disponibilidadesVirtuais.operacaoId, disponibilidadesVirtuais.itemComercialId)
      .orderBy(disponibilidadesVirtuais.itemComercialId);
  }
}
