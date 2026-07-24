import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, isNull, lt, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  caminhoes,
  clientes,
  comprasProgramadas,
  disponibilidadesVirtuais,
  divergenciasRecebimento,
  itensComerciais,
  operacoes,
  pedidosVenda,
  pedidosVendaItens,
  pecas,
  recebimentos,
  auditoria,
  usuarios,
} from '../../../database/schema';

export interface PedidoEmAndamento {
  pedidoId: string;
  clienteNome: string;
  produtoResumo: string;
  pesoTotalKg: string | null;
  status: string;
  dataOperacao: string;
}

export interface AtividadeRecente {
  id: string;
  usuarioNome: string;
  descricao: string;
  createdAt: string;
}

export interface DashboardDia {
  dataOperacao: string;
  comprasProgramadas: {
    total: number;
    porStatus: Record<string, number>;
    compraAtiva: { id: string; status: string } | null;
  };
  pedidos: {
    total: number;
    porStatus: Record<string, number>;
  };
  pedidosEmAndamento: PedidoEmAndamento[];
  atividadesRecentes: AtividadeRecente[];
  divergenciasAbertas: number;
  caminhoesDoDia: number;
  disponibilidade: {
    itens: number;
    itensEsgotados: number;
    quantidadeDisponivelTotal: string;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async resumoDia(dataOperacao: string): Promise<DashboardDia> {
    const [
      comprasRows,
      pedidosRows,
      divergenciasRow,
      caminhoesRow,
      dispRows,
    ] = await Promise.all([
      this.db
        .select({ status: comprasProgramadas.status, id: comprasProgramadas.id })
        .from(comprasProgramadas)
        .innerJoin(operacoes, eq(operacoes.id, comprasProgramadas.operacaoId))
        .where(and(eq(operacoes.data, dataOperacao), isNull(comprasProgramadas.deletedAt))),
      this.db
        .select({ status: pedidosVenda.status, total: sql<number>`count(*)::int` })
        .from(pedidosVenda)
        .innerJoin(operacoes, eq(operacoes.id, pedidosVenda.operacaoId))
        .where(and(eq(operacoes.data, dataOperacao), isNull(pedidosVenda.deletedAt)))
        .groupBy(pedidosVenda.status),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(divergenciasRecebimento)
        .innerJoin(recebimentos, eq(divergenciasRecebimento.recebimentoId, recebimentos.id))
        .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
        .where(
          and(
            eq(operacoes.data, dataOperacao),
            isNull(recebimentos.deletedAt),
            ne(divergenciasRecebimento.status, 'resolvida'),
          ),
        ),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(caminhoes)
        .innerJoin(operacoes, eq(operacoes.id, caminhoes.operacaoId))
        .where(and(eq(operacoes.data, dataOperacao), isNull(caminhoes.deletedAt))),
      this.db
        .select({
          id: disponibilidadesVirtuais.id,
          quantidadeDisponivel: disponibilidadesVirtuais.quantidadeDisponivel,
        })
        .from(disponibilidadesVirtuais)
        .innerJoin(operacoes, eq(operacoes.id, disponibilidadesVirtuais.operacaoId))
        .where(eq(operacoes.data, dataOperacao)),
    ]);

    const comprasPorStatus: Record<string, number> = {};
    for (const row of comprasRows) {
      comprasPorStatus[row.status] = (comprasPorStatus[row.status] ?? 0) + 1;
    }

    const compraAtiva =
      comprasRows.find((c) => c.status !== 'cancelada') ?? null;

    const pedidosPorStatus: Record<string, number> = {};
    let pedidosTotal = 0;
    for (const row of pedidosRows) {
      pedidosPorStatus[row.status] = row.total;
      pedidosTotal += row.total;
    }

    let quantidadeDisponivelTotal = 0;
    let itensEsgotados = 0;
    for (const row of dispRows) {
      const disp = Number(row.quantidadeDisponivel);
      quantidadeDisponivelTotal += disp;
      if (disp <= 0) itensEsgotados += 1;
    }

    const [pedidosEmAndamento, atividadesRecentes] = await Promise.all([
      this.listarPedidosEmAndamento(dataOperacao),
      this.listarAtividadesRecentes(dataOperacao),
    ]);

    return {
      dataOperacao,
      comprasProgramadas: {
        total: comprasRows.length,
        porStatus: comprasPorStatus,
        compraAtiva: compraAtiva ? { id: compraAtiva.id, status: compraAtiva.status } : null,
      },
      pedidos: {
        total: pedidosTotal,
        porStatus: pedidosPorStatus,
      },
      pedidosEmAndamento,
      atividadesRecentes,
      divergenciasAbertas: divergenciasRow[0]?.total ?? 0,
      caminhoesDoDia: caminhoesRow[0]?.total ?? 0,
      disponibilidade: {
        itens: dispRows.length,
        itensEsgotados,
        quantidadeDisponivelTotal: quantidadeDisponivelTotal.toFixed(3),
      },
    };
  }

  private async listarPedidosEmAndamento(dataOperacao: string): Promise<PedidoEmAndamento[]> {
    const pedidos = await this.db
      .select({
        pedidoId: pedidosVenda.id,
        status: pedidosVenda.status,
        dataOperacao: operacoes.data,
        clienteNome: clientes.nomeFantasia,
        clienteRazao: clientes.razaoSocial,
      })
      .from(pedidosVenda)
      .innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .innerJoin(operacoes, eq(operacoes.id, pedidosVenda.operacaoId))
      .where(
        and(
          eq(operacoes.data, dataOperacao),
          isNull(pedidosVenda.deletedAt),
          ne(pedidosVenda.status, 'cancelado'),
        ),
      )
      .orderBy(desc(pedidosVenda.createdAt))
      .limit(20);

    const resultado: PedidoEmAndamento[] = [];
    for (const p of pedidos) {
      const itens = await this.db
        .select({
          codigo: itensComerciais.codigo,
          descricao: itensComerciais.descricao,
          quantidade: pedidosVendaItens.quantidadePedida,
        })
        .from(pedidosVendaItens)
        .innerJoin(itensComerciais, eq(itensComerciais.id, pedidosVendaItens.itemComercialId))
        .where(eq(pedidosVendaItens.pedidoVendaId, p.pedidoId));

      const produtoResumo =
        itens.length === 0
          ? '—'
          : itens.length === 1
            ? `${itens[0]!.codigo} (${itens[0]!.quantidade})`
            : `${itens[0]!.codigo} +${itens.length - 1}`;

      const pesoRow = await this.db
        .select({ total: sql<string>`coalesce(sum(${pecas.pesoOriginal}), 0)::text` })
        .from(pecas)
        .where(and(eq(pecas.pedidoVendaId, p.pedidoId), isNull(pecas.deletedAt)));

      resultado.push({
        pedidoId: p.pedidoId,
        clienteNome: p.clienteNome ?? p.clienteRazao ?? '—',
        produtoResumo,
        pesoTotalKg: pesoRow[0]?.total && Number(pesoRow[0].total) > 0 ? pesoRow[0].total : null,
        status: p.status,
        dataOperacao: p.dataOperacao,
      });
    }
    return resultado;
  }

  private async listarAtividadesRecentes(dataOperacao: string): Promise<AtividadeRecente[]> {
    const inicio = new Date(`${dataOperacao}T00:00:00.000Z`);
    const fim = new Date(inicio);
    fim.setUTCDate(fim.getUTCDate() + 1);

    const linhas = await this.db
      .select({
        id: auditoria.id,
        tabela: auditoria.tabela,
        operacao: auditoria.operacao,
        modulo: auditoria.modulo,
        usuarioNome: usuarios.nome,
        createdAt: auditoria.createdAt,
      })
      .from(auditoria)
      .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(
        and(
          gte(auditoria.createdAt, inicio),
          lt(auditoria.createdAt, fim),
          sql`${auditoria.modulo} IN ('operacao', 'comercial', 'pesagem', 'gestao')`,
        ),
      )
      .orderBy(desc(auditoria.createdAt))
      .limit(15);

    return linhas.map((l) => ({
      id: l.id,
      usuarioNome: l.usuarioNome ?? 'Sistema',
      descricao: this.humanizarAuditoria(l.tabela, l.operacao, l.modulo),
      createdAt: l.createdAt.toISOString(),
    }));
  }

  private humanizarAuditoria(tabela: string, operacao: string, modulo: string | null): string {
    const acao =
      operacao === 'INSERT' ? 'criou' : operacao === 'UPDATE' ? 'alterou' : operacao === 'DELETE' ? 'removeu' : operacao.toLowerCase();
    return `${acao} registro em ${tabela}${modulo ? ` (${modulo})` : ''}`;
  }
}
