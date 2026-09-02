import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { operacoes,
  caminhoes,
  caminhoesPedidos,
  cargaItens,
  pedidosVenda,
  pedidosVendaItens,
  frotaCaminhoes,
  frotaMotoristas,
  rotas,
  pecas,
  subitens,
 } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { OperacoesService } from '../../operacoes/operacoes.service';
import { assertTransicao, type StatusCaminhao } from './transicoes';
import type { CriarCaminhaoDto, VincularPedidoDto } from './dto/expedicao.dto';

type Tx = NodePgDatabase<typeof schema>;
type Caminhao = typeof caminhoes.$inferSelect;

@Injectable()
export class CaminhaoService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly operacoes: OperacoesService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /** Cria caminhão no status 'planejado'. */
  async criar(dto: CriarCaminhaoDto, operadorId: string): Promise<Caminhao> {
    return this.db.transaction(async (tx) => {
      const { operacao } = await this.operacoes.garantirOperacao(tx, dto.dataOperacao, operadorId);

      const motorista = await this.resolverMotorista(tx, dto.motoristaId);
      const rota = await this.resolverRota(tx, dto.rotaId);

      let placa = dto.placa;
      if (dto.frotaCaminhaoId) {
        const frota = await tx
          .select()
          .from(frotaCaminhoes)
          .where(
            and(
              eq(frotaCaminhoes.id, dto.frotaCaminhaoId),
              eq(frotaCaminhoes.status, 'ativo'),
              isNull(frotaCaminhoes.deletedAt),
            ),
          )
          .then((r) => r[0] ?? null);
        if (!frota) {
          throw new NotFoundException({ codigo: 'FROTA_NAO_ENCONTRADA', message: 'Caminhão da frota não encontrado ou inativo' });
        }
        placa = frota.placa;
      }

      const caminhao = primeiroOuFalha(
        await tx
          .insert(caminhoes)
          .values({
            frotaCaminhaoId: dto.frotaCaminhaoId ?? null,
            placa: placa!,
            motoristaId: motorista.id,
            motorista: motorista.nome,
            rotaId: rota?.id ?? null,
            rota: rota?.nome ?? null,
            itinerario: dto.itinerario,
            operacaoId: operacao.id,
            observacoes: dto.observacoes,
          })
          .returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'caminhoes',
        registroId: caminhao.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: caminhao,
      });
      return caminhao;
    });
  }

  /** Abre a carga (planejado/aguardando_carga → em_carga). */
  async abrirCarga(caminhaoId: string, operadorId: string): Promise<Caminhao> {
    return this.db.transaction(async (tx) => {
      const caminhao = await this.caminhaoAtivo(tx, caminhaoId);
      const statusAtual = caminhao.statusCaminhao as StatusCaminhao;
      // Aceita tanto planejado quanto aguardando_carga (atalho operacional)
      if (statusAtual !== 'planejado' && statusAtual !== 'aguardando_carga') {
        assertTransicao(statusAtual, 'em_carga'); // vai lançar 409 com mensagem correta
      }
      const atualizado = primeiroOuFalha(
        await tx
          .update(caminhoes)
          .set({ statusCaminhao: 'em_carga', horaAberturaCarga: new Date() })
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
        dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  /** Vincula um pedido ao caminhão (cria caminhoes_pedidos se não existir). */
  async vincularPedido(caminhaoId: string, dto: VincularPedidoDto, operadorId: string) {
    return this.db.transaction(async (tx) => {
      await this.caminhaoAtivo(tx, caminhaoId);

      // Pedido deve existir e não estar cancelado
      const pedido = await tx
        .select()
        .from(pedidosVenda)
        .where(and(eq(pedidosVenda.id, dto.pedidoVendaId), isNull(pedidosVenda.deletedAt)))
        .then((r) => r[0] ?? null);
      if (!pedido) throw new NotFoundException('Pedido não encontrado');
      if (pedido.status === 'cancelado') {
        throw new ConflictException('Pedido cancelado não pode ser vinculado ao caminhão');
      }

      // Idempotente
      const existente = await tx
        .select()
        .from(caminhoesPedidos)
        .where(
          and(
            eq(caminhoesPedidos.caminhaoId, caminhaoId),
            eq(caminhoesPedidos.pedidoVendaId, dto.pedidoVendaId),
            isNull(caminhoesPedidos.deletedAt),
          ),
        )
        .then((r) => r[0] ?? null);
      if (existente) return existente;

      const vinculo = primeiroOuFalha(
        await tx
          .insert(caminhoesPedidos)
          .values({
            caminhaoId,
            pedidoVendaId: dto.pedidoVendaId,
            ordemNaCarga: dto.ordemNaCarga,
            statusNaCarga: 'planejado',
          })
          .returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'caminhoes_pedidos',
        registroId: vinculo.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: vinculo,
      });
      return vinculo;
    });
  }

  /** Detalha o caminhão com pedidos e resumo previsto×carregado. */
  async detalhar(caminhaoId: string) {
    const caminhaoBase = await this.caminhaoAtivo(this.db, caminhaoId);
    const capacidadeKg = caminhaoBase.frotaCaminhaoId
      ? await this.db
          .select({ capacidadeKg: frotaCaminhoes.capacidadeKg })
          .from(frotaCaminhoes)
          .where(eq(frotaCaminhoes.id, caminhaoBase.frotaCaminhaoId))
          .then((r) => r[0]?.capacidadeKg ?? null)
      : null;
    const [pesoPecas, pesoSubitens] = await Promise.all([
      this.db
        .select({ peso: sql<string>`coalesce(sum(${pecas.pesoOriginal}), 0)` })
        .from(cargaItens)
        .innerJoin(pecas, eq(pecas.id, cargaItens.pecaId))
        .where(
          and(
            eq(cargaItens.caminhaoId, caminhaoId),
            eq(cargaItens.tipoOrigem, 'peca'),
            ne(cargaItens.statusCargaItem, 'removido'),
            isNull(cargaItens.deletedAt),
          ),
        )
        .then((r) => r[0]?.peso ?? '0'),
      this.db
        .select({ peso: sql<string>`coalesce(sum(${subitens.peso}), 0)` })
        .from(cargaItens)
        .innerJoin(subitens, eq(subitens.id, cargaItens.subitemId))
        .where(
          and(
            eq(cargaItens.caminhaoId, caminhaoId),
            eq(cargaItens.tipoOrigem, 'subitem'),
            ne(cargaItens.statusCargaItem, 'removido'),
            isNull(cargaItens.deletedAt),
          ),
        )
        .then((r) => r[0]?.peso ?? '0'),
    ]);
    const pesoCarregadoKg = (Number(pesoPecas) + Number(pesoSubitens)).toFixed(3);

    const caminhao = { ...caminhaoBase, capacidadeKg, pesoCarregadoKg };
    const vinculos = await this.db.select()
      .from(caminhoesPedidos)
      .where(and(eq(caminhoesPedidos.caminhaoId, caminhaoId), isNull(caminhoesPedidos.deletedAt)))
      .orderBy(asc(caminhoesPedidos.ordemNaCarga));

    if (vinculos.length === 0) return { caminhao, pedidos: [] };

    const pedidoIds = vinculos.map(v => v.pedidoVendaId);

    // Batch 1: todos os itens dos pedidos vinculados
    const itensPedido = await this.db.select({
      pedidoVendaId: pedidosVendaItens.pedidoVendaId,
      quantidadePedida: pedidosVendaItens.quantidadePedida,
    })
      .from(pedidosVendaItens)
      .where(inArray(pedidosVendaItens.pedidoVendaId, pedidoIds));

    // Batch 2: todos os carga_itens ativos do caminhão
    const itensCarregados = await this.db.select({
      pedidoVendaId: cargaItens.pedidoVendaId,
      statusCargaItem: cargaItens.statusCargaItem,
    })
      .from(cargaItens)
      .where(and(
        eq(cargaItens.caminhaoId, caminhaoId),
        isNull(cargaItens.deletedAt),
      ));

    // Agregar em memória
    const previstoPorPedido = new Map<string, number>();
    for (const i of itensPedido) {
      previstoPorPedido.set(
        i.pedidoVendaId,
        (previstoPorPedido.get(i.pedidoVendaId) ?? 0) + Number(i.quantidadePedida),
      );
    }

    const carregadoPorPedido = new Map<string, number>();
    for (const c of itensCarregados) {
      if (c.statusCargaItem !== 'removido') {
        carregadoPorPedido.set(
          c.pedidoVendaId,
          (carregadoPorPedido.get(c.pedidoVendaId) ?? 0) + 1,
        );
      }
    }

    const pedidos = vinculos.map(v => ({
      ...v,
      previsto: previstoPorPedido.get(v.pedidoVendaId) ?? 0,
      carregado: carregadoPorPedido.get(v.pedidoVendaId) ?? 0,
    }));

    return { caminhao, pedidos };
  }

  /** Lista caminhões por data de operação. */
  async listar(dataOperacao: string) {
    return this.db
      .select({
        id: caminhoes.id,
        placa: caminhoes.placa,
        motorista: caminhoes.motorista,
        rota: caminhoes.rota,
        itinerario: caminhoes.itinerario,
        operacaoId: caminhoes.operacaoId,
        frotaCaminhaoId: caminhoes.frotaCaminhaoId,
        capacidadeKg: frotaCaminhoes.capacidadeKg,
        statusCaminhao: caminhoes.statusCaminhao,
        horaAberturaCarga: caminhoes.horaAberturaCarga,
        horaFechamentoCarga: caminhoes.horaFechamentoCarga,
        horaLiberacao: caminhoes.horaLiberacao,
        observacoes: caminhoes.observacoes,
        createdAt: caminhoes.createdAt,
        updatedAt: caminhoes.updatedAt,
        deletedAt: caminhoes.deletedAt,
        dataOperacao: operacoes.data,
      })
      .from(caminhoes)
      .innerJoin(operacoes, eq(operacoes.id, caminhoes.operacaoId))
      .leftJoin(frotaCaminhoes, eq(frotaCaminhoes.id, caminhoes.frotaCaminhaoId))
      .where(and(eq(operacoes.data, dataOperacao), isNull(caminhoes.deletedAt)))
      .orderBy(asc(caminhoes.createdAt));
  }

  async dataOperacaoDoCaminhao(tx: Tx, caminhao: Pick<Caminhao, 'operacaoId'>): Promise<string> {
    const linha = await tx
      .select({ data: operacoes.data })
      .from(operacoes)
      .where(eq(operacoes.id, caminhao.operacaoId))
      .then((r) => r[0] ?? null);
    return linha?.data ?? '';
  }

  // ── internos ───────────────────────────────────────────────────────────────

  async caminhaoAtivo(tx: Tx, id: string): Promise<Caminhao> {
    const c = await tx
      .select()
      .from(caminhoes)
      .where(and(eq(caminhoes.id, id), isNull(caminhoes.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!c) throw new NotFoundException('Caminhão não encontrado');
    return c;
  }

  private async resolverMotorista(
    tx: Tx,
    id: string,
  ): Promise<{ id: string; nome: string }> {
    const motorista = await tx.select({ id: frotaMotoristas.id, nome: frotaMotoristas.nome })
      .from(frotaMotoristas)
      .where(and(eq(frotaMotoristas.id, id), eq(frotaMotoristas.status, 'ativo'), isNull(frotaMotoristas.deletedAt)))
      .then((rows) => rows[0] ?? null);
    if (!motorista) {
      throw new BadRequestException({ codigo: 'MOTORISTA_INVALIDO', message: 'Motorista não encontrado, removido ou inativo' });
    }
    return motorista;
  }

  private async resolverRota(
    tx: Tx,
    id: string | null | undefined,
  ): Promise<{ id: string; nome: string } | null> {
    if (id == null) return null;
    const rota = await tx.select({ id: rotas.id, nome: rotas.nome })
      .from(rotas)
      .where(and(eq(rotas.id, id), eq(rotas.status, 'ativo'), isNull(rotas.deletedAt)))
      .then((rows) => rows[0] ?? null);
    if (!rota) {
      throw new BadRequestException({ codigo: 'ROTA_INVALIDA', message: 'Rota não encontrada, removida ou inativa' });
    }
    return rota;
  }
}
