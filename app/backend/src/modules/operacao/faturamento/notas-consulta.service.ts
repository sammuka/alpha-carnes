import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  notasFiscais, caminhoes, clientes, pedidosVenda, cargaItens, pecas, subitens, produtos,
} from '../../../database/schema';
import { calcularRange, montarPaginado } from '../../../common/crud/paginacao';
import type { ListarNotasQuery } from './dto/faturamento.dto';

@Injectable()
export class NotasConsultaService {
  constructor(@Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> }) {}
  private get db() { return this.drizzle.db; }

  /** D10.8 — listagem paginada com filtros. */
  async listar(query: ListarNotasQuery) {
    const condicoes = [isNull(notasFiscais.deletedAt)];
    if (query.status) condicoes.push(eq(notasFiscais.statusNfse, query.status));
    if (query.caminhaoId) condicoes.push(eq(notasFiscais.caminhaoId, query.caminhaoId));
    if (query.clienteId) condicoes.push(eq(notasFiscais.clienteId, query.clienteId));
    if (query.busca) {
      const termo = `%${query.busca}%`;
      condicoes.push(or(
        ilike(notasFiscais.numeroNfse, termo),
        ilike(notasFiscais.codigoVerificacao, termo),
        ilike(clientes.razaoSocial, termo),
        ilike(clientes.nomeFantasia, termo),
      )!);
    }

    const { limit, offset } = calcularRange(query);
    const base = this.db.select({ nota: notasFiscais, cliente: clientes, caminhao: caminhoes })
      .from(notasFiscais)
      .innerJoin(clientes, eq(clientes.id, notasFiscais.clienteId))
      .innerJoin(caminhoes, eq(caminhoes.id, notasFiscais.caminhaoId))
      .where(and(...condicoes));

    const [linhas, totalRow] = await Promise.all([
      base.orderBy(desc(notasFiscais.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(notasFiscais)
        .innerJoin(clientes, eq(clientes.id, notasFiscais.clienteId)).where(and(...condicoes)),
    ]);
    const total = totalRow[0]?.total ?? 0;

    return montarPaginado(
      linhas.map((l) => ({
        ...l.nota,
        clienteNome: l.cliente.nomeFantasia ?? l.cliente.razaoSocial,
        // D10.7/T9 — trava visual de cancelamento no client (NotasXml.tsx:485-497).
        caminhaoLiberado: ['liberado_saida', 'expedido'].includes(l.caminhao.statusCaminhao),
      })),
      total, query,
    );
  }

  /** D10.7 — cadeia nota → pedido → carga_itens → peças/subitens (etiqueta, produto, peso) → totais. Somente leitura. */
  async rastreabilidade(notaFiscalId: string) {
    const nota = await this.db.select().from(notasFiscais)
      .where(and(eq(notasFiscais.id, notaFiscalId), isNull(notasFiscais.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!nota) throw new NotFoundException('Nota fiscal não encontrada');

    const pedido = await this.db.select({ pedido: pedidosVenda, cliente: clientes })
      .from(pedidosVenda).innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .where(eq(pedidosVenda.id, nota.pedidoVendaId)).then((r) => r[0] ?? null);

    const itensPeca = await this.db.select({
      etiqueta: pecas.etiquetaAtual, produtoNome: produtos.nome, peso: pecas.pesoOriginal,
    }).from(cargaItens)
      .innerJoin(pecas, eq(pecas.id, cargaItens.pecaId))
      .innerJoin(produtos, eq(produtos.id, pecas.produtoBaseId))
      .where(and(eq(cargaItens.caminhaoId, nota.caminhaoId), eq(cargaItens.pedidoVendaId, nota.pedidoVendaId), eq(cargaItens.tipoOrigem, 'peca')));

    const itensSubitem = await this.db.select({
      etiqueta: subitens.etiquetaAtual, produtoNome: produtos.nome, peso: subitens.peso,
    }).from(cargaItens)
      .innerJoin(subitens, eq(subitens.id, cargaItens.subitemId))
      .innerJoin(produtos, eq(produtos.id, subitens.produtoId))
      .where(and(eq(cargaItens.caminhaoId, nota.caminhaoId), eq(cargaItens.pedidoVendaId, nota.pedidoVendaId), eq(cargaItens.tipoOrigem, 'subitem')));

    const pecasRastreio = [...itensPeca, ...itensSubitem];
    return {
      nota,
      pedido: pedido ? { id: pedido.pedido.id, clienteNome: pedido.cliente.nomeFantasia ?? pedido.cliente.razaoSocial } : null,
      pecas: pecasRastreio,
      pesoTotalKg: pecasRastreio.reduce((acc, p) => acc + Number(p.peso ?? 0), 0).toFixed(3),
    };
  }
}
