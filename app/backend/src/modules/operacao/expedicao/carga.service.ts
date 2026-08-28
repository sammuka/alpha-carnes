import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  associacoesPecaHistorico,
  cargaItens,
  pecas,
  pedidosVenda,
  pedidosVendaItens,
  subitens,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { consumirSaldo, devolverSaldo } from '../pesagem/saldo';
import { validarElegibilidadePeca, validarElegibilidadeSubitem } from './elegibilidade';
import { expedicaoAberta, type StatusCaminhao } from './transicoes';
import { CaminhaoService } from './caminhao.service';
import type { AdicionarItemDto, TransferirItemDto } from './dto/expedicao.dto';

type Tx = NodePgDatabase<typeof schema>;
type CargaItem = typeof cargaItens.$inferSelect;

@Injectable()
export class CargaService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly caminhaoService: CaminhaoService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /**
   * Adiciona peça ou subitem à carga. NÃO mexe em saldo.
   * Idempotente dentro do mesmo caminhão.
   */
  async adicionarItem(caminhaoId: string, dto: AdicionarItemDto, operadorId: string): Promise<CargaItem> {
    const resultado = await this.db.transaction(async (tx) => {
      const caminhao = await this.caminhaoService.caminhaoAtivo(tx, caminhaoId);
      if (caminhao.statusCaminhao !== 'em_carga') {
        throw new ConflictException('Caminhão não está em estado de carga');
      }

      // Verificar se item já está em carga ativa
      const cargaExistente = await this.buscarCargaAtivaDoItem(tx, dto);

      if (cargaExistente) {
        if (cargaExistente.caminhaoId === caminhaoId) {
          // Idempotente — mesmo caminhão
          return { item: cargaExistente, isNew: false };
        } else {
          // Outro caminhão → 409 explícito
          throw new ConflictException('Peça/subitem já está em outra carga ativa');
        }
      }

      // Buscar peça ou subitem e validar elegibilidade
      let pedidoVendaId: string;
      let pedidoVendaItemId: string;

      if (dto.tipoOrigem === 'peca') {
        const peca = await tx
          .select()
          .from(pecas)
          .where(and(eq(pecas.id, dto.id), isNull(pecas.deletedAt)))
          .then((r) => r[0] ?? null);
        if (!peca) throw new NotFoundException('Peça não encontrada');
        validarElegibilidadePeca(peca);
        pedidoVendaId = peca.pedidoVendaId!;
        pedidoVendaItemId = peca.pedidoVendaItemId!;
      } else {
        const sub = await tx
          .select()
          .from(subitens)
          .where(and(eq(subitens.id, dto.id), isNull(subitens.deletedAt)))
          .then((r) => r[0] ?? null);
        if (!sub) throw new NotFoundException('Subitem não encontrado');
        validarElegibilidadeSubitem(sub);
        pedidoVendaId = sub.pedidoVendaId!;
        pedidoVendaItemId = sub.pedidoVendaItemId!;
      }

      const item = primeiroOuFalha(
        await tx
          .insert(cargaItens)
          .values({
            caminhaoId,
            tipoOrigem: dto.tipoOrigem,
            pecaId: dto.tipoOrigem === 'peca' ? dto.id : null,
            subitemId: dto.tipoOrigem === 'subitem' ? dto.id : null,
            pedidoVendaId,
            pedidoVendaItemId,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'carga_itens',
        registroId: item.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: item,
      });

      return { item, isNew: true, dataOperacao: await this.caminhaoService.dataOperacaoDoCaminhao(tx, caminhao) };
    });

    if (resultado.isNew) {
      this.eventEmitter.emit(EVENTOS.CARGA_ITEM_ADICIONADO, {
        caminhaoId,
        cargaItemId: resultado.item.id,
        tipoOrigem: resultado.item.tipoOrigem as 'peca' | 'subitem',
        pecaId: resultado.item.pecaId ?? undefined,
        subitemId: resultado.item.subitemId ?? undefined,
        pedidoVendaId: resultado.item.pedidoVendaId,
        dataOperacao: resultado.dataOperacao ?? '',
      });
    }

    return resultado.item;
  }

  /** Transfere item para outro pedido. Atômico: consome saldo destino → devolve saldo origem. */
  async transferir(cargaItemId: string, dto: TransferirItemDto, operadorId: string): Promise<CargaItem> {
    const resultado = await this.db.transaction(async (tx) => {
      const item = await this.cargaItemAtivo(tx, cargaItemId);
      const caminhao = await this.caminhaoService.caminhaoAtivo(tx, item.caminhaoId);

      if (!expedicaoAberta(caminhao.statusCaminhao as StatusCaminhao)) {
        throw new ConflictException('Transferência só permitida com expedição aberta');
      }
      if (item.statusCargaItem === 'removido') {
        throw new ConflictException('Item removido não pode ser transferido');
      }

      // Validar pedido destino
      const itemDestino = await tx
        .select({
          id: pedidosVendaItens.id,
          pedidoVendaId: pedidosVendaItens.pedidoVendaId,
          itemComercialId: pedidosVendaItens.itemComercialId,
          statusPedido: pedidosVenda.status,
          compraProgramadaId: pedidosVenda.compraProgramadaId,
          deletedAt: pedidosVenda.deletedAt,
        })
        .from(pedidosVendaItens)
        .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
        .where(eq(pedidosVendaItens.id, dto.pedidoVendaItemDestinoId))
        .then((r) => r[0] ?? null);

      if (!itemDestino || itemDestino.deletedAt) {
        throw new NotFoundException('Item de pedido destino não encontrado');
      }
      if (itemDestino.statusPedido === 'cancelado') {
        throw new ConflictException('Pedido destino cancelado');
      }
      if (itemDestino.id === item.pedidoVendaItemId) {
        throw new ConflictException('Item já está neste pedido');
      }

      // Compatibilidade por tipo_origem
      let itemComercialOrigem: string;
      let origemCompraId: string;
      let origemRecebimentoId: string;
      if (item.tipoOrigem === 'peca') {
        const peca = await tx
          .select({
            itemComercialBaseId: pecas.itemComercialBaseId,
            compraProgramadaId: pecas.compraProgramadaId,
            recebimentoId: pecas.recebimentoId,
          })
          .from(pecas)
          .where(eq(pecas.id, item.pecaId!))
          .then((r) => r[0]!);
        itemComercialOrigem = peca.itemComercialBaseId;
        origemCompraId = peca.compraProgramadaId;
        origemRecebimentoId = peca.recebimentoId;
        if (peca.compraProgramadaId !== itemDestino.compraProgramadaId) {
          throw new ConflictException('Transferência só permitida dentro da mesma compra programada');
        }
      } else {
        const sub = await tx
          .select({
            itemComercialId: subitens.itemComercialId,
            compraProgramadaId: pecas.compraProgramadaId,
            recebimentoId: pecas.recebimentoId,
          })
          .from(subitens)
          .innerJoin(pecas, eq(subitens.pecaOrigemId, pecas.id))
          .where(eq(subitens.id, item.subitemId!))
          .then((r) => r[0]!);
        itemComercialOrigem = sub.itemComercialId;
        origemCompraId = sub.compraProgramadaId;
        origemRecebimentoId = sub.recebimentoId;
        if (sub.compraProgramadaId !== itemDestino.compraProgramadaId) {
          throw new ConflictException('Transferência só permitida dentro da mesma compra programada');
        }
      }

      if (itemComercialOrigem !== itemDestino.itemComercialId) {
        throw new ConflictException('Item comercial incompatível com o pedido destino');
      }

      // Saldo atômico: consumir destino PRIMEIRO (anti-overbooking), depois devolver origem
      const consumido = await consumirSaldo(tx, dto.pedidoVendaItemDestinoId);
      if (!consumido) throw new ConflictException('Pedido destino já está completo');
      await devolverSaldo(tx, item.pedidoVendaItemId);

      const pedidoOrigemId = item.pedidoVendaId;

      // Atualizar carga_item
      const atualizado = primeiroOuFalha(
        await tx
          .update(cargaItens)
          .set({ pedidoVendaId: itemDestino.pedidoVendaId, pedidoVendaItemId: itemDestino.id })
          .where(eq(cargaItens.id, cargaItemId))
          .returning(),
      );

      // Atualizar peça ou subitem (vínculo de pedido)
      if (item.tipoOrigem === 'peca') {
        await tx
          .update(pecas)
          .set({ pedidoVendaId: itemDestino.pedidoVendaId, pedidoVendaItemId: itemDestino.id })
          .where(eq(pecas.id, item.pecaId!));
      } else {
        await tx
          .update(subitens)
          .set({ pedidoVendaId: itemDestino.pedidoVendaId, pedidoVendaItemId: itemDestino.id })
          .where(eq(subitens.id, item.subitemId!));
      }

      // Histórico (peca_id OU subitem_id conforme tipo_origem)
      await tx.insert(associacoesPecaHistorico).values({
        pecaId: item.tipoOrigem === 'peca' ? item.pecaId : null,
        subitemId: item.tipoOrigem === 'subitem' ? item.subitemId : null,
        pedidoOrigemId,
        pedidoDestinoId: itemDestino.pedidoVendaId,
        pedidoItemDestinoId: itemDestino.id,
        acao: 'redirecionar',
        motivo: dto.motivo,
        operadorId,
        statusExpedicaoNoMomento: caminhao.statusCaminhao,
        compraProgramadaOrigemId: origemCompraId,
        recebimentoOrigemId: origemRecebimentoId,
      });

      await this.auditoria.registrar(tx, {
        tabela: 'carga_itens',
        registroId: cargaItemId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: item,
        dadosNovos: atualizado,
      });

      return { item: atualizado, pedidoOrigemId, dataOperacao: await this.caminhaoService.dataOperacaoDoCaminhao(tx, caminhao) };
    });

    this.eventEmitter.emit(EVENTOS.CARGA_ITEM_TRANSFERIDO, {
      caminhaoId: resultado.item.caminhaoId,
      cargaItemId,
      tipoOrigem: resultado.item.tipoOrigem as 'peca' | 'subitem',
      pedidoOrigemId: resultado.pedidoOrigemId,
      pedidoDestinoId: resultado.item.pedidoVendaId,
      dataOperacao: resultado.dataOperacao,
    });

    return resultado.item;
  }

  /** Remove item da carga. Devolve saldo. */
  async removerItem(cargaItemId: string, motivo: string, operadorId: string): Promise<CargaItem> {
    const resultado = await this.db.transaction(async (tx) => {
      const item = await this.cargaItemAtivo(tx, cargaItemId);
      const caminhao = await this.caminhaoService.caminhaoAtivo(tx, item.caminhaoId);

      if (!expedicaoAberta(caminhao.statusCaminhao as StatusCaminhao)) {
        throw new ConflictException('Remoção só permitida com expedição aberta');
      }
      if (item.statusCargaItem === 'removido') {
        return { item, dataOperacao: await this.caminhaoService.dataOperacaoDoCaminhao(tx, caminhao) };
      }

      await devolverSaldo(tx, item.pedidoVendaItemId);

      const atualizado = primeiroOuFalha(
        await tx
          .update(cargaItens)
          .set({ statusCargaItem: 'removido', observacoes: motivo })
          .where(eq(cargaItens.id, cargaItemId))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'carga_itens',
        registroId: cargaItemId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: item,
        dadosNovos: atualizado,
      });

      return { item: atualizado, dataOperacao: await this.caminhaoService.dataOperacaoDoCaminhao(tx, caminhao) };
    });

    this.eventEmitter.emit(EVENTOS.CARGA_ITEM_REMOVIDO, {
      caminhaoId: resultado.item.caminhaoId,
      cargaItemId,
      tipoOrigem: resultado.item.tipoOrigem as 'peca' | 'subitem',
      dataOperacao: resultado.dataOperacao,
    });

    return resultado.item;
  }

  // ── internos ───────────────────────────────────────────────────────────────

  private async buscarCargaAtivaDoItem(tx: Tx, dto: AdicionarItemDto): Promise<CargaItem | null> {
    const cond =
      dto.tipoOrigem === 'peca'
        ? and(
            eq(cargaItens.pecaId, dto.id),
            ne(cargaItens.statusCargaItem, 'removido'),
            isNull(cargaItens.deletedAt),
          )
        : and(
            eq(cargaItens.subitemId, dto.id),
            ne(cargaItens.statusCargaItem, 'removido'),
            isNull(cargaItens.deletedAt),
          );
    return tx
      .select()
      .from(cargaItens)
      .where(cond)
      .then((r) => r[0] ?? null);
  }

  async cargaItemAtivo(tx: Tx, id: string): Promise<CargaItem> {
    const item = await tx
      .select()
      .from(cargaItens)
      .where(and(eq(cargaItens.id, id), isNull(cargaItens.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!item) throw new NotFoundException('Item de carga não encontrado');
    return item;
  }
}
