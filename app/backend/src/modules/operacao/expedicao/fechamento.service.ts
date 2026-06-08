import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  caminhoes,
  caminhoesPedidos,
  cargaItens,
  conferenciasCarga,
  pedidosVenda,
  pedidosVendaItens,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { assertTransicao, type StatusCaminhao } from './transicoes';
import { CaminhaoService } from './caminhao.service';
import type { FecharDto } from './dto/expedicao.dto';

@Injectable()
export class FechamentoService {
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
   * Fecha a expedição. Exige conferência concluída sem pendências críticas
   * (ou forcado=true com justificativa auditada). Idempotente.
   * Após fechado: CargaService rejeita mutações via expedicaoAberta().
   */
  async fechar(caminhaoId: string, dto: FecharDto, operadorId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const caminhao = await this.caminhaoService.caminhaoAtivo(tx, caminhaoId);
      const status = caminhao.statusCaminhao as StatusCaminhao;

      // Idempotente: já fechado ou além
      if (
        ['fechado', 'liberado_faturamento', 'faturado', 'liberado_saida', 'expedido'].includes(
          status,
        )
      ) {
        return { caminhao, jaFechado: true as const };
      }

      assertTransicao(status, 'fechado');

      // Conferência concluída (mais recente, para não usar dados de um ciclo anterior)
      const conferencia = await tx
        .select()
        .from(conferenciasCarga)
        .where(
          and(
            eq(conferenciasCarga.caminhaoId, caminhaoId),
            eq(conferenciasCarga.statusConferencia, 'concluida'),
            isNull(conferenciasCarga.deletedAt),
          ),
        )
        .orderBy(desc(conferenciasCarga.createdAt))
        .then((r) => r[0] ?? null);

      if (!conferencia) {
        throw new ConflictException('Caminhão não possui conferência concluída');
      }

      const pendencias = conferencia.pendencias as { totalFaltas?: number } | null;
      const temFaltas = (pendencias?.totalFaltas ?? 0) > 0;

      if (temFaltas && !dto.forcado) {
        throw new ConflictException(
          'Conferência possui faltas. Use forcado=true com justificativa para forçar o fechamento',
        );
      }

      const atualizado = primeiroOuFalha(
        await tx
          .update(caminhoes)
          .set({ statusCaminhao: 'fechado', horaFechamentoCarga: new Date() })
          .where(eq(caminhoes.id, caminhaoId))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'caminhoes',
        registroId: caminhaoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: caminhao,
        dadosNovos: {
          ...atualizado,
          forcado: dto.forcado ?? false,
          justificativaForcado: dto.justificativa ?? null,
        },
      });

      return { caminhao: atualizado, jaFechado: false as const };
    });

    if (!resultado.jaFechado) {
      this.eventEmitter.emit(EVENTOS.EXPEDICAO_FECHADA, {
        caminhaoId,
        dataOperacao: resultado.caminhao.dataOperacao,
      });
    }

    return resultado.caminhao;
  }

  /** Reabre a expedição (excepcional, auditado, exige EXPEDICAO_REABRIR — verificado no controller). */
  async reabrir(caminhaoId: string, justificativa: string, operadorId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const caminhao = await this.caminhaoService.caminhaoAtivo(tx, caminhaoId);
      const status = caminhao.statusCaminhao as StatusCaminhao;

      // Só reabrir se fechado (não permite reabrir de liberado_faturamento+ — NF pode ter sido emitida)
      if (status !== 'fechado') {
        throw new ConflictException(
          `Reabertura só permitida de 'fechado'. Status atual: ${status}`,
        );
      }

      // TODO F6: verificar se nota fiscal foi emitida e lançar ConflictException se sim

      assertTransicao(status, 'em_carga');

      // Invalidar a conferência concluída mais recente para exigir novo ciclo completo após reabertura
      const conferenciaExistente = await tx
        .select()
        .from(conferenciasCarga)
        .where(
          and(
            eq(conferenciasCarga.caminhaoId, caminhaoId),
            eq(conferenciasCarga.statusConferencia, 'concluida'),
            isNull(conferenciasCarga.deletedAt),
          ),
        )
        .orderBy(desc(conferenciasCarga.createdAt))
        .then((r) => r[0] ?? null);

      if (conferenciaExistente) {
        await tx
          .update(conferenciasCarga)
          .set({ deletedAt: new Date() })
          .where(eq(conferenciasCarga.id, conferenciaExistente.id));
      }

      const atualizado = primeiroOuFalha(
        await tx
          .update(caminhoes)
          .set({ statusCaminhao: 'em_carga', horaFechamentoCarga: null })
          .where(eq(caminhoes.id, caminhaoId))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'caminhoes',
        registroId: caminhaoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: caminhao,
        dadosNovos: { ...atualizado, justificativaReabertura: justificativa },
      });

      return { caminhao: atualizado };
    });

    this.eventEmitter.emit(EVENTOS.EXPEDICAO_REABERTA, {
      caminhaoId,
      operadorId,
      dataOperacao: resultado.caminhao.dataOperacao,
    });

    return resultado.caminhao;
  }

  /** Romaneio consolidado previsto×real por pedido/cliente da carga. */
  async romaneio(caminhaoId: string) {
    const caminhao = await this.caminhaoService.caminhaoAtivo(this.db, caminhaoId);

    const vinculos = await this.db
      .select()
      .from(caminhoesPedidos)
      .where(and(eq(caminhoesPedidos.caminhaoId, caminhaoId), isNull(caminhoesPedidos.deletedAt)))
      .orderBy(caminhoesPedidos.ordemNaCarga);

    if (vinculos.length === 0) return { caminhao, pedidos: [] };

    const pedidoIds = vinculos.map((v) => v.pedidoVendaId);

    const pedidosData = await this.db
      .select({
        id: pedidosVenda.id,
        clienteId: pedidosVenda.clienteId,
        status: pedidosVenda.status,
      })
      .from(pedidosVenda)
      .where(inArray(pedidosVenda.id, pedidoIds));

    const itensPedido = await this.db
      .select({
        pedidoVendaId: pedidosVendaItens.pedidoVendaId,
        quantidadePedida: pedidosVendaItens.quantidadePedida,
      })
      .from(pedidosVendaItens)
      .where(inArray(pedidosVendaItens.pedidoVendaId, pedidoIds));

    const itensCarga = await this.db
      .select({
        pedidoVendaId: cargaItens.pedidoVendaId,
        statusCargaItem: cargaItens.statusCargaItem,
      })
      .from(cargaItens)
      .where(and(eq(cargaItens.caminhaoId, caminhaoId), isNull(cargaItens.deletedAt)));

    const previstoPorPedido = new Map<string, number>();
    for (const i of itensPedido) {
      previstoPorPedido.set(
        i.pedidoVendaId,
        (previstoPorPedido.get(i.pedidoVendaId) ?? 0) + Number(i.quantidadePedida),
      );
    }

    const realPorPedido = new Map<string, number>();
    for (const c of itensCarga) {
      if (c.statusCargaItem !== 'removido') {
        realPorPedido.set(c.pedidoVendaId, (realPorPedido.get(c.pedidoVendaId) ?? 0) + 1);
      }
    }

    const pedidosMap = new Map(pedidosData.map((p) => [p.id, p]));

    const pedidos = vinculos.map((v) => {
      const pedido = pedidosMap.get(v.pedidoVendaId);
      return {
        pedidoVendaId: v.pedidoVendaId,
        clienteId: pedido?.clienteId ?? null,
        ordemNaCarga: v.ordemNaCarga,
        previsto: previstoPorPedido.get(v.pedidoVendaId) ?? 0,
        carregado: realPorPedido.get(v.pedidoVendaId) ?? 0,
      };
    });

    return { caminhao, pedidos };
  }
}
