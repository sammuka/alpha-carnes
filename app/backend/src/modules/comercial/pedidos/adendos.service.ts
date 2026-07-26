import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { adendosPedido } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { ehZero, formatarQtd, somarListaQtd, somarQtd } from '../../../common/crud/decimal';
import { EVENTOS } from '../../../realtime/events/eventos';
import {
  desafiosParaChallenge,
  PedidosService,
  type PedidoVendaItem,
  type PlanoItem,
} from './pedidos.service';
import type { RegistrarAdendoDto } from './dto/adendo.dto';
import { OverbookingChallengeException } from './overbooking-challenge.exception';

export interface AdendoResultado {
  adendo: typeof adendosPedido.$inferSelect;
  item: PedidoVendaItem;
}

/** Origem do consumo do adendo, derivada do plano da Onda 1 (D27). */
function origemDoAdendo(alocacao: PlanoItem): 'virtual' | 'overbooking' {
  return ehZero(alocacao.deficit) ? 'virtual' : 'overbooking';
}

@Injectable()
export class AdendosService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly pedidos: PedidosService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async registrar(
    pedidoId: string, dto: RegistrarAdendoDto, usuarioId: string, confirmado: boolean,
  ): Promise<AdendoResultado> {
    const resultado = await this.db.transaction(async (tx) => {
      const pedido = await this.pedidos.carregarAbertoParaAdendo(tx, pedidoId);
      const item = await this.pedidos.exigirItemDoPedido(tx, pedidoId, dto.itemComercialId);

      // 1) Planejamento read-only. Assinatura real: (tx, operacaoId, itens).
      const [alocacao] = await this.pedidos.planejarSobLock(tx, pedido.operacaoId, [
        { itemComercialId: dto.itemComercialId, quantidade: dto.quantidadeAdicionada },
      ]);
      if (!alocacao) throw new Error('planejarSobLock não devolveu alocação para o adendo');

      // 2) O challenge é responsabilidade do CHAMADOR: planejarSobLock nunca lança.
      //    Este throw acontece antes de qualquer INSERT/UPDATE → DoD-81.
      const desafios = desafiosParaChallenge([alocacao]);
      if (desafios.length && !confirmado) {
        throw new OverbookingChallengeException(desafios);
      }

      // 3) Incremento do item existente (persistirItensPlanejados sempre INSERE; aqui é UPDATE).
      const anterior = item.quantidadePedida;
      const resultante = somarQtd(anterior, dto.quantidadeAdicionada);
      const reservadaAdicional = somarListaQtd(alocacao.coberturas.map((c) => c.quantidade));
      const overbookingTotal = somarQtd(item.quantidadeOverbooking, alocacao.deficit);
      const [itemAtualizado] = await tx.update(schema.pedidosVendaItens).set({
        quantidadePedida: resultante,
        quantidadeReservada: somarQtd(item.quantidadeReservada, reservadaAdicional),
        quantidadeOverbooking: overbookingTotal,
        status: ehZero(overbookingTotal) ? 'totalmente_reservado' : 'overbooking_confirmado',
        updatedAt: new Date(),
      }).where(eq(schema.pedidosVendaItens.id, item.id)).returning();
      if (!itemAtualizado) throw new Error('Falha ao incrementar o item do pedido no adendo');

      // 4) Reservas e pendência pelo motor da Onda 1, sem duplicar regra.
      const eventos = await this.pedidos.aplicarAlocacaoNoItem(
        tx, pedido, itemAtualizado, alocacao, usuarioId,
      );

      // 5) Histórico append-only + auditoria na MESMA transação (RA-02 / DoD-80).
      const [adendo] = await tx.insert(adendosPedido).values({
        pedidoVendaId: pedido.id,
        pedidoVendaItemId: item.id,
        itemComercialId: dto.itemComercialId,
        operacaoId: pedido.operacaoId,
        quantidadeAnterior: anterior,
        quantidadeAdicionada: formatarQtd(dto.quantidadeAdicionada),
        quantidadeResultante: resultante,
        origemConsumo: origemDoAdendo(alocacao),
        motivo: dto.motivo,
        autorId: usuarioId,
      }).returning();
      if (!adendo) throw new Error('Falha ao registrar o adendo');

      await this.auditoria.registrar(tx, {
        tabela: 'adendos_pedido',
        registroId: adendo.id,
        operacao: 'INSERT',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: { quantidadePedida: anterior },
        dadosNovos: adendo,
        justificativa: dto.motivo,
      });

      eventos.push({
        nome: EVENTOS.ADENDO_REGISTRADO,
        payload: {
          adendoId: adendo.id,
          pedidoVendaId: pedido.id,
          itemComercialId: dto.itemComercialId,
          quantidadeAdicionada: adendo.quantidadeAdicionada,
          origemConsumo: origemDoAdendo(alocacao),
        },
      });
      return { adendo, item: itemAtualizado, eventos };
    });

    // Eventos SEMPRE fora da transação (RA-04), no padrão real do repositório:
    // EventEmitter2 injetado, um emit por evento — igual a emitirEventosPosCommit.
    for (const evento of resultado.eventos) {
      this.eventEmitter.emit(evento.nome, evento.payload);
    }
    return { adendo: resultado.adendo, item: resultado.item };
  }

  /** Linha do tempo do pedido: histórico append-only, mais novo primeiro. */
  async listar(pedidoId: string) {
    return this.db.select().from(adendosPedido)
      .where(eq(adendosPedido.pedidoVendaId, pedidoId))
      .orderBy(desc(adendosPedido.criadoEm));
  }
}
