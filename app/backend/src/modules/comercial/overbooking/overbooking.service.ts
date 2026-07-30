import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  compararQtd,
  ehZero,
  formatarQtd,
  subtrairQtd,
} from '../../../common/crud/decimal';
import { montarPaginado, type Paginado } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  comprasProgramadas,
  disponibilidadesVirtuais,
  operacoes,
  pedidosVendaItens,
  pendenciasOverbooking,
  pendenciasOverbookingHistorico,
  reservasDisponibilidade,
  usuarios,
} from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import type { Tx } from '../../operacoes/operacoes.service';
import { PedidosService, type EventoDominio } from '../pedidos/pedidos.service';
import {
  statusDoCaminho,
  TRANSICOES_PENDENCIA,
  type DecidirPendenciaDto,
  type ListarPendenciasDto,
  type StatusPendencia,
} from './dto/overbooking.dto';

type Pendencia = typeof pendenciasOverbooking.$inferSelect;

export interface CoberturaPendencia {
  pendenciaId: string;
  itemComercialId: string;
  quantidadeDeficit: string;
  comprasComplementares: Array<{
    compraProgramadaId: string;
    operacaoId: string;
    dataOperacao: string;
    status: string;
    quantidadeProjetada: string;
  }>;
  redistribuicoes: Array<{
    pedidoVendaId: string;
    pedidoVendaItemId: string;
    clienteNome: string;
    quantidadeReservada: string;
    reservaId: string;
    disponibilidadeVirtualId: string;
  }>;
  proximaOperacao: { id: string; data: string; rotulo: string } | null;
}

interface EfeitoDecisao {
  quantidadeAbatida: string;
  abatidoPeloEfeito: boolean;
  detalhe: Record<string, unknown>;
  eventos: EventoDominio[];
}

@Injectable()
export class OverbookingService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly pedidos: PedidosService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarPendenciasDto): Promise<Paginado<Pendencia>> {
    const page = query.pagina;
    const pageSize = query.limite;
    const limit = pageSize;
    const offset = (page - 1) * pageSize;
    const filtros = [
      eq(pendenciasOverbooking.operacaoId, query.operacaoId),
      isNull(pendenciasOverbooking.deletedAt),
    ];
    if (query.status) filtros.push(eq(pendenciasOverbooking.status, query.status));
    const where = and(...filtros);
    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(pendenciasOverbooking).where(where)
        .orderBy(desc(pendenciasOverbooking.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(pendenciasOverbooking).where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0, { page, pageSize });
  }

  async detalhar(id: string): Promise<Pendencia & {
    historico: Array<typeof pendenciasOverbookingHistorico.$inferSelect>;
  }> {
    const pendencia = await this.db.select().from(pendenciasOverbooking)
      .where(and(eq(pendenciasOverbooking.id, id), isNull(pendenciasOverbooking.deletedAt)))
      .then((rows) => rows[0] ?? null);
    if (!pendencia) throw new NotFoundException('Pendência não encontrada');
    const historico = await this.db.select().from(pendenciasOverbookingHistorico)
      .where(eq(pendenciasOverbookingHistorico.pendenciaId, id))
      .orderBy(desc(pendenciasOverbookingHistorico.criadoEm));
    return { ...pendencia, historico };
  }

  async historico(id: string): Promise<Array<{
    id: string;
    acao: string;
    autorNome: string | null;
    detalheJson: unknown;
    criadoEm: string;
  }>> {
    await this.detalhar(id);
    const linhas = await this.db.select({
      id: pendenciasOverbookingHistorico.id,
      acao: pendenciasOverbookingHistorico.acao,
      detalheJson: pendenciasOverbookingHistorico.detalheJson,
      criadoEm: pendenciasOverbookingHistorico.criadoEm,
      autorNome: usuarios.nome,
    })
      .from(pendenciasOverbookingHistorico)
      .leftJoin(usuarios, eq(usuarios.id, pendenciasOverbookingHistorico.autorId))
      .where(eq(pendenciasOverbookingHistorico.pendenciaId, id))
      .orderBy(asc(pendenciasOverbookingHistorico.criadoEm));
    return linhas.map((l) => ({
      id: l.id,
      acao: l.acao,
      autorNome: l.autorNome,
      detalheJson: l.detalheJson,
      criadoEm: l.criadoEm.toISOString(),
    }));
  }

  async alterarStatus(
    id: string,
    novoStatus: StatusPendencia,
    detalhe: unknown,
    usuarioId: string,
  ) {
    const resultado = await this.db.transaction(async (tx) => {
      const atual = await this.obterAtivaSobLock(tx, id);
      if (!TRANSICOES_PENDENCIA[atual.status as StatusPendencia].includes(novoStatus)) {
        throw new ConflictException(`Transição ${atual.status} → ${novoStatus} inválida`);
      }
      const [pendencia] = await tx.update(pendenciasOverbooking)
        .set({
          status: novoStatus,
          decisaoJson: detalhe as Record<string, unknown>,
          responsavelId: usuarioId,
          updatedAt: new Date(),
        })
        .where(eq(pendenciasOverbooking.id, id)).returning();
      if (!pendencia) throw new NotFoundException('Pendência não encontrada');
      await tx.insert(pendenciasOverbookingHistorico).values({
        pendenciaId: id, acao: novoStatus, autorId: usuarioId, detalheJson: detalhe as Record<string, unknown>,
      });
      await this.auditoria.registrar(tx, {
        tabela: 'pendencias_overbooking', registroId: id, operacao: 'UPDATE',
        modulo: 'comercial', usuarioId, dadosAnteriores: atual, dadosNovos: pendencia,
      });
      return { pendencia, dataOperacao: await this.dataDaOperacao(tx, pendencia.operacaoId) };
    });
    this.eventEmitter.emit(
      resultado.pendencia.status === 'resolvida' || resultado.pendencia.status === 'cancelada'
        ? EVENTOS.PENDENCIA_OVERBOOKING_RESOLVIDA
        : EVENTOS.PENDENCIA_OVERBOOKING_ATUALIZADA,
      {
        pendenciaId: resultado.pendencia.id,
        operacaoId: resultado.pendencia.operacaoId,
        dataOperacao: resultado.dataOperacao,
        status: resultado.pendencia.status,
      },
    );
    return resultado.pendencia;
  }

  async decidir(id: string, dto: DecidirPendenciaDto, usuarioId: string) {
    const { pendencia, eventos, dataOperacao } = await this.db.transaction(async (tx) => {
      const atual = await this.obterAtivaSobLock(tx, id);
      const statusAlvo = statusDoCaminho(dto.caminho);
      if (!TRANSICOES_PENDENCIA[atual.status as StatusPendencia].includes(statusAlvo)) {
        throw new ConflictException(`Transição ${atual.status} → ${statusAlvo} inválida`);
      }
      if (compararQtd(dto.quantidade, atual.quantidadeDeficit) > 0) {
        throw new ConflictException('Quantidade acima do déficit da pendência');
      }

      const efeito = dto.caminho === 'compra_complementar'
        ? await this.aplicarCompraComplementar(tx, atual, dto)
        : dto.caminho === 'redistribuicao'
          ? await this.aplicarRedistribuicao(tx, atual, dto, usuarioId)
          : await this.aplicarNovoPedido(tx, atual, dto, usuarioId);

      const aposEfeito = efeito.abatidoPeloEfeito ? await this.obterAtivaSobLock(tx, id) : atual;
      const encerradaPeloEfeito =
        aposEfeito.status === 'cancelada' || aposEfeito.status === 'resolvida';
      const deficitRestante = encerradaPeloEfeito
        ? '0.000'
        : efeito.abatidoPeloEfeito
          ? aposEfeito.quantidadeDeficit
          : subtrairQtd(atual.quantidadeDeficit, efeito.quantidadeAbatida);
      const statusFinal: StatusPendencia = encerradaPeloEfeito
        ? (aposEfeito.status as StatusPendencia)
        : ehZero(deficitRestante) ? 'resolvida' : statusAlvo;

      const [pendencia] = await tx.update(pendenciasOverbooking).set({
        ...(ehZero(deficitRestante) ? {} : { quantidadeDeficit: deficitRestante }),
        status: statusFinal,
        decisaoJson: { caminho: dto.caminho, ...efeito.detalhe },
        responsavelId: usuarioId,
        updatedAt: new Date(),
      }).where(eq(pendenciasOverbooking.id, id)).returning();
      if (!pendencia) throw new NotFoundException('Pendência não encontrada');

      await tx.insert(pendenciasOverbookingHistorico).values({
        pendenciaId: id,
        acao: statusAlvo,
        autorId: usuarioId,
        detalheJson: { caminho: dto.caminho, ...efeito.detalhe },
      });
      if (statusFinal !== statusAlvo) {
        await tx.insert(pendenciasOverbookingHistorico).values({
          pendenciaId: id, acao: statusFinal, autorId: usuarioId,
          detalheJson: {
            motivo: encerradaPeloEfeito
              ? 'pendência encerrada pelo efeito da decisão sobre o item do pedido'
              : 'déficit zerado pela decisão',
          },
        });
      }
      await this.auditoria.registrar(tx, {
        tabela: 'pendencias_overbooking', registroId: id, operacao: 'UPDATE',
        modulo: 'comercial', usuarioId, dadosAnteriores: atual, dadosNovos: pendencia,
      });

      return {
        pendencia,
        eventos: efeito.eventos,
        dataOperacao: await this.dataDaOperacao(tx, atual.operacaoId),
      };
    });

    for (const evento of eventos) this.eventEmitter.emit(evento.nome, evento.payload);
    this.eventEmitter.emit(
      pendencia.status === 'resolvida' || pendencia.status === 'cancelada'
        ? EVENTOS.PENDENCIA_OVERBOOKING_RESOLVIDA
        : EVENTOS.PENDENCIA_OVERBOOKING_ATUALIZADA,
      {
        pendenciaId: pendencia.id,
        operacaoId: pendencia.operacaoId,
        dataOperacao,
        status: pendencia.status,
      },
    );
    return pendencia;
  }

  private async obterAtiva(id: string): Promise<Pendencia> {
    const atual = await this.db.select().from(pendenciasOverbooking)
      .where(and(eq(pendenciasOverbooking.id, id), isNull(pendenciasOverbooking.deletedAt)))
      .then((r) => r[0]);
    if (!atual) throw new NotFoundException('Pendência não encontrada');
    return atual;
  }

  async cobertura(id: string): Promise<CoberturaPendencia> {
    const pendencia = await this.obterAtiva(id);
    const operacao = await this.db.select().from(operacoes)
      .where(eq(operacoes.id, pendencia.operacaoId)).then((r) => r[0]);
    if (!operacao) throw new NotFoundException('Operação da pendência não encontrada');

    const compras = await this.db.execute<{
      compra_programada_id: string; operacao_id: string; data: string;
      status: string; quantidade_projetada: string;
    }>(sql`
      SELECT cp.id AS compra_programada_id, cp.operacao_id, op.data, cp.status,
             SUM(r.fator_quantidade * cpi.quantidade_comprada)::text AS quantidade_projetada
        FROM compras_programadas cp
        JOIN operacoes op ON op.id = cp.operacao_id
        JOIN compras_programadas_itens cpi
          ON cpi.compra_programada_id = cp.id AND cpi.deleted_at IS NULL
        JOIN regras_desdobramento_comercial r
          ON r.item_compra_id = cpi.item_compra_id
         AND r.deleted_at IS NULL AND r.status = 'ativo'
         AND r.item_comercial_id = ${pendencia.itemComercialId}
       WHERE cp.deleted_at IS NULL AND cp.status <> 'cancelada'
         AND op.data >= ${operacao.data}
       GROUP BY cp.id, cp.operacao_id, op.data, cp.status
       ORDER BY op.data ASC
    `);

    const redistribuicoes = await this.db.execute<{
      pedido_venda_id: string; pedido_venda_item_id: string; cliente_nome: string;
      quantidade_reservada: string; reserva_id: string; disponibilidade_virtual_id: string;
    }>(sql`
      SELECT pv.id AS pedido_venda_id, pvi.id AS pedido_venda_item_id,
             COALESCE(c.nome_fantasia, c.razao_social) AS cliente_nome,
             rd.quantidade_reservada::text, rd.id AS reserva_id,
             rd.disponibilidade_virtual_id
        FROM reservas_disponibilidade rd
        JOIN pedidos_venda_itens pvi ON pvi.id = rd.pedido_venda_item_id
        JOIN pedidos_venda pv ON pv.id = pvi.pedido_venda_id
        JOIN clientes c ON c.id = pv.cliente_id
       WHERE rd.status = 'ativa'
         AND rd.tipo_consumo IN ('fisico','virtual')
         AND pvi.item_comercial_id = ${pendencia.itemComercialId}
         AND pv.operacao_id = ${pendencia.operacaoId}
         AND pv.id <> ${pendencia.pedidoVendaId}
         AND pv.deleted_at IS NULL AND pvi.deleted_at IS NULL
       ORDER BY rd.created_at ASC
    `);

    const proxima = await this.db.select().from(operacoes)
      .where(and(isNull(operacoes.deletedAt), gt(operacoes.data, operacao.data),
        ne(operacoes.status, 'fechada')))
      .orderBy(asc(operacoes.data)).limit(1).then((r) => r[0] ?? null);

    return {
      pendenciaId: pendencia.id,
      itemComercialId: pendencia.itemComercialId,
      quantidadeDeficit: pendencia.quantidadeDeficit,
      comprasComplementares: compras.rows.map((c) => ({
        compraProgramadaId: c.compra_programada_id,
        operacaoId: c.operacao_id,
        dataOperacao: c.data,
        status: c.status,
        quantidadeProjetada: formatarQtd(c.quantidade_projetada),
      })),
      redistribuicoes: redistribuicoes.rows.map((r) => ({
        pedidoVendaId: r.pedido_venda_id,
        pedidoVendaItemId: r.pedido_venda_item_id,
        clienteNome: r.cliente_nome,
        quantidadeReservada: formatarQtd(r.quantidade_reservada),
        reservaId: r.reserva_id,
        disponibilidadeVirtualId: r.disponibilidade_virtual_id,
      })),
      proximaOperacao: proxima
        ? { id: proxima.id, data: proxima.data, rotulo: proxima.rotulo }
        : null,
    };
  }

  private async aplicarCompraComplementar(
    tx: Tx,
    pendencia: Pendencia,
    dto: Extract<DecidirPendenciaDto, { caminho: 'compra_complementar' }>,
  ): Promise<EfeitoDecisao> {
    const linha = await tx.execute<{ operacao_id: string; data: string; data_pendencia: string; gera_item: boolean }>(sql`
      SELECT cp.operacao_id, op.data, op_pend.data AS data_pendencia,
             EXISTS (
               SELECT 1 FROM compras_programadas_itens cpi
               JOIN regras_desdobramento_comercial r
                 ON r.item_compra_id = cpi.item_compra_id
                AND r.deleted_at IS NULL AND r.status = 'ativo'
                AND r.item_comercial_id = ${pendencia.itemComercialId}
               WHERE cpi.compra_programada_id = cp.id AND cpi.deleted_at IS NULL
             ) AS gera_item
        FROM compras_programadas cp
        JOIN operacoes op ON op.id = cp.operacao_id
        JOIN operacoes op_pend ON op_pend.id = ${pendencia.operacaoId}
       WHERE cp.id = ${dto.compraProgramadaId}
         AND cp.deleted_at IS NULL AND cp.status <> 'cancelada'
    `).then((r) => r.rows[0]);

    if (!linha) throw new NotFoundException('Compra programada inelegível ou inexistente');
    if (linha.data < linha.data_pendencia) {
      throw new ConflictException('Compra complementar deve estar na operação atual ou em uma futura');
    }
    if (!linha.gera_item) {
      throw new ConflictException('A compra escolhida não gera o item comercial da pendência');
    }

    return {
      quantidadeAbatida: '0.000',
      abatidoPeloEfeito: false,
      detalhe: {
        compraProgramadaId: dto.compraProgramadaId,
        operacaoDestinoId: linha.operacao_id,
        quantidade: dto.quantidade,
        observacao: dto.observacao ?? null,
      },
      eventos: [],
    };
  }

  private async aplicarRedistribuicao(
    tx: Tx,
    pendencia: Pendencia,
    dto: Extract<DecidirPendenciaDto, { caminho: 'redistribuicao' }>,
    usuarioId: string,
  ): Promise<EfeitoDecisao> {
    const doadora = await tx.select().from(reservasDisponibilidade)
      .where(and(
        eq(reservasDisponibilidade.id, dto.reservaOrigemId),
        eq(reservasDisponibilidade.status, 'ativa'),
        inArray(reservasDisponibilidade.tipoConsumo, ['fisico', 'virtual']),
      )).for('update').then((r) => r[0]);
    if (!doadora) throw new NotFoundException('Reserva de origem não encontrada ou inativa');
    if (compararQtd(dto.quantidade, doadora.quantidadeReservada) > 0) {
      throw new ConflictException('Quantidade acima do saldo da reserva de origem');
    }
    if (doadora.pedidoVendaItemId === pendencia.pedidoVendaItemId) {
      throw new ConflictException('A reserva de origem não pode ser do próprio pedido deficitário');
    }

    const overbooking = await tx.select().from(reservasDisponibilidade)
      .where(and(
        eq(reservasDisponibilidade.pedidoVendaItemId, pendencia.pedidoVendaItemId),
        eq(reservasDisponibilidade.tipoConsumo, 'overbooking'),
        eq(reservasDisponibilidade.status, 'ativa'),
      )).for('update').then((r) => r[0]);
    if (!overbooking) throw new ConflictException('Pedido deficitário não possui reserva de overbooking ativa');
    if (compararQtd(dto.quantidade, overbooking.quantidadeReservada) > 0) {
      throw new ConflictException('Quantidade acima do overbooking do pedido deficitário');
    }

    const saldoDoadora = subtrairQtd(doadora.quantidadeReservada, dto.quantidade);
    await tx.update(reservasDisponibilidade)
      .set(ehZero(saldoDoadora)
        ? { status: 'liberada' }
        : { quantidadeReservada: saldoDoadora })
      .where(eq(reservasDisponibilidade.id, doadora.id));

    const saldoOverbooking = subtrairQtd(overbooking.quantidadeReservada, dto.quantidade);
    await tx.update(reservasDisponibilidade)
      .set(ehZero(saldoOverbooking)
        ? { status: 'liberada' }
        : { quantidadeReservada: saldoOverbooking })
      .where(eq(reservasDisponibilidade.id, overbooking.id));

    await tx.insert(reservasDisponibilidade).values({
      disponibilidadeVirtualId: doadora.disponibilidadeVirtualId,
      pedidoVendaItemId: pendencia.pedidoVendaItemId,
      quantidadeReservada: dto.quantidade,
      tipoConsumo: doadora.tipoConsumo,
      status: 'ativa',
    });

    await this.ajustarItemPedido(tx, doadora.pedidoVendaItemId, `-${dto.quantidade}`, '0.000');
    await this.ajustarItemPedido(tx, pendencia.pedidoVendaItemId, dto.quantidade, `-${dto.quantidade}`);

    if (!doadora.disponibilidadeVirtualId) {
      throw new ConflictException('Reserva de origem sem disponibilidade virtual');
    }

    const saldos = await tx.select({
      quantidadeReservada: disponibilidadesVirtuais.quantidadeReservada,
      quantidadeDisponivel: disponibilidadesVirtuais.quantidadeDisponivel,
    })
      .from(disponibilidadesVirtuais)
      .where(eq(disponibilidadesVirtuais.id, doadora.disponibilidadeVirtualId))
      .then((r) => r[0]);
    if (!saldos) throw new NotFoundException('Disponibilidade virtual da reserva de origem não encontrada');

    const dataOperacao = await this.dataDaOperacao(tx, pendencia.operacaoId);

    await this.auditoria.registrar(tx, {
      tabela: 'reservas_disponibilidade', registroId: doadora.id, operacao: 'UPDATE',
      modulo: 'comercial', usuarioId,
      dadosAnteriores: doadora,
      dadosNovos: { quantidadeReservada: saldoDoadora, redistribuidoPara: pendencia.pedidoVendaItemId },
    });

    return {
      quantidadeAbatida: dto.quantidade,
      abatidoPeloEfeito: false,
      detalhe: {
        reservaOrigemId: doadora.id,
        pedidoOrigemItemId: doadora.pedidoVendaItemId,
        quantidade: dto.quantidade,
        observacao: dto.observacao ?? null,
      },
      eventos: [{
        nome: EVENTOS.RESERVA_ATUALIZADA,
        payload: {
          disponibilidadeId: doadora.disponibilidadeVirtualId,
          itemComercialId: pendencia.itemComercialId,
          dataOperacao,
          quantidadeReservada: saldos.quantidadeReservada,
          quantidadeDisponivel: saldos.quantidadeDisponivel,
        },
      }],
    };
  }

  private async ajustarItemPedido(
    tx: Tx,
    itemId: string,
    deltaReservada: string,
    deltaOverbooking: string,
  ) {
    await tx.execute(sql`
      UPDATE pedidos_venda_itens
         SET quantidade_reservada   = quantidade_reservada   + ${deltaReservada}::numeric,
             quantidade_overbooking = GREATEST(0, quantidade_overbooking + ${deltaOverbooking}::numeric),
             status = CASE
               WHEN GREATEST(0, quantidade_overbooking + ${deltaOverbooking}::numeric) = 0
                 THEN 'totalmente_reservado' ELSE 'overbooking_confirmado' END,
             updated_at = now()
       WHERE id = ${itemId}
    `);
  }

  private async aplicarNovoPedido(
    tx: Tx,
    pendencia: Pendencia,
    dto: Extract<DecidirPendenciaDto, { caminho: 'novo_pedido' }>,
    usuarioId: string,
  ): Promise<EfeitoDecisao> {
    const destino = await tx.select().from(operacoes)
      .where(and(eq(operacoes.id, dto.operacaoDestinoId), isNull(operacoes.deletedAt)))
      .then((r) => r[0]);
    if (!destino) throw new NotFoundException('Operação de destino não encontrada');
    if (destino.status === 'fechada') {
      throw new ConflictException('Operação de destino está fechada');
    }
    const origem = await tx.select().from(operacoes)
      .where(eq(operacoes.id, pendencia.operacaoId)).then((r) => r[0]);
    if (!origem || destino.data <= origem.data) {
      throw new ConflictException('A operação de destino deve ser posterior à da pendência');
    }

    const compra = await tx.select({ id: comprasProgramadas.id }).from(comprasProgramadas)
      .where(and(
        eq(comprasProgramadas.id, dto.compraProgramadaId),
        eq(comprasProgramadas.operacaoId, destino.id),
        ne(comprasProgramadas.status, 'cancelada'),
        isNull(comprasProgramadas.deletedAt),
      )).then((r) => r[0]);
    if (!compra) {
      throw new ConflictException('Compra programada não pertence à operação de destino ou está cancelada');
    }

    const item = await tx.select().from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.id, pendencia.pedidoVendaItemId)).for('update').then((r) => r[0]);
    if (!item) throw new NotFoundException('Item do pedido de origem não encontrado');

    const motivo = `Postergado para a operação ${destino.data} (pendência de overbooking ${pendencia.id})`;
    const novaQuantidade = subtrairQtd(item.quantidadePedida, dto.quantidade);
    if (ehZero(novaQuantidade)) {
      await this.pedidos.removerItemNaTx(tx, pendencia.pedidoVendaId, item.id, motivo, usuarioId);
    } else {
      await this.pedidos.reduzirItemNaTx(
        tx, pendencia.pedidoVendaId, item.id, novaQuantidade, motivo, usuarioId,
      );
    }

    const novoPedido = await this.pedidos.criarNaTx(tx, {
      compraProgramadaId: compra.id,
      clienteId: pendencia.clienteId,
      dataOperacao: destino.data,
      observacoesGerais: motivo,
      salvarComoRascunho: false,
      itens: [{
        itemComercialId: pendencia.itemComercialId,
        quantidadePedida: Number(dto.quantidade),
      }],
    }, usuarioId, true);

    return {
      quantidadeAbatida: dto.quantidade,
      abatidoPeloEfeito: true,
      detalhe: {
        quantidade: dto.quantidade,
        operacaoDestinoId: destino.id,
        compraProgramadaId: compra.id,
        itemOrigemRemovido: ehZero(novaQuantidade),
        novoPedidoId: novoPedido.pedido.id,
        observacao: dto.observacao ?? null,
      },
      eventos: novoPedido.eventos,
    };
  }

  private async obterAtivaSobLock(tx: Tx, id: string): Promise<Pendencia> {
    const [atual] = await tx.select().from(pendenciasOverbooking)
      .where(and(eq(pendenciasOverbooking.id, id), isNull(pendenciasOverbooking.deletedAt)))
      .for('update')
      .limit(1);
    if (!atual) throw new NotFoundException('Pendência não encontrada');
    return atual;
  }

  private async dataDaOperacao(tx: Tx, operacaoId: string): Promise<string> {
    const [linha] = await tx.select({ data: operacoes.data }).from(operacoes)
      .where(eq(operacoes.id, operacaoId));
    if (!linha) throw new NotFoundException('Operação da pendência não encontrada');
    return linha.data;
  }
}
