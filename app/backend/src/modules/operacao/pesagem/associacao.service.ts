import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { operacoes,
  associacoesPecaHistorico,
  comprasProgramadas,
  pecas,
  pedidosVenda,
  pedidosVendaItens,
  recebimentos,
  recebimentosItens,
 } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { DivergenciaRecebimentoService } from '../recebimento/divergencia/divergencia-recebimento.service';
import type { SugestaoScored } from './associacao-score';
import type { ConfirmarAssociacaoDto, RedirecionarDto, SemCoberturaDto } from './dto/associacao.dto';
import type { EstornarDto } from './dto/estorno.dto';
import { EtiquetaService } from './etiqueta.service';
import { pecaEmCargaFechada } from './carga-fechada';
import { consumirSaldo, devolverSaldo } from './saldo';
import { calcularCompativeisItem, caracteristicasDeCapturaMeta } from './compatibilidade';

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
    private readonly etiqueta: EtiquetaService,
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
    const compativeis = await calcularCompativeisItem(this.db, await this.paramsCompativeis(this.db, peca));
    return { pecaId, sugestao: compativeis[0] ?? null, compativeis };
  }

  /** Só pedidos compatíveis e abertos com saldo (RF-PS-16/17). */
  async listarCompativeis(pecaId: string): Promise<SugestaoScored[]> {
    const peca = await this.buscarAtiva(this.db, pecaId);
    if (!peca) throw new NotFoundException('Peça não encontrada');
    return calcularCompativeisItem(this.db, await this.paramsCompativeis(this.db, peca));
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
      const compativeis = await calcularCompativeisItem(tx, await this.paramsCompativeis(tx, peca));
      const sugerido = compativeis.find((c) => c.pedidoVendaItemId === dto.pedidoVendaItemId) ?? null;

      const consumido = await consumirSaldo(tx, dto.pedidoVendaItemId);
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

      const consumido = await consumirSaldo(tx, dto.pedidoVendaItemId);
      if (!consumido) throw new ConflictException('Item de destino já está completo');

      // Devolve a unidade ao item de origem (CHECK >= 0 é backstop).
      await devolverSaldo(tx, peca.pedidoVendaItemId);

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
        await devolverSaldo(tx, peca.pedidoVendaItemId);
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

  /**
   * Estorno de destinação já confirmada (D6.3). Devolve a unidade ao item do pedido,
   * volta a peça para em_sobra, cancela a etiqueta vigente e grava histórico + auditoria.
   * Bloqueado com 409 depois que a carga fecha (D6.18). Exige ASSOCIACAO_ESTORNAR.
   */
  async estornar(pecaId: string, dto: EstornarDto, operadorId: string): Promise<Peca> {
    const resultado = await this.db.transaction(async (tx) => {
      const peca = await tx
        .select()
        .from(pecas)
        .where(and(eq(pecas.id, pecaId), isNull(pecas.deletedAt)))
        .for('update')
        .then((r) => r[0] ?? null);
      if (!peca) throw new NotFoundException('Peça não encontrada');
      if (peca.statusPeca !== 'associada' || !peca.pedidoVendaItemId) {
        throw new ConflictException('Só é possível estornar peça associada a um pedido');
      }
      if (await pecaEmCargaFechada(tx, pecaId)) {
        throw new ConflictException('Peça já está em carga fechada — estorno bloqueado');
      }

      const pedidoOrigemId = peca.pedidoVendaId;
      const pedidoItemOrigemId = peca.pedidoVendaItemId;

      // Devolve a unidade ao item do pedido (RF-PS-17: quantidade_atendida volta a caber).
      await devolverSaldo(tx, pedidoItemOrigemId);

      const atualizada = primeiroOuFalha(
        await tx
          .update(pecas)
          .set({
            statusPeca: 'em_sobra',
            pedidoVendaId: null,
            pedidoVendaItemId: null,
            observacoes: dto.observacoes ?? peca.observacoes,
          })
          .where(eq(pecas.id, pecaId))
          .returning(),
      );

      // "invalida a etiqueta anterior" — texto do protótipo em PesagemDestinacao.tsx:241.
      const etiquetaCancelada = await this.etiqueta.cancelarVigenteNaTx(tx, pecaId, dto.motivo, operadorId);

      await this.gravarHistorico(tx, {
        pecaId,
        acao: 'estorno',
        pedidoOrigemId,
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

      return {
        peca: atualizada,
        pedidoOrigemId,
        pedidoItemOrigemId,
        etiquetaCancelada,
        dataOperacao: await this.dataOperacaoDaPeca(tx, peca),
      };
    });

    this.eventEmitter.emit(EVENTOS.PESAGEM_ESTORNADA, {
      pecaId,
      dataOperacao: resultado.dataOperacao,
      pedidoOrigemId: resultado.pedidoOrigemId,
      pedidoItemOrigemId: resultado.pedidoItemOrigemId,
      motivo: dto.motivo,
    });
    if (resultado.etiquetaCancelada) {
      this.eventEmitter.emit(EVENTOS.ETIQUETA_INVALIDADA, {
        etiquetaId: resultado.etiquetaCancelada.id,
        pecaId,
        dataOperacao: resultado.dataOperacao,
        estado: 'cancelada',
        motivo: dto.motivo,
      });
    }

    return resultado.peca;
  }

  // ── internos ───────────────────────────────────────────────────────────────

  /** Valida que o item existe, é compatível e pertence à operação da peça. */
  private async buscarItemCompativel(tx: Tx, peca: Peca, pedidoVendaItemId: string) {
    const item = await tx
      .select({
        id: pedidosVendaItens.id,
        pedidoVendaId: pedidosVendaItens.pedidoVendaId,
        produtoId: pedidosVendaItens.produtoId,
        operacaoId: pedidosVenda.operacaoId,
        pecaOperacaoId: sql<string>`(
          select cp.operacao_id from compras_programadas cp where cp.id = ${peca.compraProgramadaId}
        )`,
        statusPedido: pedidosVenda.status,
        deletedAt: pedidosVenda.deletedAt,
      })
      .from(pedidosVendaItens)
      .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
      .where(eq(pedidosVendaItens.id, pedidoVendaItemId))
      .then((r) => r[0] ?? null);

    if (!item || item.deletedAt) throw new NotFoundException('Item de pedido não encontrado');
    if (item.statusPedido === 'cancelado') throw new ConflictException('Pedido cancelado não aceita associação');
    if (item.produtoId !== peca.produtoBaseId) {
      throw new ConflictException('Item de pedido incompatível com a peça');
    }
    if (item.operacaoId !== item.pecaOperacaoId) {
      throw new ConflictException('Pedido pertence a outra operação');
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
          eq(recebimentosItens.produtoId, peca.produtoBaseId),
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
      acao: 'confirmar' | 'redirecionar' | 'sobra' | 'analise' | 'corte' | 'divergencia'
        | 'estorno' | 'troca_saida' | 'troca_entrada';
      pedidoOrigemId?: string | null;
      pedidoDestinoId?: string | null;
      pedidoItemDestinoId?: string | null;
      motivo?: string | null;
      scoreSugerido?: number | null;
      justificativaSugerida?: string | null;
      operadorId: string;
    },
  ): Promise<void> {
    const origem = await this.carregarOrigemFisica(tx, h.pecaId);
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
      compraProgramadaOrigemId: origem.compraProgramadaId,
      recebimentoOrigemId: origem.recebimentoId,
      // Expedição é F5: enquanto não existe fechamento, o momento é 'aberta'.
      statusExpedicaoNoMomento: 'aberta',
    });
  }

  private async carregarOrigemFisica(
    tx: Tx,
    pecaId: string,
  ): Promise<{ compraProgramadaId: string; recebimentoId: string }> {
    const origem = await tx
      .select({
        compraProgramadaId: pecas.compraProgramadaId,
        recebimentoId: pecas.recebimentoId,
      })
      .from(pecas)
      .where(eq(pecas.id, pecaId))
      .then((r) => r[0] ?? null);
    if (!origem) throw new NotFoundException('Peça não encontrada');
    return origem;
  }

  private async dataOperacaoDaPeca(tx: Tx, peca: Peca): Promise<string> {
    const r = await tx
      .select({ dataOperacao: operacoes.data })
      .from(recebimentos)
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(eq(recebimentos.id, peca.recebimentoId))
      .then((rows) => rows[0] ?? null);
    return r?.dataOperacao ?? '';
  }

  private async paramsCompativeis(tx: Tx, peca: Peca) {
    const [compra] = await tx
      .select({ operacaoId: comprasProgramadas.operacaoId })
      .from(comprasProgramadas)
      .where(eq(comprasProgramadas.id, peca.compraProgramadaId));
    if (!compra) throw new NotFoundException('Operação da peça não encontrada');
    return {
      operacaoId: compra.operacaoId,
      compraProgramadaOrigemId: peca.compraProgramadaId,
      produtoId: peca.produtoBaseId,
      peso: peca.pesoOriginal,
      caracteristicas: caracteristicasDeCapturaMeta(peca.capturaMeta),
    };
  }

  private async buscarAtiva(tx: Tx, id: string): Promise<Peca | null> {
    return tx
      .select()
      .from(pecas)
      .where(and(eq(pecas.id, id), isNull(pecas.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
