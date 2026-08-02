import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { montarPaginado, primeiroOuFalha, type ListarQuery } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  clientes,
  entradasItens,
  operacoes,
  pedidosVenda,
  pedidosVendaItens,
  produtos,
} from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import type { CriarEntradaDto } from './dto/estoque.dto';

type Tx = NodePgDatabase<typeof schema>;

@Injectable()
export class EntradasEstoqueService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async criar(dto: CriarEntradaDto, userId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const produto = await tx
        .select()
        .from(produtos)
        .where(and(eq(produtos.id, dto.produtoId), isNull(produtos.deletedAt)))
        .then((r) => r[0] ?? null);
      if (!produto) throw new NotFoundException('Produto não encontrado');
      if (produto.tipoOperacional !== 'entrada_unidade') {
        throw new ConflictException({ codigo: 'PRODUTO_NAO_E_CAIXARIA', mensagem: 'Produto não é uma caixaria (entrada por unidade)' });
      }

      let pedidoId: string | null = null;
      if (dto.destino === 'pedido') {
        const item = await tx
          .select({ id: pedidosVendaItens.id, pedidoVendaId: pedidosVendaItens.pedidoVendaId })
          .from(pedidosVendaItens)
          .where(eq(pedidosVendaItens.id, dto.pedidoVendaItemId!))
          .then((r) => r[0] ?? null);
        if (!item) throw new NotFoundException('Item de pedido não encontrado');
        pedidoId = item.pedidoVendaId;

        const consumo = await tx.execute(sql`
          UPDATE pedidos_venda_itens SET quantidade_atendida = quantidade_atendida + ${dto.quantidade}, updated_at = now()
          WHERE id = ${dto.pedidoVendaItemId} AND quantidade_atendida + ${dto.quantidade} <= quantidade_pedida
          RETURNING id`);
        if (consumo.rows.length === 0) {
          throw new ConflictException({ codigo: 'ITEM_DO_PEDIDO_COMPLETO', mensagem: 'Item do pedido não tem saldo suficiente' });
        }
      }

      const entrada = primeiroOuFalha(
        await tx
          .insert(entradasItens)
          .values({
            produtoId: dto.produtoId,
            quantidade: dto.quantidade,
            unidade: dto.unidade,
            fornecedorNome: dto.fornecedorNome,
            loteNf: dto.loteNf ?? null,
            local: dto.local ?? null,
            destino: dto.destino,
            pedidoId,
            pedidoVendaItemId: dto.destino === 'pedido' ? dto.pedidoVendaItemId : null,
            quantidadeDestinada: dto.destino === 'pedido' ? dto.quantidade : 0,
            observacao: dto.observacao ?? null,
            registradoPor: userId,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'entradas_itens', registroId: entrada.id, operacao: 'INSERT', modulo: 'operacao',
        usuarioId: userId, dadosAnteriores: {}, dadosNovos: entrada,
      });

      return { entrada, dataOperacao: await this.dataOperacaoDeHoje(tx) };
    });

    this.eventEmitter.emit(EVENTOS.ENTRADA_ITENS_REGISTRADA, {
      entradaId: resultado.entrada.id,
      produtoId: resultado.entrada.produtoId,
      quantidade: resultado.entrada.quantidade,
      destino: resultado.entrada.destino as 'estoque' | 'pedido',
      dataOperacao: resultado.dataOperacao,
    });

    return resultado.entrada;
  }

  async listar(query: ListarQuery) {
    const where = isNull(entradasItens.deletedAt);
    const [linhas, totalRow] = await Promise.all([
      this.db
        .select({
          id: entradasItens.id,
          produtoId: entradasItens.produtoId,
          produtoNome: produtos.nome,
          quantidade: entradasItens.quantidade,
          unidade: entradasItens.unidade,
          destino: entradasItens.destino,
          operadorNome: sql<string>`(SELECT nome FROM usuarios WHERE id = ${entradasItens.registradoPor})`,
          createdAt: entradasItens.createdAt,
        })
        .from(entradasItens)
        .leftJoin(produtos, eq(produtos.id, entradasItens.produtoId))
        .where(where)
        .orderBy(desc(entradasItens.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db.select({ total: sql<number>`count(*)::int` }).from(entradasItens).where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0, { page: query.page, pageSize: query.pageSize });
  }

  async compativeis(entradaId: string) {
    const entrada = await this.db
      .select({ produtoId: entradasItens.produtoId })
      .from(entradasItens)
      .where(and(eq(entradasItens.id, entradaId), isNull(entradasItens.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!entrada) throw new NotFoundException('Entrada não encontrada');
    return this.compativeisPorProduto(entrada.produtoId);
  }

  async compativeisPorProduto(produtoId: string) {
    const produto = await this.db
      .select({ legadoItemComercialId: produtos.legadoItemComercialId })
      .from(produtos)
      .where(eq(produtos.id, produtoId))
      .then((r) => r[0] ?? null);
    if (!produto?.legadoItemComercialId) return [];

    const linhas = await this.db
      .select({
        pedidoVendaItemId: pedidosVendaItens.id,
        pedidoVendaId: pedidosVendaItens.pedidoVendaId,
        clienteNome: sql<string>`coalesce(${clientes.nomeFantasia}, ${clientes.razaoSocial})`,
        quantidadePedida: pedidosVendaItens.quantidadePedida,
        quantidadeAtendida: pedidosVendaItens.quantidadeAtendida,
      })
      .from(pedidosVendaItens)
      .innerJoin(pedidosVenda, eq(pedidosVenda.id, pedidosVendaItens.pedidoVendaId))
      .innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .where(
        and(
          eq(pedidosVendaItens.itemComercialId, produto.legadoItemComercialId),
          isNull(pedidosVendaItens.deletedAt),
          isNull(pedidosVenda.deletedAt),
          sql`${pedidosVenda.status} <> 'cancelado'`,
          sql`${pedidosVendaItens.quantidadeAtendida} < ${pedidosVendaItens.quantidadePedida}`,
        ),
      );

    return linhas.map((l) => ({
      pedidoVendaItemId: l.pedidoVendaItemId,
      pedidoVendaId: l.pedidoVendaId,
      clienteNome: l.clienteNome,
      pendencia: `${(Number(l.quantidadePedida) - Number(l.quantidadeAtendida)).toString()} pendente(s)`,
    }));
  }

  private async dataOperacaoDeHoje(tx: Tx): Promise<string> {
    const r = await tx
      .select({ data: operacoes.data })
      .from(operacoes)
      .where(isNull(operacoes.deletedAt))
      .orderBy(desc(operacoes.data))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    return r?.data ?? '';
  }
}
