import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { produtos, produtos } from '../../../database/schema';
import { somarQtd, subtrairQtd } from '../../../common/crud/decimal';
import type { EstadoMapa, MapaProduto } from './dto/mapa.dto';

const ESTADOS: EstadoMapa[] = ['F', 'V', 'R', 'C', 'D', 'O', 'E', '!'];

interface LinhaAgregada extends Record<string, unknown> {
  produto_id: string;
  unidades: number;
  quantidade: string;
}

/**
 * MapaService — mapa teatro de disponibilidade (D17). Cada estado é uma consulta
 * agregada literal sobre tabela real; nenhum estado é inventado nem persistido.
 */
@Injectable()
export class MapaService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  private async estadoF(operacaoId: string): Promise<LinhaAgregada[]> {
    const r = await this.db.execute<LinhaAgregada>(sql`
      SELECT p.produto_base_id AS produto_id,
             count(*)::int            AS unidades,
             coalesce(sum(p.peso_original), 0)::numeric(15,3) AS quantidade
        FROM pecas p
        JOIN recebimentos r ON r.id = p.recebimento_id
       WHERE r.operacao_id = ${operacaoId}
         AND p.status_peca = 'pesada'
         AND p.pedido_venda_item_id IS NULL
         AND p.deleted_at IS NULL
         AND r.deleted_at IS NULL
       GROUP BY p.produto_base_id
    `);
    return r.rows;
  }

  private async estadoV(operacaoId: string): Promise<LinhaAgregada[]> {
    const r = await this.db.execute<LinhaAgregada>(sql`
      SELECT dv.produto_id,
             0::int                                      AS unidades,
             sum(dv.quantidade_disponivel)::numeric(15,3) AS quantidade
        FROM disponibilidades_virtuais dv
       WHERE dv.operacao_id = ${operacaoId}
       GROUP BY dv.produto_id
    `);
    return r.rows;
  }

  private async estadoR(operacaoId: string): Promise<LinhaAgregada[]> {
    const r = await this.db.execute<LinhaAgregada>(sql`
      SELECT pvi.produto_id,
             0::int                                       AS unidades,
             sum(rd.quantidade_reservada)::numeric(15,3)  AS quantidade
        FROM reservas_disponibilidade rd
        JOIN pedidos_venda_itens pvi ON pvi.id = rd.pedido_venda_item_id
        JOIN pedidos_venda pv        ON pv.id = pvi.pedido_venda_id
       WHERE pv.operacao_id = ${operacaoId}
         AND rd.status = 'ativa'
         AND rd.tipo_consumo IN ('fisico','virtual')
         AND pv.status IN ('rascunho','em_elaboracao_reserva_ativa','aguardando_confirmacao_overbooking')
         AND pvi.deleted_at IS NULL
         AND pv.deleted_at IS NULL
       GROUP BY pvi.produto_id
    `);
    return r.rows;
  }

  private async estadoC(operacaoId: string): Promise<LinhaAgregada[]> {
    const r = await this.db.execute<LinhaAgregada>(sql`
      SELECT pvi.produto_id,
             0::int                                       AS unidades,
             sum(rd.quantidade_reservada)::numeric(15,3)  AS quantidade
        FROM reservas_disponibilidade rd
        JOIN pedidos_venda_itens pvi ON pvi.id = rd.pedido_venda_item_id
        JOIN pedidos_venda pv        ON pv.id = pvi.pedido_venda_id
       WHERE pv.operacao_id = ${operacaoId}
         AND rd.status = 'ativa'
         AND rd.tipo_consumo IN ('fisico','virtual')
         AND pv.status IN ('finalizado','parcialmente_atendido','atendido','faturado')
         AND pvi.deleted_at IS NULL
         AND pv.deleted_at IS NULL
       GROUP BY pvi.produto_id
    `);
    return r.rows;
  }

  private async estadoD(operacaoId: string): Promise<LinhaAgregada[]> {
    const r = await this.db.execute<LinhaAgregada>(sql`
      SELECT p.produto_base_id AS produto_id,
             count(*)::int            AS unidades,
             coalesce(sum(p.peso_original), 0)::numeric(15,3) AS quantidade
        FROM pecas p
        JOIN recebimentos r ON r.id = p.recebimento_id
       WHERE r.operacao_id = ${operacaoId}
         AND p.status_peca IN ('para_corte','em_transformacao')
         AND p.deleted_at IS NULL
         AND r.deleted_at IS NULL
       GROUP BY p.produto_base_id
    `);
    return r.rows;
  }

  private async estadoO(operacaoId: string): Promise<LinhaAgregada[]> {
    const r = await this.db.execute<LinhaAgregada>(sql`
      SELECT pvi.produto_id,
             0::int                                       AS unidades,
             sum(rd.quantidade_reservada)::numeric(15,3)  AS quantidade
        FROM reservas_disponibilidade rd
        JOIN pedidos_venda_itens pvi ON pvi.id = rd.pedido_venda_item_id
        JOIN pedidos_venda pv        ON pv.id = pvi.pedido_venda_id
       WHERE pv.operacao_id = ${operacaoId}
         AND rd.status = 'ativa'
         AND rd.tipo_consumo = 'overbooking'
         AND pv.status <> 'cancelado'
         AND pvi.deleted_at IS NULL
         AND pv.deleted_at IS NULL
       GROUP BY pvi.produto_id
    `);
    return r.rows;
  }

  private async estadoE(operacaoId: string): Promise<LinhaAgregada[]> {
    const r = await this.db.execute<LinhaAgregada>(sql`
      SELECT p.produto_base_id AS produto_id,
             count(*)::int            AS unidades,
             coalesce(sum(p.peso_original), 0)::numeric(15,3) AS quantidade
        FROM carga_itens ci
        JOIN caminhoes cam ON cam.id = ci.caminhao_id
        JOIN pecas p       ON p.id = ci.peca_id
       WHERE cam.operacao_id = ${operacaoId}
         AND ci.tipo_origem = 'peca'
         AND ci.status_carga_item <> 'removido'
         AND cam.status_caminhao IN
             ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')
         AND ci.deleted_at IS NULL
         AND cam.deleted_at IS NULL
         AND p.deleted_at IS NULL
       GROUP BY p.produto_base_id
      UNION ALL
      SELECT s.produto_id,
             count(*)::int                             AS unidades,
             coalesce(sum(s.peso), 0)::numeric(15,3)   AS quantidade
        FROM carga_itens ci
        JOIN caminhoes cam ON cam.id = ci.caminhao_id
        JOIN subitens s    ON s.id = ci.subitem_id
       WHERE cam.operacao_id = ${operacaoId}
         AND ci.tipo_origem = 'subitem'
         AND ci.status_carga_item <> 'removido'
         AND cam.status_caminhao IN
             ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')
         AND ci.deleted_at IS NULL
         AND cam.deleted_at IS NULL
         AND s.deleted_at IS NULL
       GROUP BY s.produto_id
    `);
    return r.rows;
  }

  private async estadoOcorrencia(operacaoId: string): Promise<LinhaAgregada[]> {
    const r = await this.db.execute<LinhaAgregada>(sql`
      SELECT p.produto_base_id AS produto_id,
             count(*)::int            AS unidades,
             coalesce(sum(p.peso_original), 0)::numeric(15,3) AS quantidade
        FROM pecas p
        JOIN recebimentos r ON r.id = p.recebimento_id
       WHERE r.operacao_id = ${operacaoId}
         AND p.status_peca = 'divergente'
         AND p.deleted_at IS NULL
         AND r.deleted_at IS NULL
       GROUP BY p.produto_base_id
    `);
    return r.rows;
  }

  /** As 8 consultas literais de D17, unidas por `produto_id`. */
  async consultar(operacaoId: string, produtoId?: string): Promise<MapaProduto[]> {
    const [f, v, r, c, d, o, e, ocorrencia] = await Promise.all([
      this.estadoF(operacaoId), this.estadoV(operacaoId), this.estadoR(operacaoId),
      this.estadoC(operacaoId), this.estadoD(operacaoId), this.estadoO(operacaoId),
      this.estadoE(operacaoId), this.estadoOcorrencia(operacaoId),
    ]);
    const porEstado: Record<EstadoMapa, LinhaAgregada[]> = {
      F: f, V: v, R: r, C: c, D: d, O: o, E: e, '!': ocorrencia,
    };

    const catalogo = await this.db
      .select({
        produtoId: produtos.id,
        codigo: produtos.codigo,
        descricao: produtos.descricao,
        provisorio: sql<boolean>`coalesce(bool_or((${produtos.atributosJson}->>'provisorio')::boolean), false)`,
      })
      .from(produtos)
      .leftJoin(produtos, eq(produtos.legadoprodutoId, produtos.id))
      .where(and(
        eq(produtos.status, 'ativo'),
        isNull(produtos.deletedAt),
        produtoId ? eq(produtos.id, produtoId) : undefined,
      ))
      .groupBy(produtos.id, produtos.codigo, produtos.descricao)
      .orderBy(asc(produtos.codigo));

    return catalogo.map((item): MapaProduto => {
      const estados = {} as Record<EstadoMapa, string>;
      const unidades = {} as Record<EstadoMapa, number>;
      for (const estado of ESTADOS) {
        // Estado E é UNION ALL de duas pernas (peça + subitem): pode haver mais de
        // uma linha por produto_id, e o agregador soma as duas (D17).
        const linhas = porEstado[estado].filter((l) => l.produto_id === item.produtoId);
        estados[estado] = linhas.reduce((acc, l) => somarQtd(acc, l.quantidade), '0.000');
        unidades[estado] = linhas.reduce((acc, l) => acc + Number(l.unidades), 0);
      }
      const saldoComercial = subtrairQtd(somarQtd(estados.F, estados.V), somarQtd(estados.R, estados.O));
      return {
        produtoId: item.produtoId,
        codigo: item.codigo,
        descricao: item.descricao,
        provisorio: item.provisorio,
        estados,
        unidades,
        saldoComercial,
      };
    });
  }

  /** Drill-down: unidades reais do estado clicado, reusando o mesmo WHERE da consulta agregada. */
  async detalhar(operacaoId: string, produtoId: string, estado: EstadoMapa) {
    switch (estado) {
      case 'F':
        return this.detalharPecas(operacaoId, produtoId, sql`p.status_peca = 'pesada' AND p.pedido_venda_item_id IS NULL`);
      case 'D':
        return this.detalharPecas(operacaoId, produtoId, sql`p.status_peca IN ('para_corte','em_transformacao')`);
      case '!':
        return this.detalharPecas(operacaoId, produtoId, sql`p.status_peca = 'divergente'`);
      case 'V':
        return this.detalharVirtual(operacaoId, produtoId);
      case 'E':
        return this.detalharExpedido(operacaoId, produtoId);
      case 'R':
        return this.detalharReservas(operacaoId, produtoId, sql`pv.status IN ('rascunho','em_elaboracao_reserva_ativa','aguardando_confirmacao_overbooking') AND rd.tipo_consumo IN ('fisico','virtual')`);
      case 'C':
        return this.detalharReservas(operacaoId, produtoId, sql`pv.status IN ('finalizado','parcialmente_atendido','atendido','faturado') AND rd.tipo_consumo IN ('fisico','virtual')`);
      case 'O':
        return this.detalharReservas(operacaoId, produtoId, sql`pv.status <> 'cancelado' AND rd.tipo_consumo = 'overbooking'`);
    }
  }

  private async detalharPecas(operacaoId: string, produtoId: string, filtroEstado: ReturnType<typeof sql>) {
    const r = await this.db.execute<{
      id: string; etiqueta_atual: string | null; peso_original: string; status_peca: string; recebimento_id: string;
    }>(sql`
      SELECT p.id, p.etiqueta_atual, p.peso_original, p.status_peca, p.recebimento_id
        FROM pecas p
        JOIN recebimentos r ON r.id = p.recebimento_id
       WHERE r.operacao_id = ${operacaoId}
         AND p.produto_base_id = ${produtoId}
         AND (${filtroEstado})
         AND p.deleted_at IS NULL
         AND r.deleted_at IS NULL
       ORDER BY p.etiqueta_atual
    `);
    return r.rows;
  }

  private async detalharVirtual(operacaoId: string, produtoId: string) {
    const r = await this.db.execute<{
      id: string; quantidade_disponivel: string; compra_programada_id: string; numero_interno: string | null;
    }>(sql`
      SELECT dv.id, dv.quantidade_disponivel, dv.compra_programada_id, cp.numero_interno
        FROM disponibilidades_virtuais dv
        JOIN compras_programadas cp ON cp.id = dv.compra_programada_id
       WHERE dv.operacao_id = ${operacaoId}
         AND dv.produto_id = ${produtoId}
       ORDER BY dv.created_at
    `);
    return r.rows;
  }

  private async detalharExpedido(operacaoId: string, produtoId: string) {
    const r = await this.db.execute<{
      carga_item_id: string; caminhao_id: string; placa: string; status_caminhao: string;
      tipo_origem: string; etiqueta_atual: string | null;
    }>(sql`
      SELECT ci.id AS carga_item_id, cam.id AS caminhao_id, cam.placa, cam.status_caminhao,
             ci.tipo_origem, p.etiqueta_atual
        FROM carga_itens ci
        JOIN caminhoes cam ON cam.id = ci.caminhao_id
        JOIN pecas p       ON p.id = ci.peca_id
       WHERE cam.operacao_id = ${operacaoId}
         AND ci.tipo_origem = 'peca'
         AND ci.status_carga_item <> 'removido'
         AND cam.status_caminhao IN
             ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')
         AND p.produto_base_id = ${produtoId}
         AND ci.deleted_at IS NULL AND cam.deleted_at IS NULL AND p.deleted_at IS NULL
      UNION ALL
      SELECT ci.id AS carga_item_id, cam.id AS caminhao_id, cam.placa, cam.status_caminhao,
             ci.tipo_origem, s.etiqueta_atual
        FROM carga_itens ci
        JOIN caminhoes cam ON cam.id = ci.caminhao_id
        JOIN subitens s    ON s.id = ci.subitem_id
       WHERE cam.operacao_id = ${operacaoId}
         AND ci.tipo_origem = 'subitem'
         AND ci.status_carga_item <> 'removido'
         AND cam.status_caminhao IN
             ('fechado','liberado_faturamento','faturado','liberado_saida','expedido')
         AND s.produto_id = ${produtoId}
         AND ci.deleted_at IS NULL AND cam.deleted_at IS NULL AND s.deleted_at IS NULL
    `);
    return r.rows;
  }

  private async detalharReservas(operacaoId: string, produtoId: string, filtroEstado: ReturnType<typeof sql>) {
    const r = await this.db.execute<{
      id: string; quantidade_reservada: string; tipo_consumo: string;
      pedido_venda_id: string; status_pedido: string; cliente_id: string; razao_social: string;
    }>(sql`
      SELECT rd.id, rd.quantidade_reservada, rd.tipo_consumo,
             pv.id AS pedido_venda_id, pv.status AS status_pedido,
             cli.id AS cliente_id, cli.razao_social
        FROM reservas_disponibilidade rd
        JOIN pedidos_venda_itens pvi ON pvi.id = rd.pedido_venda_item_id
        JOIN pedidos_venda pv        ON pv.id = pvi.pedido_venda_id
        JOIN clientes cli            ON cli.id = pv.cliente_id
       WHERE pv.operacao_id = ${operacaoId}
         AND pvi.produto_id = ${produtoId}
         AND rd.status = 'ativa'
         AND (${filtroEstado})
         AND pvi.deleted_at IS NULL
         AND pv.deleted_at IS NULL
       ORDER BY pv.created_at
    `);
    return r.rows;
  }
}
