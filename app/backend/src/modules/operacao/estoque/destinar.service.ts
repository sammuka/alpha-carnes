import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  associacoesPecaHistorico,
  entradasItens,
  operacoes,
  pecas,
  pedidosVenda,
  pedidosVendaItens,
  recebimentos,
  subitens,
} from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import { consumirSaldo } from '../pesagem/saldo';
import type { DestinarDto } from './dto/estoque.dto';

type Tx = NodePgDatabase<typeof schema>;

@Injectable()
export class DestinarEstoqueService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async destinar(dto: DestinarDto, operadorId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      switch (dto.tipo) {
        case 'peca':
          return this.destinarPeca(tx, dto, operadorId);
        case 'subitem':
          return this.destinarSubitem(tx, dto, operadorId);
        case 'entrada':
          return this.destinarEntrada(tx, dto, operadorId);
      }
    });
    this.eventEmitter.emit(EVENTOS.ESTOQUE_ITEM_DESTINADO, {
      tipo: dto.tipo,
      id: dto.id,
      pedidoVendaItemId: dto.pedidoVendaItemId,
      dataOperacao: resultado.dataOperacao,
    });
    return resultado.item;
  }

  // ── peça ────────────────────────────────────────────────────────────────

  private async destinarPeca(tx: Tx, dto: DestinarDto, operadorId: string) {
    const peca = await tx
      .select()
      .from(pecas)
      .where(and(eq(pecas.id, dto.id), isNull(pecas.deletedAt)))
      .for('update')
      .then((r) => r[0] ?? null);
    if (!peca) throw new NotFoundException('Peça não encontrada');
    if (peca.statusPeca !== 'em_sobra') {
      throw new ConflictException({ codigo: 'ITEM_NAO_DISPONIVEL', mensagem: 'Peça não está disponível em estoque' });
    }

    const item = await this.buscarItemPedidoCompativel(tx, peca.produtoBaseId, dto.pedidoVendaItemId);

    const consumido = await consumirSaldo(tx, dto.pedidoVendaItemId);
    if (!consumido) throw new ConflictException({ codigo: 'ITEM_DO_PEDIDO_COMPLETO', mensagem: 'Item do pedido já está completo' });

    const atualizada = primeiroOuFalha(
      await tx
        .update(pecas)
        .set({ statusPeca: 'associada', pedidoVendaId: item.pedidoVendaId, pedidoVendaItemId: item.id })
        .where(eq(pecas.id, dto.id))
        .returning(),
    );

    await tx.insert(associacoesPecaHistorico).values({
      pecaId: dto.id,
      acao: 'destinar_estoque',
      pedidoDestinoId: item.pedidoVendaId,
      pedidoItemDestinoId: item.id,
      operadorId,
      statusExpedicaoNoMomento: 'aberta',
      compraProgramadaOrigemId: peca.compraProgramadaId,
      recebimentoOrigemId: peca.recebimentoId,
    });

    await this.auditoria.registrar(tx, {
      tabela: 'pecas', registroId: dto.id, operacao: 'UPDATE', modulo: 'operacao',
      usuarioId: operadorId, dadosAnteriores: peca, dadosNovos: atualizada,
    });

    return { item: atualizada, dataOperacao: await this.dataOperacaoDaPeca(tx, peca.recebimentoId) };
  }

  // ── subitem ─────────────────────────────────────────────────────────────

  private async destinarSubitem(tx: Tx, dto: DestinarDto, operadorId: string) {
    const subitem = await tx
      .select()
      .from(subitens)
      .where(and(eq(subitens.id, dto.id), isNull(subitens.deletedAt)))
      .for('update')
      .then((r) => r[0] ?? null);
    if (!subitem) throw new NotFoundException('Subitem não encontrado');
    if (subitem.statusSubitem !== 'em_sobra') {
      throw new ConflictException({ codigo: 'ITEM_NAO_DISPONIVEL', mensagem: 'Subitem não está disponível em estoque' });
    }

    const item = await this.buscarItemPedidoCompativel(tx, subitem.produtoId, dto.pedidoVendaItemId);

    const consumido = await consumirSaldo(tx, dto.pedidoVendaItemId);
    if (!consumido) throw new ConflictException({ codigo: 'ITEM_DO_PEDIDO_COMPLETO', mensagem: 'Item do pedido já está completo' });

    const atualizado = primeiroOuFalha(
      await tx
        .update(subitens)
        .set({ statusSubitem: 'associado', pedidoVendaId: item.pedidoVendaId, pedidoVendaItemId: item.id })
        .where(eq(subitens.id, dto.id))
        .returning(),
    );

    const pecaOrigem = await tx
      .select({
        compraProgramadaId: pecas.compraProgramadaId,
        recebimentoId: pecas.recebimentoId,
      })
      .from(pecas)
      .where(eq(pecas.id, subitem.pecaOrigemId))
      .then((r) => r[0] ?? null);
    if (!pecaOrigem) throw new NotFoundException('Peça de origem do subitem não encontrada');

    await tx.insert(associacoesPecaHistorico).values({
      subitemId: dto.id,
      acao: 'destinar_estoque',
      pedidoDestinoId: item.pedidoVendaId,
      pedidoItemDestinoId: item.id,
      operadorId,
      statusExpedicaoNoMomento: 'aberta',
      compraProgramadaOrigemId: pecaOrigem.compraProgramadaId,
      recebimentoOrigemId: pecaOrigem.recebimentoId,
    });

    await this.auditoria.registrar(tx, {
      tabela: 'subitens', registroId: dto.id, operacao: 'UPDATE', modulo: 'operacao',
      usuarioId: operadorId, dadosAnteriores: subitem, dadosNovos: atualizado,
    });

    return { item: atualizado, dataOperacao: await this.dataOperacaoDoSubitem(tx, subitem.pecaOrigemId) };
  }

  // ── entrada ─────────────────────────────────────────────────────────────

  private async destinarEntrada(tx: Tx, dto: DestinarDto, operadorId: string) {
    const qtd = dto.quantidade!;
    const entrada = await tx
      .select()
      .from(entradasItens)
      .where(and(eq(entradasItens.id, dto.id), isNull(entradasItens.deletedAt)))
      .for('update')
      .then((r) => r[0] ?? null);
    if (!entrada) throw new NotFoundException('Entrada não encontrada');
    if (entrada.quantidade - entrada.quantidadeDestinada < qtd) {
      throw new ConflictException({ codigo: 'SALDO_INSUFICIENTE', mensagem: 'Saldo da entrada insuficiente' });
    }

    const item = await tx
      .select({
        id: pedidosVendaItens.id,
        pedidoVendaId: pedidosVendaItens.pedidoVendaId,
      })
      .from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.id, dto.pedidoVendaItemId))
      .then((r) => r[0] ?? null);
    if (!item) throw new NotFoundException('Item de pedido não encontrado');

    const consumo = await tx.execute(sql`
      UPDATE pedidos_venda_itens SET quantidade_atendida = quantidade_atendida + ${qtd}, updated_at = now()
      WHERE id = ${dto.pedidoVendaItemId} AND quantidade_atendida + ${qtd} <= quantidade_pedida
      RETURNING id`);
    if (consumo.rows.length === 0) {
      throw new ConflictException({ codigo: 'ITEM_DO_PEDIDO_COMPLETO', mensagem: 'Item do pedido não tem saldo suficiente' });
    }

    const atualizada = primeiroOuFalha(
      await tx
        .update(entradasItens)
        .set({
          quantidadeDestinada: sql`${entradasItens.quantidadeDestinada} + ${qtd}`,
          pedidoId: item.pedidoVendaId,
          pedidoVendaItemId: dto.pedidoVendaItemId,
        })
        .where(eq(entradasItens.id, dto.id))
        .returning(),
    );

    await this.auditoria.registrar(tx, {
      tabela: 'entradas_itens', registroId: dto.id, operacao: 'UPDATE', modulo: 'operacao',
      usuarioId: operadorId, dadosAnteriores: entrada, dadosNovos: atualizada,
    });

    return { item: atualizada, dataOperacao: await this.dataOperacaoDoPedido(tx, item.pedidoVendaId) };
  }

  // ── internos ────────────────────────────────────────────────────────────

  private async buscarItemPedidoCompativel(tx: Tx, produtoBaseId: string, pedidoVendaItemId: string) {
    const item = await tx
      .select({
        id: pedidosVendaItens.id,
        pedidoVendaId: pedidosVendaItens.pedidoVendaId,
        produtoId: pedidosVendaItens.produtoId,
        statusPedido: pedidosVenda.status,
        deletedAt: pedidosVenda.deletedAt,
      })
      .from(pedidosVendaItens)
      .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
      .where(eq(pedidosVendaItens.id, pedidoVendaItemId))
      .then((r) => r[0] ?? null);

    if (!item || item.deletedAt) throw new NotFoundException('Item de pedido não encontrado');
    if (item.statusPedido === 'cancelado') {
      throw new ConflictException({ codigo: 'ITEM_INCOMPATIVEL', mensagem: 'Pedido cancelado não aceita destinação' });
    }
    if (item.produtoId !== produtoBaseId) {
      throw new ConflictException({ codigo: 'ITEM_INCOMPATIVEL', mensagem: 'Item de pedido incompatível com o item de estoque' });
    }
    return item;
  }

  private async dataOperacaoDaPeca(tx: Tx, recebimentoId: string): Promise<string> {
    const r = await tx
      .select({ dataOperacao: operacoes.data })
      .from(recebimentos)
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(eq(recebimentos.id, recebimentoId))
      .then((rows) => rows[0] ?? null);
    return r?.dataOperacao ?? '';
  }

  private async dataOperacaoDoSubitem(tx: Tx, pecaOrigemId: string): Promise<string> {
    const r = await tx
      .select({ dataOperacao: operacoes.data })
      .from(pecas)
      .innerJoin(recebimentos, eq(pecas.recebimentoId, recebimentos.id))
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(eq(pecas.id, pecaOrigemId))
      .then((rows) => rows[0] ?? null);
    return r?.dataOperacao ?? '';
  }

  private async dataOperacaoDoPedido(tx: Tx, pedidoVendaId: string): Promise<string> {
    const r = await tx
      .select({ dataOperacao: operacoes.data })
      .from(pedidosVenda)
      .innerJoin(operacoes, eq(operacoes.id, pedidosVenda.operacaoId))
      .where(eq(pedidosVenda.id, pedidoVendaId))
      .then((rows) => rows[0] ?? null);
    return r?.dataOperacao ?? '';
  }
}
