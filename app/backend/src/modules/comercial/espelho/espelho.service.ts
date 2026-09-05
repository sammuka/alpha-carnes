import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  clientes,
  produtos,
  operacoes,
  pecas,
  pedidosVenda,
  pedidosVendaItens,
  representantes,
  rotas,
} from '../../../database/schema';
import { somarQtd } from '../../../common/crud/decimal';
import type {
  ConsultarEspelhoDto,
  EspelhoGrupo,
  EspelhoItem,
  EspelhoResposta,
  EspelhoTotais,
  StatusEspelho,
} from './dto/espelho.dto';

const TOTAIS_ZERO: EspelhoTotais = { quantidadePedida: '0.000', quantidadeAtendida: '0.000', pesoAtendido: '0.000' };

/** Precedência literal de D19. Função pura — leitura do espelho não grava status. */
export function derivarStatus(pedidoStatus: string, pedida: number, atendida: number): StatusEspelho {
  if (pedidoStatus === 'cancelado') return 'Cancelado';
  if (pedidoStatus === 'faturado') return 'Faturado';
  if (pedidoStatus === 'finalizado') return 'Fechado';
  if (atendida >= pedida) return 'Atendido';
  if (atendida > 0) return 'Parcial';
  return 'Aberto';
}

@Injectable()
export class EspelhoService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  private chaveDoGrupo(item: EspelhoItem, agrupar: ConsultarEspelhoDto['agrupar']): string {
    if (agrupar === 'rota') return item.rota ?? 'Sem rota';
    if (agrupar === 'representante') return item.representante ?? 'Sem representante';
    return item.cliente;
  }

  private somarTotais(itens: EspelhoItem[]): EspelhoTotais {
    return itens.reduce<EspelhoTotais>((acc, item) => ({
      quantidadePedida: somarQtd(acc.quantidadePedida, item.quantidadePedida),
      quantidadeAtendida: somarQtd(acc.quantidadeAtendida, item.quantidadeAtendida),
      pesoAtendido: somarQtd(acc.pesoAtendido, item.pesoAtendido),
    }), TOTAIS_ZERO);
  }

  private async carregarItens(dto: ConsultarEspelhoDto): Promise<EspelhoItem[]> {
    const linhas = await this.db
      .select({
        pedidoVendaId: pedidosVenda.id,
        pedidoStatus: pedidosVenda.status,
        clienteId: clientes.id,
        clienteNome: sql<string>`coalesce(${clientes.nomeFantasia}, ${clientes.razaoSocial})`,
        rotaId: clientes.rotaId,
        rotaNome: rotas.nome,
        representanteId: clientes.representanteId,
        representanteNome: representantes.nome,
        itemPedidoId: pedidosVendaItens.id,
        produtoId: pedidosVendaItens.produtoId,
        produtoCodigo: produtos.codigo,
        produtoDescricao: produtos.nome,
        unidadeComercial: produtos.unidadePedido,
        quantidadePedida: pedidosVendaItens.quantidadePedida,
        quantidadeAtendida: pedidosVendaItens.quantidadeAtendida,
      })
      .from(pedidosVenda)
      .innerJoin(operacoes, eq(operacoes.id, pedidosVenda.operacaoId))
      .innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .leftJoin(rotas, eq(rotas.id, clientes.rotaId))
      .leftJoin(representantes, eq(representantes.id, clientes.representanteId))
      .innerJoin(pedidosVendaItens, and(
        eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id),
        isNull(pedidosVendaItens.deletedAt),
      ))
      .innerJoin(produtos, eq(produtos.id, pedidosVendaItens.produtoId))
      .where(and(
        eq(operacoes.data, dto.dataOperacao),
        isNull(pedidosVenda.deletedAt),
        dto.clienteId ? eq(clientes.id, dto.clienteId) : undefined,
        dto.rotaId ? eq(clientes.rotaId, dto.rotaId) : undefined,
        dto.representanteId ? eq(clientes.representanteId, dto.representanteId) : undefined,
        dto.busca ? or(
          sql`${clientes.razaoSocial} ILIKE ${`%${dto.busca}%`}`,
          sql`${clientes.nomeFantasia} ILIKE ${`%${dto.busca}%`}`,
        ) : undefined,
      ));

    // Peso atendido vem da soma real das peças associadas ao item — nenhum peso é
    // estimado (RA-06). Consulta à parte porque não há coluna `peso_atendido`.
    const itemIds = linhas.map((l) => l.itemPedidoId);
    const pesos = itemIds.length === 0 ? [] : await this.db
      .select({
        pedidoVendaItemId: pecas.pedidoVendaItemId,
        peso: sql<string>`coalesce(sum(${pecas.pesoOriginal}), 0)::numeric(15,3)`,
      })
      .from(pecas)
      .where(and(inArray(pecas.pedidoVendaItemId, itemIds), isNull(pecas.deletedAt)))
      .groupBy(pecas.pedidoVendaItemId);
    const pesoPorItem = new Map(pesos.map((p) => [p.pedidoVendaItemId, p.peso]));

    return linhas.map((l): EspelhoItem => ({
      pedidoVendaId: l.pedidoVendaId,
      clienteId: l.clienteId,
      cliente: l.clienteNome,
      representanteId: l.representanteId,
      representante: l.representanteNome,
      rotaId: l.rotaId,
      rota: l.rotaNome,
      produtoId: l.produtoId,
      produto: `${l.produtoCodigo} — ${l.produtoDescricao}`,
      unidade: l.unidadeComercial,
      quantidadePedida: l.quantidadePedida,
      quantidadeAtendida: l.quantidadeAtendida,
      pesoAtendido: pesoPorItem.get(l.itemPedidoId) ?? '0.000',
      status: derivarStatus(l.pedidoStatus, Number(l.quantidadePedida), Number(l.quantidadeAtendida)),
    }));
  }

  async consultar(dto: ConsultarEspelhoDto): Promise<EspelhoResposta> {
    const itens = await this.carregarItens(dto);

    const porGrupo = new Map<string, EspelhoItem[]>();
    for (const item of itens) {
      const chave = this.chaveDoGrupo(item, dto.agrupar);
      if (!porGrupo.has(chave)) porGrupo.set(chave, []);
      porGrupo.get(chave)!.push(item);
    }
    const grupos: EspelhoGrupo[] = [...porGrupo.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([chave, itensDoGrupo]) => ({
        chave, itens: itensDoGrupo, subtotal: this.somarTotais(itensDoGrupo),
      }));

    return {
      dataOperacao: dto.dataOperacao,
      agrupar: dto.agrupar,
      totalGeral: this.somarTotais(itens),
      grupos,
    };
  }

  /** D20 — export gerado no servidor, mesmos filtros da tela. */
  async exportarCsv(dto: ConsultarEspelhoDto): Promise<string> {
    const { grupos } = await this.consultar(dto);
    const cabecalho = ['Cliente', 'Representante', 'Rota', 'Produto', 'Qtd. pedida', 'Qtd. atendida', 'Peso atendido', 'Status'];
    const linhas = grupos.flatMap((grupo) => grupo.itens.map((item) => [
      item.cliente, item.representante ?? '', item.rota ?? '', item.produto,
      item.quantidadePedida, item.quantidadeAtendida, item.pesoAtendido, item.status,
    ]));
    const escapar = (valor: string) => (/[",;\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor);
    return [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(';')).join('\n');
  }
}
