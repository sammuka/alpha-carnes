import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  disponibilidadesVirtuais,
  pedidosVenda,
  pedidosVendaItens,
  reservasDisponibilidade,
  clientes,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  calcularRange,
  montarPaginado,
  primeiroOuFalha,
  type ListarQuery,
  type Paginado,
} from '../../../common/crud/paginacao';
import { compararQtd, ehZero, formatarQtd, subtrairQtd } from '../../../common/crud/decimal';
import { EVENTOS } from '../../../realtime/events/eventos';
import { OperacoesService } from '../../operacoes/operacoes.service';
import type { CreatePedidoDto, ReduzirItemDto } from './dto/pedido.dto';

type PedidoVenda = typeof pedidosVenda.$inferSelect;
type Tx = NodePgDatabase<typeof schema>;

interface ReservaAtualizada {
  disponibilidadeId: string;
  itemComercialId: string;
  quantidadeReservada: string;
  quantidadeDisponivel: string;
}

interface ItemSemCobertura {
  pedidoItemId: string;
  itemComercialId: string;
  quantidadePendente: string;
}

@Injectable()
export class PedidosService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly operacoes: OperacoesService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<PedidoVenda>> {
    const { limit, offset } = calcularRange(query);
    const where = query.incluirRemovidos ? undefined : isNull(pedidosVenda.deletedAt);
    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(pedidosVenda).where(where).orderBy(desc(pedidosVenda.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(pedidosVenda).where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  /** Detalhe com rastreabilidade: pedido → cliente → itens → reservas → disponibilidade. */
  async detalhar(id: string) {
    const pedido = await this.db.query.pedidosVenda.findFirst({
      where: and(eq(pedidosVenda.id, id), isNull(pedidosVenda.deletedAt)),
      with: {
        cliente: true,
        itens: { with: { itemComercial: true, reservas: { with: { disponibilidade: true } } } },
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    return pedido;
  }

  /**
   * Cria pedido reservando saldo na criação. Reserva atômica por item (B1):
   * UM UPDATE condicional com LEAST + RETURNING old/new — sem SELECT-then-UPDATE.
   * Reserva parcial: reservadoEfetivo = disp_antes − disp_depois; resto vira
   * quantidadePendente. Sem disponibilidade (S3) → 100% pendente. Decimal exato (S4).
   * Eventos publicados após o commit (ADR-004).
   */
  async criar(dto: CreatePedidoDto, usuarioId: string) {
    const { pedido, reservasAtualizadas, semCobertura } = await this.db.transaction(async (tx) => {
      const { operacao } = await this.operacoes.garantirOperacao(tx, dto.dataOperacao, usuarioId);
      const pedidoCriado = primeiroOuFalha(
        await tx
          .insert(pedidosVenda)
          .values({
            compraProgramadaId: dto.compraProgramadaId,
            clienteId: dto.clienteId,
            dataOperacao: dto.dataOperacao,
            operacaoId: operacao.id,
            dataEntrega: dto.dataEntrega,
            rotaPrevista: dto.rotaPrevista,
            prioridade: dto.prioridade,
            status: 'reservado', // ajustado abaixo conforme cobertura
            observacoesGerais: dto.observacoesGerais,
            usuarioCriacaoId: usuarioId,
          })
          .returning(),
      );

      // Preferências do cliente (rastreabilidade pedido→cliente→preferências).
      const cliente = await tx
        .select({ preferencias: clientes.preferenciasJson, rota: clientes.rotaPadrao })
        .from(clientes)
        .where(eq(clientes.id, dto.clienteId))
        .then((r) => r[0] ?? null);
      const preferencias = cliente?.preferencias ?? {};

      const reservasAtualizadas: ReservaAtualizada[] = [];
      const semCobertura: ItemSemCobertura[] = [];
      let todosTotais = true;

      for (const item of dto.itens) {
        const pedida = formatarQtd(item.quantidadePedida);

        // B1: reserva atômica em UM único statement. A CTE `FOR UPDATE` trava a
        // linha e, sob READ COMMITTED, re-lê o saldo committed mais recente — o
        // reservado efetivo (LEAST(pedida, disponível travado)) é calculado sobre
        // esse valor e retornado direto, sem depender de `RETURNING old.*` (que,
        // no PG18 sob EvalPlanQual, devolveria o snapshot obsoleto da transação).
        // Não é SELECT-depois-UPDATE em código: é um statement atômico, row-locked.
        const atualizada = await tx.execute<{
          id: string;
          reservado_efetivo: string;
          disp_depois: string;
          reservada_depois: string;
        }>(sql`
          WITH travada AS (
            SELECT id, quantidade_disponivel
            FROM disponibilidades_virtuais
            WHERE compra_programada_id = ${dto.compraProgramadaId}
              AND item_comercial_id = ${item.itemComercialId}
            FOR UPDATE
          )
          UPDATE disponibilidades_virtuais d
          SET quantidade_reservada = d.quantidade_reservada + LEAST(${pedida}::numeric, t.quantidade_disponivel),
              quantidade_disponivel = d.quantidade_disponivel - LEAST(${pedida}::numeric, t.quantidade_disponivel),
              status = CASE
                WHEN d.quantidade_disponivel - LEAST(${pedida}::numeric, t.quantidade_disponivel) = 0
                THEN 'esgotada' ELSE 'parcialmente_reservada' END
          FROM travada t
          WHERE d.id = t.id AND t.quantidade_disponivel > 0
          RETURNING d.id,
                    LEAST(${pedida}::numeric, t.quantidade_disponivel) AS reservado_efetivo,
                    d.quantidade_disponivel AS disp_depois,
                    d.quantidade_reservada  AS reservada_depois
        `);

        const linha = atualizada.rows[0];
        // S3: sem disponibilidade (ou já esgotada) → reservadoEfetivo = 0.
        const reservadoEfetivo = linha ? formatarQtd(linha.reservado_efetivo) : '0.000';
        const pendente = subtrairQtd(pedida, reservadoEfetivo);

        const statusItem = ehZero(pendente)
          ? 'totalmente_reservado'
          : ehZero(reservadoEfetivo)
            ? 'sem_cobertura'
            : 'parcialmente_reservado';
        if (statusItem !== 'totalmente_reservado') todosTotais = false;

        const pedidoItem = primeiroOuFalha(
          await tx
            .insert(pedidosVendaItens)
            .values({
              pedidoVendaId: pedidoCriado.id,
              itemComercialId: item.itemComercialId,
              quantidadePedida: pedida,
              quantidadeReservada: reservadoEfetivo,
              quantidadePendente: pendente,
              preferenciasAplicadasJson: preferencias as Record<string, unknown>,
              status: statusItem,
              observacoes: item.observacoes,
            })
            .returning(),
        );

        if (linha && !ehZero(reservadoEfetivo)) {
          await tx.insert(reservasDisponibilidade).values({
            disponibilidadeVirtualId: linha.id,
            pedidoVendaItemId: pedidoItem.id,
            quantidadeReservada: reservadoEfetivo,
            status: 'ativa',
          });
          reservasAtualizadas.push({
            disponibilidadeId: linha.id,
            itemComercialId: item.itemComercialId,
            quantidadeReservada: formatarQtd(linha.reservada_depois),
            quantidadeDisponivel: formatarQtd(linha.disp_depois),
          });
        }

        if (!ehZero(pendente)) {
          semCobertura.push({
            pedidoItemId: pedidoItem.id,
            itemComercialId: item.itemComercialId,
            quantidadePendente: pendente,
          });
        }
      }

      const statusPedido = todosTotais ? 'reservado' : 'parcialmente_reservado';
      const pedidoFinal = primeiroOuFalha(
        await tx.update(pedidosVenda).set({ status: statusPedido }).where(eq(pedidosVenda.id, pedidoCriado.id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'pedidos_venda',
        registroId: pedidoFinal.id,
        operacao: 'INSERT',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: pedidoFinal,
      });

      return { pedido: pedidoFinal, reservasAtualizadas, semCobertura };
    });

    // PÓS-COMMIT (ADR-004): emitir saldo atualizado e alertas de sem cobertura.
    for (const r of reservasAtualizadas) {
      this.eventEmitter.emit(EVENTOS.RESERVA_ATUALIZADA, {
        disponibilidadeId: r.disponibilidadeId,
        itemComercialId: r.itemComercialId,
        dataOperacao: pedido.dataOperacao,
        quantidadeReservada: r.quantidadeReservada,
        quantidadeDisponivel: r.quantidadeDisponivel,
      });
    }
    if (semCobertura.length > 0) {
      this.eventEmitter.emit(EVENTOS.PEDIDO_SEM_COBERTURA, {
        pedidoId: pedido.id,
        dataOperacao: pedido.dataOperacao,
        itens: semCobertura,
      });
    }

    return pedido;
  }

  /** Cancela o pedido e devolve TODO o saldo reservado à disponibilidade (mesma tx). */
  async cancelar(id: string, usuarioId: string): Promise<PedidoVenda> {
    const { pedido, reservasAtualizadas } = await this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(pedidosVenda)
        .where(and(eq(pedidosVenda.id, id), isNull(pedidosVenda.deletedAt)))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Pedido não encontrado');
      if (anterior.status === 'cancelado') throw new ConflictException('Pedido já cancelado');

      const reservasAtualizadas = await this.liberarReservasDoPedido(tx, id);

      await tx.update(pedidosVendaItens).set({ status: 'cancelado' }).where(eq(pedidosVendaItens.pedidoVendaId, id));
      const cancelado = primeiroOuFalha(
        await tx
          .update(pedidosVenda)
          .set({ status: 'cancelado', deletedAt: new Date() })
          .where(eq(pedidosVenda.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'pedidos_venda',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: cancelado,
      });

      return { pedido: cancelado, reservasAtualizadas };
    });

    for (const r of reservasAtualizadas) {
      this.eventEmitter.emit(EVENTOS.RESERVA_ATUALIZADA, {
        disponibilidadeId: r.disponibilidadeId,
        itemComercialId: r.itemComercialId,
        dataOperacao: pedido.dataOperacao,
        quantidadeReservada: r.quantidadeReservada,
        quantidadeDisponivel: r.quantidadeDisponivel,
      });
    }
    return pedido;
  }

  /** Reduz a quantidade reservada de um item, devolvendo a diferença ao saldo. */
  async reduzirItem(
    pedidoId: string,
    itemId: string,
    dto: ReduzirItemDto,
    usuarioId: string,
  ): Promise<{ disponibilidadeId: string; quantidadeDisponivel: string } | null> {
    const resultado = await this.db.transaction(async (tx) => {
      const pedido = await tx
        .select()
        .from(pedidosVenda)
        .where(and(eq(pedidosVenda.id, pedidoId), isNull(pedidosVenda.deletedAt)))
        .then((r) => r[0] ?? null);
      if (!pedido) throw new NotFoundException('Pedido não encontrado');
      if (pedido.status === 'cancelado') throw new ConflictException('Pedido cancelado');

      const item = await tx
        .select()
        .from(pedidosVendaItens)
        .where(and(eq(pedidosVendaItens.id, itemId), eq(pedidosVendaItens.pedidoVendaId, pedidoId)))
        .then((r) => r[0] ?? null);
      if (!item) throw new NotFoundException('Item do pedido não encontrado');

      const nova = formatarQtd(dto.novaQuantidade);
      // Só reduz: nova precisa ser menor que a reservada atual.
      if (compararQtd(nova, item.quantidadeReservada) >= 0) {
        throw new ConflictException('novaQuantidade deve ser menor que a quantidade reservada atual');
      }
      const devolver = subtrairQtd(item.quantidadeReservada, nova);

      const reserva = await tx
        .select()
        .from(reservasDisponibilidade)
        .where(
          and(eq(reservasDisponibilidade.pedidoVendaItemId, itemId), eq(reservasDisponibilidade.status, 'ativa')),
        )
        .then((r) => r[0] ?? null);
      if (!reserva) throw new ConflictException('Item sem reserva ativa');
      if (!reserva.disponibilidadeVirtualId) {
        throw new ConflictException('Reserva sem disponibilidade virtual associada');
      }

      // Devolve saldo e recomputa status (S1: nunca esgotada com disponível > 0).
      const dispAtualizada = await this.devolverSaldo(tx, reserva.disponibilidadeVirtualId, devolver);

      const restante = subtrairQtd(reserva.quantidadeReservada, devolver);
      if (ehZero(restante)) {
        await tx.update(reservasDisponibilidade).set({ status: 'liberada' }).where(eq(reservasDisponibilidade.id, reserva.id));
      } else {
        await tx
          .update(reservasDisponibilidade)
          .set({ quantidadeReservada: restante })
          .where(eq(reservasDisponibilidade.id, reserva.id));
      }

      // Reduzir devolve saldo: a quantidade reservada cai para `nova`; o pendente
      // não muda (a redução é uma decisão comercial, não falta de cobertura).
      const statusItem = ehZero(nova)
        ? 'sem_cobertura'
        : ehZero(item.quantidadePendente)
          ? 'totalmente_reservado'
          : 'parcialmente_reservado';
      await tx
        .update(pedidosVendaItens)
        .set({ quantidadeReservada: nova, status: statusItem })
        .where(eq(pedidosVendaItens.id, itemId));

      await this.auditoria.registrar(tx, {
        tabela: 'pedidos_venda_itens',
        registroId: itemId,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: item,
        dadosNovos: { quantidadeReservada: nova, devolvido: devolver },
      });

      return {
        dataOperacao: pedido.dataOperacao,
        disponibilidadeId: reserva.disponibilidadeVirtualId,
        itemComercialId: item.itemComercialId,
        quantidadeReservada: dispAtualizada.quantidadeReservada,
        quantidadeDisponivel: dispAtualizada.quantidadeDisponivel,
      };
    });

    this.eventEmitter.emit(EVENTOS.RESERVA_ATUALIZADA, {
      disponibilidadeId: resultado.disponibilidadeId,
      itemComercialId: resultado.itemComercialId,
      dataOperacao: resultado.dataOperacao,
      quantidadeReservada: resultado.quantidadeReservada,
      quantidadeDisponivel: resultado.quantidadeDisponivel,
    });
    return { disponibilidadeId: resultado.disponibilidadeId, quantidadeDisponivel: resultado.quantidadeDisponivel };
  }

  /** Libera todas as reservas ativas de um pedido, devolvendo saldo. */
  private async liberarReservasDoPedido(tx: Tx, pedidoId: string): Promise<ReservaAtualizada[]> {
    const reservas = await tx
      .select({
        reservaId: reservasDisponibilidade.id,
        disponibilidadeId: reservasDisponibilidade.disponibilidadeVirtualId,
        quantidade: reservasDisponibilidade.quantidadeReservada,
        itemComercialId: disponibilidadesVirtuais.itemComercialId,
      })
      .from(reservasDisponibilidade)
      .innerJoin(pedidosVendaItens, eq(reservasDisponibilidade.pedidoVendaItemId, pedidosVendaItens.id))
      .innerJoin(disponibilidadesVirtuais, eq(reservasDisponibilidade.disponibilidadeVirtualId, disponibilidadesVirtuais.id))
      .where(and(eq(pedidosVendaItens.pedidoVendaId, pedidoId), eq(reservasDisponibilidade.status, 'ativa')));

    const atualizadas: ReservaAtualizada[] = [];
    for (const r of reservas) {
      if (!r.disponibilidadeId) {
        await tx.update(reservasDisponibilidade).set({ status: 'liberada' }).where(eq(reservasDisponibilidade.id, r.reservaId));
        continue;
      }
      const disp = await this.devolverSaldo(tx, r.disponibilidadeId, r.quantidade);
      await tx.update(reservasDisponibilidade).set({ status: 'liberada' }).where(eq(reservasDisponibilidade.id, r.reservaId));
      atualizadas.push({
        disponibilidadeId: r.disponibilidadeId,
        itemComercialId: r.itemComercialId,
        quantidadeReservada: disp.quantidadeReservada,
        quantidadeDisponivel: disp.quantidadeDisponivel,
      });
    }
    return atualizadas;
  }

  /**
   * Devolve `quantidade` ao saldo de uma disponibilidade e recomputa o status (S1):
   * nunca deixa 'esgotada' com disponível > 0.
   */
  private async devolverSaldo(
    tx: Tx,
    disponibilidadeId: string,
    quantidade: string,
  ): Promise<{ quantidadeReservada: string; quantidadeDisponivel: string }> {
    const atualizada = await tx.execute<{
      quantidade_reservada: string;
      quantidade_disponivel: string;
    }>(sql`
      UPDATE disponibilidades_virtuais
      SET quantidade_reservada = quantidade_reservada - ${quantidade}::numeric,
          quantidade_disponivel = quantidade_disponivel + ${quantidade}::numeric,
          status = CASE
            WHEN quantidade_reservada - ${quantidade}::numeric = 0 THEN 'gerada'
            ELSE 'parcialmente_reservada' END
      WHERE id = ${disponibilidadeId}
      RETURNING quantidade_reservada, quantidade_disponivel
    `);
    const linha = primeiroOuFalha(atualizada.rows, 'Disponibilidade não encontrada na devolução');
    return {
      quantidadeReservada: linha.quantidade_reservada,
      quantidadeDisponivel: linha.quantidade_disponivel,
    };
  }
}
