import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  associacoesPecaHistorico,
  clientes,
  pecas,
  pedidosVenda,
  pedidosVendaItens,
  recebimentos,
  recebimentosItens,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { subtrairQtd } from '../../../common/crud/decimal';
import { EVENTOS } from '../../../realtime/events/eventos';
import { DivergenciaRecebimentoService } from '../recebimento/divergencia/divergencia-recebimento.service';
import { calcularScores, type CandidatoPedido, type SugestaoScored } from './associacao-score';
import type { ConfirmarAssociacaoDto, RedirecionarDto, SemCoberturaDto } from './dto/associacao.dto';

type Tx = NodePgDatabase<typeof schema>;
type Peca = typeof pecas.$inferSelect;

export interface ResultadoSugestao {
  pecaId: string;
  sugestao: SugestaoScored | null;
  compativeis: SugestaoScored[];
}

@Injectable()
export class AssociacaoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly divergencias: DivergenciaRecebimentoService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /**
   * Sugestão EFÊMERA (RF-PS-08/09/10): calcula sob demanda o melhor pedido e a
   * lista de compatíveis. Nunca vincula — só recomenda com justificativa.
   */
  async sugerir(pecaId: string): Promise<ResultadoSugestao> {
    const peca = await this.buscarAtiva(this.db, pecaId);
    if (!peca) throw new NotFoundException('Peça não encontrada');
    const compativeis = await this.calcularCompativeis(this.db, peca);
    return { pecaId, sugestao: compativeis[0] ?? null, compativeis };
  }

  /** Só pedidos compatíveis e abertos com saldo (RF-PS-16/17). */
  async listarCompativeis(pecaId: string): Promise<SugestaoScored[]> {
    const peca = await this.buscarAtiva(this.db, pecaId);
    if (!peca) throw new NotFoundException('Peça não encontrada');
    return this.calcularCompativeis(this.db, peca);
  }

  /**
   * Confirma a associação por unidade (RF-PS-09). UPDATE atômico condicional
   * incrementa quantidade_atendida só enquanto < quantidade_pedida — bloqueia item
   * completo (409, RF-PS-17) e é anti-overbooking sob concorrência. Grava o snapshot
   * da sugestão no histórico. Evento peca_associada pós-commit.
   */
  async confirmar(pecaId: string, dto: ConfirmarAssociacaoDto, operadorId: string): Promise<Peca> {
    const resultado = await this.db.transaction(async (tx) => {
      const peca = await this.buscarAtiva(tx, pecaId);
      if (!peca) throw new NotFoundException('Peça não encontrada');
      if (peca.statusPeca === 'associada') throw new ConflictException('Peça já associada — use redirecionar');

      const item = await this.buscarItemCompativel(tx, peca, dto.pedidoVendaItemId);

      // Snapshot da sugestão no momento da decisão (a sugestão é efêmera).
      const compativeis = await this.calcularCompativeis(tx, peca);
      const sugerido = compativeis.find((c) => c.pedidoVendaItemId === dto.pedidoVendaItemId) ?? null;

      const consumido = await this.consumirSaldo(tx, dto.pedidoVendaItemId);
      if (!consumido) throw new ConflictException('Item do pedido já está completo');

      const atualizada = primeiroOuFalha(
        await tx
          .update(pecas)
          .set({ statusPeca: 'associada', pedidoVendaId: item.pedidoVendaId, pedidoVendaItemId: item.id })
          .where(eq(pecas.id, pecaId))
          .returning(),
      );

      await this.gravarHistorico(tx, {
        pecaId,
        acao: 'confirmar',
        pedidoDestinoId: item.pedidoVendaId,
        pedidoItemDestinoId: item.id,
        scoreSugerido: sugerido?.score ?? null,
        justificativaSugerida: sugerido?.justificativa ?? null,
        operadorId,
      });

      await this.auditoria.registrar(tx, {
        tabela: 'pecas',
        registroId: pecaId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: peca,
        dadosNovos: atualizada,
      });

      return { peca: atualizada, dataOperacao: await this.dataOperacaoDaPeca(tx, peca) };
    });

    this.eventEmitter.emit(EVENTOS.PECA_ASSOCIADA, {
      pecaId,
      dataOperacao: resultado.dataOperacao,
      pedidoVendaId: resultado.peca.pedidoVendaId!,
      pedidoVendaItemId: resultado.peca.pedidoVendaItemId!,
    });

    return resultado.peca;
  }

  /**
   * Transfere a peça entre pedidos enquanto a expedição está aberta (RT-006-03):
   * devolve 1 unidade ao item origem e consome 1 no destino (UPDATE condicional),
   * reaponta a peça, grava histórico origem→destino + auditoria. Caminhão é F5.
   */
  async redirecionar(pecaId: string, dto: RedirecionarDto, operadorId: string): Promise<Peca> {
    const resultado = await this.db.transaction(async (tx) => {
      const peca = await this.buscarAtiva(tx, pecaId);
      if (!peca) throw new NotFoundException('Peça não encontrada');
      if (peca.statusPeca !== 'associada' || !peca.pedidoVendaItemId) {
        throw new ConflictException('Só é possível redirecionar peça já associada');
      }
      if (peca.pedidoVendaItemId === dto.pedidoVendaItemId) {
        throw new ConflictException('Peça já está neste item do pedido');
      }

      const destino = await this.buscarItemCompativel(tx, peca, dto.pedidoVendaItemId);

      const consumido = await this.consumirSaldo(tx, dto.pedidoVendaItemId);
      if (!consumido) throw new ConflictException('Item de destino já está completo');

      // Devolve a unidade ao item de origem (CHECK >= 0 é backstop).
      await tx
        .update(pedidosVendaItens)
        .set({ quantidadeAtendida: sql`${pedidosVendaItens.quantidadeAtendida} - 1` })
        .where(eq(pedidosVendaItens.id, peca.pedidoVendaItemId));

      const pedidoOrigemId = peca.pedidoVendaId;
      const atualizada = primeiroOuFalha(
        await tx
          .update(pecas)
          .set({ pedidoVendaId: destino.pedidoVendaId, pedidoVendaItemId: destino.id })
          .where(eq(pecas.id, pecaId))
          .returning(),
      );

      await this.gravarHistorico(tx, {
        pecaId,
        acao: 'redirecionar',
        pedidoOrigemId,
        pedidoDestinoId: destino.pedidoVendaId,
        pedidoItemDestinoId: destino.id,
        motivo: dto.motivo,
        operadorId,
      });

      await this.auditoria.registrar(tx, {
        tabela: 'pecas',
        registroId: pecaId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: peca,
        dadosNovos: atualizada,
      });

      return { peca: atualizada, pedidoOrigemId, dataOperacao: await this.dataOperacaoDaPeca(tx, peca) };
    });

    this.eventEmitter.emit(EVENTOS.PECA_REDIRECIONADA, {
      pecaId,
      dataOperacao: resultado.dataOperacao,
      pedidoOrigemId: resultado.pedidoOrigemId,
      pedidoDestinoId: resultado.peca.pedidoVendaId!,
    });

    return resultado.peca;
  }

  /**
   * Destina peça sem cobertura (RF-PS-11/21/22): sobra (exige motivo), análise,
   * corte (mantém vínculo rastreável para F4c) ou divergência (reusa F4a). Histórico
   * + auditoria; evento de redirecionamento (mudança de destinação rastreável).
   */
  async semCobertura(pecaId: string, dto: SemCoberturaDto, operadorId: string): Promise<Peca> {
    const mapaStatus = {
      sobra: 'em_sobra',
      analise: 'em_analise',
      corte: 'para_corte',
      divergencia: 'divergente',
    } as const;

    const resultado = await this.db.transaction(async (tx) => {
      const peca = await this.buscarAtiva(tx, pecaId);
      if (!peca) throw new NotFoundException('Peça não encontrada');

      // Corte mantém o vínculo com o pedido (rastreável para F4c); demais limpam.
      const manterVinculo = dto.destino === 'corte';
      const atualizada = primeiroOuFalha(
        await tx
          .update(pecas)
          .set({
            statusPeca: mapaStatus[dto.destino],
            pedidoVendaId: manterVinculo ? peca.pedidoVendaId : null,
            pedidoVendaItemId: manterVinculo ? peca.pedidoVendaItemId : null,
            observacoes: dto.motivo ?? peca.observacoes,
          })
          .where(eq(pecas.id, pecaId))
          .returning(),
      );

      // Se a peça estava associada e sai do vínculo, devolve a unidade ao saldo.
      if (!manterVinculo && peca.pedidoVendaItemId) {
        await tx
          .update(pedidosVendaItens)
          .set({ quantidadeAtendida: sql`${pedidosVendaItens.quantidadeAtendida} - 1` })
          .where(eq(pedidosVendaItens.id, peca.pedidoVendaItemId));
      }

      if (dto.destino === 'divergencia' && dto.divergencia) {
        const item = await this.buscarRecebimentoItem(tx, peca);
        await this.divergencias.abrirNaTx(
          tx,
          { recebimentoId: peca.recebimentoId, recebimentoItemId: item.id, ...dto.divergencia },
          operadorId,
        );
      }

      await this.gravarHistorico(tx, {
        pecaId,
        acao: dto.destino,
        pedidoOrigemId: peca.pedidoVendaId,
        motivo: dto.motivo,
        operadorId,
      });

      await this.auditoria.registrar(tx, {
        tabela: 'pecas',
        registroId: pecaId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: peca,
        dadosNovos: atualizada,
      });

      return atualizada;
    });

    return resultado;
  }

  // ── internos ───────────────────────────────────────────────────────────────

  /** Incrementa atendida só enquanto < pedida (anti-overbooking). false = completo. */
  private async consumirSaldo(tx: Tx, pedidoVendaItemId: string): Promise<boolean> {
    const r = await tx
      .update(pedidosVendaItens)
      .set({ quantidadeAtendida: sql`${pedidosVendaItens.quantidadeAtendida} + 1` })
      .where(
        and(
          eq(pedidosVendaItens.id, pedidoVendaItemId),
          sql`${pedidosVendaItens.quantidadeAtendida} < ${pedidosVendaItens.quantidadePedida}`,
        ),
      )
      .returning({ id: pedidosVendaItens.id });
    return r.length > 0;
  }

  private async calcularCompativeis(tx: Tx, peca: Peca): Promise<SugestaoScored[]> {
    // Candidatos: itens de pedidos da MESMA compra (RN-02), abertos, do mesmo item
    // comercial, com saldo pendente (pedida − atendida) > 0 (RF-PS-16/17).
    const linhas = await tx
      .select({
        pedidoVendaId: pedidosVenda.id,
        pedidoVendaItemId: pedidosVendaItens.id,
        itemComercialId: pedidosVendaItens.itemComercialId,
        clienteId: pedidosVenda.clienteId,
        quantidadePedida: pedidosVendaItens.quantidadePedida,
        quantidadeAtendida: pedidosVendaItens.quantidadeAtendida,
        prioridade: pedidosVenda.prioridade,
        rotaPrevista: pedidosVenda.rotaPrevista,
        preferenciasCliente: clientes.preferenciasJson,
      })
      .from(pedidosVendaItens)
      .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
      .innerJoin(clientes, eq(pedidosVenda.clienteId, clientes.id))
      .where(
        and(
          eq(pedidosVenda.compraProgramadaId, peca.compraProgramadaId),
          eq(pedidosVendaItens.itemComercialId, peca.itemComercialBaseId),
          isNull(pedidosVenda.deletedAt),
          sql`${pedidosVenda.status} <> 'cancelado'`,
          sql`${pedidosVendaItens.status} <> 'cancelado'`,
        ),
      );

    const candidatos: CandidatoPedido[] = linhas.map((l) => {
      const pref = (l.preferenciasCliente ?? {}) as Record<string, unknown>;
      return {
        pedidoVendaId: l.pedidoVendaId,
        pedidoVendaItemId: l.pedidoVendaItemId,
        itemComercialId: l.itemComercialId,
        clienteId: l.clienteId,
        saldoPendente: subtrairQtd(l.quantidadePedida, l.quantidadeAtendida),
        prioridade: l.prioridade,
        rotaPrevista: l.rotaPrevista,
        preferencias: {
          faixaPesoMin: typeof pref.faixaPesoMin === 'number' ? pref.faixaPesoMin : undefined,
          faixaPesoMax: typeof pref.faixaPesoMax === 'number' ? pref.faixaPesoMax : undefined,
          perfilGordura: typeof pref.perfilGordura === 'string' ? pref.perfilGordura : undefined,
        },
      };
    });

    return calcularScores({ itemComercialBaseId: peca.itemComercialBaseId, pesoOriginal: peca.pesoOriginal }, candidatos);
  }

  /** Valida que o item existe, é compatível e pertence à compra da peça. */
  private async buscarItemCompativel(tx: Tx, peca: Peca, pedidoVendaItemId: string) {
    const item = await tx
      .select({
        id: pedidosVendaItens.id,
        pedidoVendaId: pedidosVendaItens.pedidoVendaId,
        itemComercialId: pedidosVendaItens.itemComercialId,
        compraProgramadaId: pedidosVenda.compraProgramadaId,
        statusPedido: pedidosVenda.status,
        deletedAt: pedidosVenda.deletedAt,
      })
      .from(pedidosVendaItens)
      .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
      .where(eq(pedidosVendaItens.id, pedidoVendaItemId))
      .then((r) => r[0] ?? null);

    if (!item || item.deletedAt) throw new NotFoundException('Item de pedido não encontrado');
    if (item.statusPedido === 'cancelado') throw new ConflictException('Pedido cancelado não aceita associação');
    if (item.itemComercialId !== peca.itemComercialBaseId) {
      throw new ConflictException('Item de pedido incompatível com a peça');
    }
    if (item.compraProgramadaId !== peca.compraProgramadaId) {
      throw new ConflictException('Pedido pertence a outra compra programada');
    }
    return item;
  }

  /** Item de recebimento correspondente ao item comercial da peça (para divergência). */
  private async buscarRecebimentoItem(tx: Tx, peca: Peca) {
    const item = await tx
      .select()
      .from(recebimentosItens)
      .where(
        and(
          eq(recebimentosItens.recebimentoId, peca.recebimentoId),
          eq(recebimentosItens.itemComercialId, peca.itemComercialBaseId),
        ),
      )
      .then((r) => r[0] ?? null);
    if (!item) throw new ConflictException('Item de recebimento não encontrado para abrir divergência');
    return item;
  }

  private async gravarHistorico(
    tx: Tx,
    h: {
      pecaId: string;
      acao: 'confirmar' | 'redirecionar' | 'sobra' | 'analise' | 'corte' | 'divergencia';
      pedidoOrigemId?: string | null;
      pedidoDestinoId?: string | null;
      pedidoItemDestinoId?: string | null;
      motivo?: string | null;
      scoreSugerido?: number | null;
      justificativaSugerida?: string | null;
      operadorId: string;
    },
  ): Promise<void> {
    await tx.insert(associacoesPecaHistorico).values({
      pecaId: h.pecaId,
      acao: h.acao,
      pedidoOrigemId: h.pedidoOrigemId ?? null,
      pedidoDestinoId: h.pedidoDestinoId ?? null,
      pedidoItemDestinoId: h.pedidoItemDestinoId ?? null,
      motivo: h.motivo ?? null,
      scoreSugerido: h.scoreSugerido ?? null,
      justificativaSugerida: h.justificativaSugerida ?? null,
      operadorId: h.operadorId,
      // Expedição é F5: enquanto não existe fechamento, o momento é 'aberta'.
      statusExpedicaoNoMomento: 'aberta',
    });
  }

  private async dataOperacaoDaPeca(tx: Tx, peca: Peca): Promise<string> {
    const r = await tx
      .select({ dataOperacao: recebimentos.dataOperacao })
      .from(recebimentos)
      .where(eq(recebimentos.id, peca.recebimentoId))
      .then((rows) => rows[0] ?? null);
    return r?.dataOperacao ?? '';
  }

  private async buscarAtiva(tx: Tx, id: string): Promise<Peca | null> {
    return tx
      .select()
      .from(pecas)
      .where(and(eq(pecas.id, id), isNull(pecas.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
