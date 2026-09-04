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

type CompraProgramada = typeof schema.comprasProgramadas.$inferSelect;
type Tx = NodePgDatabase<typeof schema>;

export interface DisponibilidadeGerada {
  id: string;
  produtoId: string;
  quantidadeTotalGerada: string;
}

export interface ItemEsperado {
  disponibilidadeId: string;
  produtoId: string;
  quantidadeTotalGerada: string;
}

export interface PedidoEmRisco {
  pedidoId: string;
  produtoId: string;
  quantidadeReservada: string;
  quantidadeRecebida: string;
}

export interface ItemImpacto {
  produtoId: string;
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

  async gerarParaCompra(tx: Tx, compra: CompraProgramada): Promise<DisponibilidadeGerada[]> {
    const inseridas = await tx.execute<{
      id: string;
      produto_id: string;
      quantidade_total_gerada: string;
    }>(sql`
      INSERT INTO disponibilidades_virtuais
        (compra_programada_id, operacao_id, produto_id,
         quantidade_total_gerada, quantidade_reservada, quantidade_disponivel, status)
      SELECT
        ${compra.id},
        ${compra.operacaoId},
        x.produto_id,
        SUM(x.quantidade),
        0,
        SUM(x.quantidade),
        'gerada'
      FROM (
        SELECT r.produto_destino_id AS produto_id,
               (r.fator_quantidade * cpi.quantidade_comprada) AS quantidade
        FROM compras_programadas_itens cpi
        JOIN regras_desdobramento_comercial r
          ON r.produto_origem_id = cpi.produto_id
         AND r.deleted_at IS NULL
         AND r.status = 'ativo'
         AND r.vigencia_inicio <= now()
         AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
        WHERE cpi.compra_programada_id = ${compra.id}
          AND cpi.deleted_at IS NULL
        UNION ALL
        SELECT cpi.produto_id AS produto_id,
               cpi.quantidade_comprada AS quantidade
        FROM compras_programadas_itens cpi
        JOIN produtos p ON p.id = cpi.produto_id
         AND p.deleted_at IS NULL
         AND p.ativo_venda = true
         AND p.ativo_compra = true
        WHERE cpi.compra_programada_id = ${compra.id}
          AND cpi.deleted_at IS NULL
      ) x
      GROUP BY x.produto_id
      ON CONFLICT (compra_programada_id, produto_id) DO NOTHING
      RETURNING id, produto_id, quantidade_total_gerada
    `);

    const linhas = inseridas.rows.map((r) => ({
      id: r.id,
      produtoId: r.produto_id,
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

  async listarEsperadoDaCompra(tx: Tx, compraProgramadaId: string): Promise<ItemEsperado[]> {
    const linhas = await tx
      .select({
        disponibilidadeId: disponibilidadesVirtuais.id,
        produtoId: disponibilidadesVirtuais.produtoId,
        quantidadeTotalGerada: disponibilidadesVirtuais.quantidadeTotalGerada,
      })
      .from(disponibilidadesVirtuais)
      .where(eq(disponibilidadesVirtuais.compraProgramadaId, compraProgramadaId));
    return linhas;
  }

  async aplicarRecebimentoDelta(
    tx: Tx,
    params: { compraProgramadaId: string; produtoId: string; deltaRecebido: string; deltaComDivergencia: string },
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
        AND produto_id = ${params.produtoId}
      RETURNING id, quantidade_recebida, quantidade_com_divergencia
    `);
    const linha = atualizada.rows[0];
    if (!linha) return null;

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

  async listarPedidosEmRisco(tx: Tx, operacaoId: string, produtoId: string): Promise<PedidoEmRisco[]> {
    const linhas = await tx.execute<{
      pedido_id: string;
      produto_id: string;
      quantidade_reservada: string;
      quantidade_recebida: string;
    }>(sql`
      WITH disp AS (
        SELECT id, produto_id, quantidade_recebida
        FROM disponibilidades_virtuais
        WHERE operacao_id = ${operacaoId}
          AND produto_id = ${produtoId}
      ),
      reservas_ativas AS (
        SELECT pvi.pedido_venda_id AS pedido_id,
               SUM(r.quantidade_reservada) AS quantidade_reservada
        FROM reservas_disponibilidade r
        JOIN pedidos_venda_itens pvi ON pvi.id = r.pedido_venda_item_id
          AND pvi.produto_id = ${produtoId}
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
             ${produtoId} AS produto_id,
             reservas_ativas.quantidade_reservada,
             (SELECT recebido FROM total_recebido) AS quantidade_recebida
      FROM reservas_ativas
      WHERE (SELECT reservado_item FROM total) > (SELECT recebido FROM total_recebido)
      ORDER BY reservas_ativas.pedido_id
    `);
    return linhas.rows.map((r) => ({
      pedidoId: r.pedido_id,
      produtoId: r.produto_id,
      quantidadeReservada: r.quantidade_reservada,
      quantidadeRecebida: r.quantidade_recebida,
    }));
  }

  async projetarImpacto(
    tx: Tx,
    compraId: string,
    simulacao: Map<string, string>,
  ): Promise<ItemImpacto[]> {
    const overrides = [...simulacao.entries()];
    const overrideSql = overrides.length
      ? sql`(VALUES ${sql.join(
        overrides.map(([produtoId, qtd]) => sql`(${produtoId}::uuid, ${qtd}::numeric)`),
        sql`, `,
      )}) AS o(produto_id, quantidade)`
      : sql`(SELECT NULL::uuid AS produto_id, NULL::numeric AS quantidade WHERE false) AS o`;

    const linhas = await tx.execute<{
      produto_id: string; codigo: string; nome: string;
      gerada_atual: string; gerada_projetada: string;
      reservada: string; saldo_atual: string;
    }>(sql`
    WITH projecao AS (
      SELECT x.produto_id, SUM(x.quantidade) AS gerada_projetada
      FROM (
        SELECT r.produto_destino_id AS produto_id,
               (r.fator_quantidade * COALESCE(o.quantidade, cpi.quantidade_comprada)) AS quantidade
        FROM compras_programadas_itens cpi
        JOIN regras_desdobramento_comercial r
          ON r.produto_origem_id = cpi.produto_id
         AND r.deleted_at IS NULL AND r.status = 'ativo'
         AND r.vigencia_inicio <= now()
         AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
        LEFT JOIN ${overrideSql} ON o.produto_id = cpi.produto_id
        WHERE cpi.compra_programada_id = ${compraId} AND cpi.deleted_at IS NULL
        UNION ALL
        SELECT cpi.produto_id AS produto_id,
               COALESCE(o.quantidade, cpi.quantidade_comprada) AS quantidade
        FROM compras_programadas_itens cpi
        JOIN produtos p ON p.id = cpi.produto_id
         AND p.deleted_at IS NULL
         AND p.ativo_venda = true
         AND p.ativo_compra = true
        LEFT JOIN ${overrideSql} ON o.produto_id = cpi.produto_id
        WHERE cpi.compra_programada_id = ${compraId} AND cpi.deleted_at IS NULL
      ) x
      GROUP BY x.produto_id
    )
    SELECT p.produto_id,
           pr.codigo, pr.nome AS nome,
           COALESCE(dv.quantidade_total_gerada, 0)::text AS gerada_atual,
           p.gerada_projetada::text                      AS gerada_projetada,
           COALESCE(dv.quantidade_reservada, 0)::text    AS reservada,
           COALESCE(dv.quantidade_disponivel, 0)::text   AS saldo_atual
    FROM projecao p
    JOIN produtos pr ON pr.id = p.produto_id
    LEFT JOIN disponibilidades_virtuais dv
      ON dv.compra_programada_id = ${compraId} AND dv.produto_id = p.produto_id
    ORDER BY pr.codigo
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
        produtoId: l.produto_id,
        codigo: l.codigo,
        descricao: l.nome,
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

  async recalcularParaCompra(
    tx: Tx,
    compra: CompraProgramada,
    usuarioId: string,
  ): Promise<void> {
    const anteriores = await tx.select().from(disponibilidadesVirtuais)
      .where(eq(disponibilidadesVirtuais.compraProgramadaId, compra.id));

    const atualizadas = await tx.execute<{
      id: string; produto_id: string;
      quantidade_total_gerada: string; quantidade_reservada: string;
      quantidade_disponivel: string; status: string;
    }>(sql`
    WITH projecao AS (
      SELECT x.produto_id, SUM(x.quantidade) AS gerada
      FROM (
        SELECT r.produto_destino_id AS produto_id,
               (r.fator_quantidade * cpi.quantidade_comprada) AS quantidade
        FROM compras_programadas_itens cpi
        JOIN regras_desdobramento_comercial r
          ON r.produto_origem_id = cpi.produto_id
         AND r.deleted_at IS NULL AND r.status = 'ativo'
         AND r.vigencia_inicio <= now()
         AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
        WHERE cpi.compra_programada_id = ${compra.id} AND cpi.deleted_at IS NULL
        UNION ALL
        SELECT cpi.produto_id AS produto_id,
               cpi.quantidade_comprada AS quantidade
        FROM compras_programadas_itens cpi
        JOIN produtos p ON p.id = cpi.produto_id
         AND p.deleted_at IS NULL
         AND p.ativo_venda = true
         AND p.ativo_compra = true
        WHERE cpi.compra_programada_id = ${compra.id} AND cpi.deleted_at IS NULL
      ) x
      GROUP BY x.produto_id
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
       AND dv.produto_id = p.produto_id
    RETURNING dv.id, dv.produto_id, dv.quantidade_total_gerada,
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
    const baseSelect = {
      modo: sql<'compra'>`'compra'`,
      id: disponibilidadesVirtuais.id,
      compraProgramadaId: disponibilidadesVirtuais.compraProgramadaId,
      operacaoId: disponibilidadesVirtuais.operacaoId,
      produtoId: disponibilidadesVirtuais.produtoId,
      quantidadeTotalGerada: disponibilidadesVirtuais.quantidadeTotalGerada,
      quantidadeReservada: disponibilidadesVirtuais.quantidadeReservada,
      quantidadeDisponivel: disponibilidadesVirtuais.quantidadeDisponivel,
      quantidadeRecebida: disponibilidadesVirtuais.quantidadeRecebida,
      quantidadeComDivergencia: disponibilidadesVirtuais.quantidadeComDivergencia,
      status: disponibilidadesVirtuais.status,
      createdAt: disponibilidadesVirtuais.createdAt,
      updatedAt: disponibilidadesVirtuais.updatedAt,
    };

    if (query.dataOperacao) {
      return this.db
        .select(baseSelect)
        .from(disponibilidadesVirtuais)
        .innerJoin(operacoes, eq(operacoes.id, disponibilidadesVirtuais.operacaoId))
        .where(and(
          eq(operacoes.data, query.dataOperacao),
          eq(disponibilidadesVirtuais.compraProgramadaId, query.compraProgramadaId),
        ))
        .orderBy(disponibilidadesVirtuais.produtoId);
    }
    return this.db
      .select(baseSelect)
      .from(disponibilidadesVirtuais)
      .where(eq(disponibilidadesVirtuais.compraProgramadaId, query.compraProgramadaId))
      .orderBy(disponibilidadesVirtuais.produtoId);
  }

  private listarAgregado(query: { operacaoId?: string; dataOperacao?: string }) {
    return this.db
      .select({
        modo: sql<'agregado'>`'agregado'`,
        operacaoId: disponibilidadesVirtuais.operacaoId,
        produtoId: disponibilidadesVirtuais.produtoId,
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
      .groupBy(disponibilidadesVirtuais.operacaoId, disponibilidadesVirtuais.produtoId)
      .orderBy(disponibilidadesVirtuais.produtoId);
  }
}
