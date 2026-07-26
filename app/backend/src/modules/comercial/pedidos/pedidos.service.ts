import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  clientes,
  pendenciasOverbooking,
  pendenciasOverbookingHistorico,
  pedidosVenda,
  pedidosVendaItens,
  representantes,
  reservasDisponibilidade,
  rotas,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  calcularRange,
  montarPaginado,
  primeiroOuFalha,
  type ListarQuery,
  type Paginado,
} from '../../../common/crud/paginacao';
import {
  compararQtd,
  ehZero,
  formatarQtd,
  minimoQtd,
  somarListaQtd,
  somarQtd,
  subtrairQtd,
} from '../../../common/crud/decimal';
import { EVENTOS, type PayloadPorEvento } from '../../../realtime/events/eventos';
import { OperacoesService, type Tx } from '../../operacoes/operacoes.service';
import type {
  BuscarPedidoAbertoDto,
  CreatePedidoDto,
  IncluirItemDto,
  ReduzirItemDto,
  RemoverItemDto,
} from './dto/pedido.dto';
import {
  OverbookingChallengeException,
  type OverbookingChallengeItem,
} from './overbooking-challenge.exception';

export type PedidoVenda = typeof pedidosVenda.$inferSelect;
export type PedidoVendaItem = typeof pedidosVendaItens.$inferSelect;

export interface ItemSolicitado {
  itemComercialId: string;
  quantidade: number;
  observacoes?: string;
}

interface CoberturaPlanejada {
  disponibilidadeId: string;
  quantidade: string;
}

export interface PlanoItem {
  itemComercialId: string;
  quantidadeSolicitada: string;
  disponivelAntes: string;
  coberturas: CoberturaPlanejada[];
  deficit: string;
}

export type EventoDominio<N extends keyof PayloadPorEvento = keyof PayloadPorEvento> = {
  [K in N]: { nome: K; payload: PayloadPorEvento[K] };
}[N];

function ehDuplicidadeDeItemNoPedido(error: unknown): boolean {
  const pg = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = pg.code ?? pg.cause?.code;
  const constraint = pg.constraint ?? pg.cause?.constraint;
  return code === '23505' && constraint === 'uq_pedido_venda_item_comercial_ativo';
}

/** Traduz plano → itens de challenge. Exportado para o AdendosService reusar (D2). */
export function desafiosParaChallenge(plano: PlanoItem[]): OverbookingChallengeItem[] {
  return plano
    .filter((p) => compararQtd(p.deficit, '0') > 0)
    .map((p) => ({
      itemComercialId: p.itemComercialId,
      disponivelAntes: p.disponivelAntes,
      quantidadeSolicitada: p.quantidadeSolicitada,
      overbookingGerado: p.deficit,
      mensagem: 'A venda poderá ser concluída, mas a gestão deverá tratar a falta.',
    }));
}

@Injectable()
export class PedidosService {
  /** AD-03 — a chave funcional do pedido aberto é (cliente, item comercial, operação). */
  private static readonly STATUS_ABERTOS = [
    'rascunho', 'em_elaboracao_reserva_ativa', 'aguardando_confirmacao_overbooking',
  ] as const;

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

  async listar(query: ListarQuery): Promise<Paginado<PedidoVenda & {
    representanteId: string | null;
    representanteNome: string | null;
    rotaNome: string | null;
  }>> {
    const { limit, offset } = calcularRange(query);
    const where = query.incluirRemovidos ? undefined : isNull(pedidosVenda.deletedAt);
    const [linhas, totalRow] = await Promise.all([
      this.db
        .select({
          id: pedidosVenda.id,
          compraProgramadaId: pedidosVenda.compraProgramadaId,
          clienteId: pedidosVenda.clienteId,
          operacaoId: pedidosVenda.operacaoId,
          dataEntrega: pedidosVenda.dataEntrega,
          rotaPrevista: pedidosVenda.rotaPrevista,
          prioridade: pedidosVenda.prioridade,
          status: pedidosVenda.status,
          observacoesGerais: pedidosVenda.observacoesGerais,
          motivoCancelamento: pedidosVenda.motivoCancelamento,
          usuarioCriacaoId: pedidosVenda.usuarioCriacaoId,
          usuarioAprovacaoId: pedidosVenda.usuarioAprovacaoId,
          createdAt: pedidosVenda.createdAt,
          updatedAt: pedidosVenda.updatedAt,
          deletedAt: pedidosVenda.deletedAt,
          representanteId: clientes.representanteId,
          representanteNome: representantes.nome,
          rotaNome: rotas.nome,
        })
        .from(pedidosVenda)
        .leftJoin(clientes, eq(pedidosVenda.clienteId, clientes.id))
        .leftJoin(representantes, eq(clientes.representanteId, representantes.id))
        .leftJoin(rotas, eq(clientes.rotaId, rotas.id))
        .where(where)
        .orderBy(desc(pedidosVenda.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(pedidosVenda).where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string) {
    const pedido = await this.db.query.pedidosVenda.findFirst({
      where: and(eq(pedidosVenda.id, id), isNull(pedidosVenda.deletedAt)),
      with: {
        cliente: true,
        itens: { with: { itemComercial: true, reservas: { with: { disponibilidade: true } } } },
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    const [heranca] = await this.db
      .select({
        representanteId: clientes.representanteId,
        representanteNome: representantes.nome,
        rotaId: clientes.rotaId,
        rotaNome: rotas.nome,
      })
      .from(clientes)
      .leftJoin(representantes, eq(clientes.representanteId, representantes.id))
      .leftJoin(rotas, eq(clientes.rotaId, rotas.id))
      .where(eq(clientes.id, pedido.clienteId))
      .limit(1);
    return { ...pedido, heranca: heranca ?? null };
  }

  /** Devolve o pedido aberto (payload do `ModalAdendo`) ou lança 404 se a data não tem operação. */
  async buscarAberto(query: BuscarPedidoAbertoDto) {
    return this.db.transaction(async (tx) => {
      const operacao = await this.operacoes.encontrarAtivaPorData(tx, query.dataOperacao);
      if (!operacao) {
        throw new NotFoundException({
          code: 'OPERACAO_NAO_ENCONTRADA',
          message: `Não existe operação ativa em ${query.dataOperacao}.`,
        });
      }
      const [aberto] = await tx
        .select({
          pedidoId: pedidosVenda.id,
          status: pedidosVenda.status,
          itemComercialId: pedidosVendaItens.itemComercialId,
          quantidadeAtual: pedidosVendaItens.quantidadePedida,
        })
        .from(pedidosVendaItens)
        .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
        .where(and(
          eq(pedidosVenda.clienteId, query.clienteId),
          eq(pedidosVenda.operacaoId, operacao.id),
          eq(pedidosVendaItens.itemComercialId, query.itemComercialId),
          inArray(pedidosVenda.status, [...PedidosService.STATUS_ABERTOS]),
          isNull(pedidosVenda.deletedAt),
          isNull(pedidosVendaItens.deletedAt),
        ))
        .limit(1);
      return aberto ?? null;
    });
  }

  /**
   * AD-03 — recusa um novo pedido aberto do mesmo cliente/item comercial na mesma
   * operação; a inclusão adicional deve ser feita via adendo (Task 7).
   */
  private async exigirUnicidadeAd03(
    tx: Tx, clienteId: string, operacaoId: string, itensComerciaisIds: string[],
    pedidoIdIgnorado?: string,
  ): Promise<void> {
    const conflitos = await tx
      .select({
        pedidoId: pedidosVenda.id,
        itemComercialId: pedidosVendaItens.itemComercialId,
        quantidadeAtual: pedidosVendaItens.quantidadePedida,
        status: pedidosVenda.status,
      })
      .from(pedidosVendaItens)
      .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
      .where(and(
        eq(pedidosVenda.clienteId, clienteId),
        eq(pedidosVenda.operacaoId, operacaoId),
        inArray(pedidosVenda.status, [...PedidosService.STATUS_ABERTOS]),
        inArray(pedidosVendaItens.itemComercialId, itensComerciaisIds),
        isNull(pedidosVenda.deletedAt),
        isNull(pedidosVendaItens.deletedAt),
        pedidoIdIgnorado ? ne(pedidosVenda.id, pedidoIdIgnorado) : undefined,
      ));
    if (conflitos.length === 0) return;
    throw new ConflictException({
      code: 'PEDIDO_ABERTO_EXISTENTE',
      message: 'Já existe pedido aberto deste cliente para o produto nesta operação. Use o adendo.',
      conflitos,
    });
  }

  /**
   * Herança do cadastro do cliente para o pedido (matriz linha 3 / D31).
   * Rota: copiada de clientes.rota_id → rotas.nome quando o DTO não a informa.
   * Representante: NÃO é copiado — é derivado de clientes.representante_id na leitura.
   */
  private async rotaHerdadaDoCliente(tx: Tx, clienteId: string): Promise<string | null> {
    const [linha] = await tx
      .select({ nomeRota: rotas.nome })
      .from(clientes)
      .leftJoin(rotas, eq(clientes.rotaId, rotas.id))
      .where(and(eq(clientes.id, clienteId), isNull(clientes.deletedAt)))
      .limit(1);
    if (!linha) throw new NotFoundException('Cliente não encontrado');
    return linha.nomeRota ?? null;
  }

  async criar(dto: CreatePedidoDto, usuarioId: string, confirmado = false) {
    const resultado = await this.db.transaction(async (tx) => {
      const solicitados: ItemSolicitado[] = dto.itens.map((item) => ({
        itemComercialId: item.itemComercialId,
        quantidade: item.quantidadePedida,
        observacoes: item.observacoes,
      }));
      // O challenge é estritamente read-only: não chame garantirOperacao antes
      // de decidir se a confirmação é necessária.
      const operacaoExistente = await this.operacoes.encontrarAtivaPorData(
        tx, dto.dataOperacao,
      );
      // Sem operação ativa na data não pode existir pedido aberto para checar: pedidos_venda.operacao_id
      // é NOT NULL e FK para operacoes(id), logo o conjunto de conflitos é provadamente vazio.
      // A operação é criada logo abaixo por garantirOperacao (primeiro pedido do dia).
      if (operacaoExistente) {
        await this.exigirUnicidadeAd03(
          tx,
          dto.clienteId,
          operacaoExistente.id,
          solicitados.map((s) => s.itemComercialId),
        );
      }
      const plano = await this.planejarSobLock(
        tx, operacaoExistente?.id ?? null, solicitados,
      );
      const desafios = desafiosParaChallenge(plano);
      if (desafios.length && !confirmado) {
        throw new OverbookingChallengeException(desafios);
      }

      const operacao = operacaoExistente
        ?? (await this.operacoes.garantirOperacao(
          tx, dto.dataOperacao, usuarioId,
        )).operacao;
      const pedido = primeiroOuFalha(await tx.insert(pedidosVenda).values({
        compraProgramadaId: dto.compraProgramadaId,
        clienteId: dto.clienteId,
        operacaoId: operacao.id,
        dataEntrega: dto.dataEntrega,
        rotaPrevista: dto.rotaPrevista ?? (await this.rotaHerdadaDoCliente(tx, dto.clienteId)),
        prioridade: dto.prioridade,
        status: 'em_elaboracao_reserva_ativa',
        observacoesGerais: dto.observacoesGerais,
        usuarioCriacaoId: usuarioId,
      }).returning());

      await this.auditoria.registrar(tx, {
        tabela: 'pedidos_venda',
        registroId: pedido.id,
        operacao: 'INSERT',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: pedido,
      });

      return this.persistirItensPlanejados(tx, pedido, solicitados, plano, usuarioId);
    });
    this.emitirEventosPosCommit(resultado.eventos);
    return resultado.pedido;
  }

  async incluirItem(
    pedidoId: string,
    dto: IncluirItemDto,
    usuarioId: string,
    confirmado = false,
  ) {
    let resultadoInclusao: { pedido: PedidoVenda; eventos: EventoDominio[] };
    try {
      resultadoInclusao = await this.db.transaction((tx) =>
        this.incluirItemTransacional(tx, pedidoId, dto, usuarioId, confirmado),
      );
    } catch (error) {
      if (ehDuplicidadeDeItemNoPedido(error)) {
        throw new ConflictException('Item comercial já existe neste pedido');
      }
      throw error;
    }
    this.emitirEventosPosCommit(resultadoInclusao.eventos);
    return resultadoInclusao.pedido;
  }

  private async incluirItemTransacional(
    tx: Tx,
    pedidoId: string,
    dto: IncluirItemDto,
    usuarioId: string,
    confirmado: boolean,
  ): Promise<{ pedido: PedidoVenda; eventos: EventoDominio[] }> {
    const pedido = await this.obterPedidoAtivoSobLock(tx, pedidoId);
    if (pedido.status === 'cancelado' || pedido.status === 'finalizado') {
      throw new ConflictException('Pedido não aceita novos itens');
    }

    const itemExistente = await tx.select({ id: pedidosVendaItens.id })
      .from(pedidosVendaItens)
      .where(and(
        eq(pedidosVendaItens.pedidoVendaId, pedido.id),
        eq(pedidosVendaItens.itemComercialId, dto.itemComercialId),
        isNull(pedidosVendaItens.deletedAt),
      )).limit(1);
    if (itemExistente.length) {
      throw new ConflictException('Item comercial já existe neste pedido');
    }

    // Pedido é dado persistido com operacao_id NOT NULL; a leitura é explícita e
    // falha alto se o invariante for violado (nunca infere ou inventa a operação).
    if (!pedido.operacaoId) {
      throw new ConflictException({
        code: 'PEDIDO_SEM_OPERACAO',
        message: 'Pedido sem operação vinculada; não é possível validar a unicidade AD-03.',
      });
    }
    await this.exigirUnicidadeAd03(
      tx, pedido.clienteId, pedido.operacaoId, [dto.itemComercialId], pedido.id,
    );

    const solicitado: ItemSolicitado = {
      itemComercialId: dto.itemComercialId,
      quantidade: dto.quantidade,
      observacoes: dto.observacoes,
    };
    const plano = await this.planejarSobLock(tx, pedido.operacaoId, [solicitado]);
    const desafios = desafiosParaChallenge(plano);
    if (desafios.length && !confirmado) {
      throw new OverbookingChallengeException(desafios);
    }
    // Nenhum INSERT/UPDATE pode existir antes deste ponto (exceto locks de leitura).
    return this.persistirItensPlanejados(tx, pedido, [solicitado], plano, usuarioId);
  }

  async planejarSobLock(
    tx: Tx,
    operacaoId: string | null,
    itens: ItemSolicitado[],
  ): Promise<PlanoItem[]> {
    const ids = itens.map((item) => item.itemComercialId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('item comercial duplicado no mesmo pedido');
    }
    const resultado = operacaoId === null
      ? { rows: [] as Array<{
        id: string;
        item_comercial_id: string;
        quantidade_disponivel: string;
      }> }
      : await tx.execute<{
        id: string;
        item_comercial_id: string;
        quantidade_disponivel: string;
      }>(sql`
        SELECT id, item_comercial_id, quantidade_disponivel
        FROM disponibilidades_virtuais
        WHERE operacao_id=${operacaoId}
          AND item_comercial_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
          AND quantidade_disponivel > 0
        ORDER BY created_at, id
        FOR UPDATE
      `);

    return itens.map((item) => {
      let restante = formatarQtd(item.quantidade);
      const linhas = resultado.rows.filter((row) => row.item_comercial_id === item.itemComercialId);
      const disponivelAntes = somarListaQtd(linhas.map((row) => row.quantidade_disponivel));
      const coberturas: CoberturaPlanejada[] = [];
      for (const row of linhas) {
        if (ehZero(restante)) break;
        const quantidade = minimoQtd(restante, row.quantidade_disponivel);
        coberturas.push({ disponibilidadeId: row.id, quantidade });
        restante = subtrairQtd(restante, quantidade);
      }
      return {
        itemComercialId: item.itemComercialId,
        quantidadeSolicitada: formatarQtd(item.quantidade),
        disponivelAntes,
        coberturas,
        deficit: restante,
      };
    });
  }

  async persistirItensPlanejados(
    tx: Tx,
    pedido: PedidoVenda,
    solicitados: ItemSolicitado[],
    plano: PlanoItem[],
    usuarioId: string,
  ): Promise<{ pedido: PedidoVenda; eventos: EventoDominio[] }> {
    const eventos: EventoDominio[] = [];
    for (const [indice, alocacao] of plano.entries()) {
      const solicitado = solicitados[indice];
      if (!solicitado) throw new Error('Plano sem item solicitado correspondente');
      const quantidadeReal = somarListaQtd(alocacao.coberturas.map((c) => c.quantidade));
      const [item] = await tx.insert(pedidosVendaItens).values({
        pedidoVendaId: pedido.id,
        itemComercialId: solicitado.itemComercialId,
        quantidadePedida: alocacao.quantidadeSolicitada,
        quantidadeReservada: quantidadeReal,
        quantidadePendente: '0.000',
        quantidadeOverbooking: alocacao.deficit,
        status: ehZero(alocacao.deficit) ? 'totalmente_reservado' : 'overbooking_confirmado',
        observacoes: solicitado.observacoes,
      }).returning();
      if (!item) throw new Error('Falha ao persistir item do pedido');
      eventos.push(...await this.aplicarAlocacaoNoItem(tx, pedido, item, alocacao, usuarioId));
      eventos.push({
        nome: EVENTOS.PEDIDO_VENDA_ITEM_CRIADO,
        payload: { pedidoVendaId: pedido.id, itemId: item.id },
      });
    }
    return { pedido, eventos };
  }

  /**
   * Consome as coberturas planejadas e o déficit de um item de pedido JÁ persistido.
   * Extraído de persistirItensPlanejados para que o adendo reuse o motor de reserva
   * sem duplicar regra (D2). Devolve os eventos a emitir após o commit.
   */
  async aplicarAlocacaoNoItem(
    tx: Tx,
    pedido: PedidoVenda,
    item: PedidoVendaItem,
    alocacao: PlanoItem,
    usuarioId: string,
  ): Promise<EventoDominio[]> {
    const eventos: EventoDominio[] = [];
    for (const cobertura of alocacao.coberturas) {
      const atualizada = await tx.execute<{ id: string }>(sql`
        UPDATE disponibilidades_virtuais
        SET quantidade_reservada=quantidade_reservada+${cobertura.quantidade}::numeric,
            quantidade_disponivel=quantidade_disponivel-${cobertura.quantidade}::numeric,
            status=CASE
              WHEN quantidade_disponivel-${cobertura.quantidade}::numeric=0 THEN 'esgotada'
              ELSE 'parcialmente_reservada'
            END
        WHERE id=${cobertura.disponibilidadeId}
          AND quantidade_disponivel >= ${cobertura.quantidade}::numeric
        RETURNING id
      `);
      if (atualizada.rows.length !== 1) {
        throw new ConflictException('Saldo mudou durante a confirmação; refaça a operação');
      }
      await tx.insert(reservasDisponibilidade).values({
        disponibilidadeVirtualId: cobertura.disponibilidadeId,
        pedidoVendaItemId: item.id,
        quantidadeReservada: cobertura.quantidade,
        tipoConsumo: 'virtual',
        status: 'ativa',
      });
    }
    if (ehZero(alocacao.deficit)) return eventos;

    if (!pedido.operacaoId) {
      throw new ConflictException('Pedido sem operação não pode gerar overbooking');
    }
    await tx.insert(reservasDisponibilidade).values({
      disponibilidadeVirtualId: null,
      pedidoVendaItemId: item.id,
      quantidadeReservada: alocacao.deficit,
      tipoConsumo: 'overbooking',
      status: 'ativa',
    });
    const pendenciaId = await this.abrirOuAcumularPendencia(tx, pedido, item, alocacao.deficit, usuarioId);
    eventos.push({
      nome: EVENTOS.PENDENCIA_OVERBOOKING_ABERTA,
      payload: { pendenciaId, pedidoVendaId: pedido.id },
    });
    eventos.push({
      nome: EVENTOS.OVERBOOKING_CONFIRMADO,
      payload: {
        pedidoVendaId: pedido.id,
        itemId: item.id,
        quantidadeOverbooking: alocacao.deficit,
      },
    });
    return eventos;
  }

  /**
   * Abre a pendência de overbooking do item ou soma o déficit à pendência aberta.
   * Só existe pendência aberta quando o item recebeu adendo deficitário antes; na
   * criação do item o caminho é sempre o INSERT (comportamento da Onda 1 preservado).
   * Acumular em vez de duplicar é obrigatório: atualizarOuCancelarPendencia
   * (reduzirItem/removerItem) resolve UMA pendência aberta por item.
   */
  private async abrirOuAcumularPendencia(
    tx: Tx,
    pedido: PedidoVenda,
    item: PedidoVendaItem,
    deficit: string,
    usuarioId: string,
  ): Promise<string> {
    const [aberta] = await tx.select().from(pendenciasOverbooking)
      .where(and(
        eq(pendenciasOverbooking.pedidoVendaItemId, item.id),
        notInArray(pendenciasOverbooking.status, ['resolvida', 'cancelada']),
        isNull(pendenciasOverbooking.deletedAt),
      ))
      .for('update')
      .limit(1);
    if (aberta) {
      const acumulado = somarQtd(aberta.quantidadeDeficit, deficit);
      await tx.update(pendenciasOverbooking)
        .set({ quantidadeDeficit: acumulado, updatedAt: new Date() })
        .where(eq(pendenciasOverbooking.id, aberta.id));
      await tx.insert(pendenciasOverbookingHistorico).values({
        pendenciaId: aberta.id,
        acao: 'deficit_aumentado_por_adendo',
        autorId: usuarioId,
        detalheJson: { deficitAdicionado: deficit, deficitTotal: acumulado },
      });
      return aberta.id;
    }
    const [pendencia] = await tx.insert(pendenciasOverbooking).values({
      pedidoVendaId: pedido.id, pedidoVendaItemId: item.id,
      itemComercialId: item.itemComercialId, clienteId: pedido.clienteId,
      vendedorUsuarioId: usuarioId, operacaoId: pedido.operacaoId,
      quantidadeDeficit: deficit,
    }).returning();
    if (!pendencia) throw new Error('Falha ao abrir pendência de overbooking');
    await tx.insert(pendenciasOverbookingHistorico).values({
      pendenciaId: pendencia.id, acao: 'confirmada_pelo_vendedor', autorId: usuarioId,
    });
    return pendencia.id;
  }

  /** Carrega sob lock o pedido que vai receber adendo. Só estados abertos de AD-03 (D7). */
  async carregarAbertoParaAdendo(tx: Tx, pedidoId: string): Promise<PedidoVenda> {
    const [pedido] = await tx.select().from(pedidosVenda)
      .where(and(eq(pedidosVenda.id, pedidoId), isNull(pedidosVenda.deletedAt)))
      .for('update')
      .limit(1);
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (!(PedidosService.STATUS_ABERTOS as readonly string[]).includes(pedido.status)) {
      throw new ConflictException({
        code: 'PEDIDO_NAO_ABERTO',
        message: 'O adendo só se aplica a pedido aberto (rascunho, em elaboração ou aguardando '
          + 'confirmação de overbooking).',
      });
    }
    return pedido;
  }

  /** Exige que o produto JÁ esteja no pedido: adendo aumenta item, não cria item. */
  async exigirItemDoPedido(
    tx: Tx, pedidoId: string, itemComercialId: string,
  ): Promise<PedidoVendaItem> {
    const [item] = await tx.select().from(pedidosVendaItens)
      .where(and(
        eq(pedidosVendaItens.pedidoVendaId, pedidoId),
        eq(pedidosVendaItens.itemComercialId, itemComercialId),
        isNull(pedidosVendaItens.deletedAt),
      ))
      .for('update')
      .limit(1);
    if (!item) {
      throw new NotFoundException({
        code: 'ITEM_NAO_ESTA_NO_PEDIDO',
        message: 'O produto não está neste pedido; use a inclusão de item.',
      });
    }
    return item;
  }

  async reduzirItem(
    pedidoId: string,
    itemId: string,
    dto: ReduzirItemDto,
    usuarioId: string,
  ): Promise<void> {
    const novaQuantidade = formatarQtd(dto.novaQuantidade);
    await this.db.transaction(async (tx) => {
      const item = await tx.select().from(pedidosVendaItens)
        .where(and(
          eq(pedidosVendaItens.id, itemId),
          eq(pedidosVendaItens.pedidoVendaId, pedidoId),
          isNull(pedidosVendaItens.deletedAt),
        ))
        .then((rows) => rows[0]);
      if (!item) throw new NotFoundException('Item do pedido não encontrado');
      if (compararQtd(novaQuantidade, item.quantidadePedida) >= 0) {
        throw new ConflictException('A operação aceita somente redução');
      }
      const reducao = subtrairQtd(item.quantidadePedida, novaQuantidade);
      const tirarOverbooking = minimoQtd(reducao, item.quantidadeOverbooking);
      const devolverReal = subtrairQtd(reducao, tirarOverbooking);
      if (!ehZero(tirarOverbooking)) {
        await this.reduzirReservaOverbooking(tx, item.id, tirarOverbooking);
        await this.atualizarOuCancelarPendencia(tx, item.id, tirarOverbooking, usuarioId);
      }
      if (!ehZero(devolverReal)) {
        await this.liberarReservaReal(tx, item.id, devolverReal);
      }
      const novaOverbooking = subtrairQtd(item.quantidadeOverbooking, tirarOverbooking);
      const novaReservada = subtrairQtd(item.quantidadeReservada, devolverReal);
      const [itemAtualizado] = await tx.update(pedidosVendaItens).set({
        quantidadePedida: novaQuantidade,
        quantidadeReservada: novaReservada,
        quantidadeOverbooking: novaOverbooking,
        status: ehZero(novaOverbooking) ? 'totalmente_reservado' : 'overbooking_confirmado',
        updatedAt: new Date(),
      }).where(eq(pedidosVendaItens.id, itemId)).returning();
      await this.auditoria.registrar(tx, {
        tabela: 'pedidos_venda_itens',
        registroId: itemId,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: item,
        dadosNovos: { ...itemAtualizado, motivo: dto.motivo },
      });
    });
  }

  async reduzirReservaOverbooking(tx: Tx, itemId: string, quantidade: string) {
    const reserva = await tx.select().from(reservasDisponibilidade)
      .where(and(
        eq(reservasDisponibilidade.pedidoVendaItemId, itemId),
        eq(reservasDisponibilidade.tipoConsumo, 'overbooking'),
        eq(reservasDisponibilidade.status, 'ativa'),
      )).then((rows) => rows[0]);
    if (!reserva) throw new ConflictException('Reserva de overbooking ativa não encontrada');
    const restante = subtrairQtd(reserva.quantidadeReservada, quantidade);
    await tx.update(reservasDisponibilidade).set(
      ehZero(restante) ? { status: 'liberada' } : { quantidadeReservada: restante },
    ).where(eq(reservasDisponibilidade.id, reserva.id));
  }

  async atualizarOuCancelarPendencia(tx: Tx, itemId: string, reducao: string, usuarioId: string) {
    const pendencia = await tx.select().from(pendenciasOverbooking)
      .where(and(
        eq(pendenciasOverbooking.pedidoVendaItemId, itemId),
        notInArray(pendenciasOverbooking.status, ['resolvida', 'cancelada']),
        isNull(pendenciasOverbooking.deletedAt),
      )).then((rows) => rows[0]);
    if (!pendencia) throw new ConflictException('Pendência ativa não encontrada');
    const restante = subtrairQtd(pendencia.quantidadeDeficit, reducao);
    const status = ehZero(restante) ? 'cancelada' : pendencia.status;
    // chk_pend_ovb_deficit exige > 0: ao zerar, cancela mantendo o último déficit positivo.
    await tx.update(pendenciasOverbooking)
      .set({
        ...(ehZero(restante) ? {} : { quantidadeDeficit: restante }),
        status,
        updatedAt: new Date(),
      })
      .where(eq(pendenciasOverbooking.id, pendencia.id));
    await tx.insert(pendenciasOverbookingHistorico).values({
      pendenciaId: pendencia.id,
      acao: ehZero(restante) ? 'cancelada_por_reducao' : 'deficit_reduzido',
      autorId: usuarioId,
      detalheJson: { reducao, restante },
    });
  }

  async liberarReservaReal(tx: Tx, itemId: string, quantidade: string) {
    let restante = quantidade;
    const reservas = await tx.select().from(reservasDisponibilidade)
      .where(and(
        eq(reservasDisponibilidade.pedidoVendaItemId, itemId),
        inArray(reservasDisponibilidade.tipoConsumo, ['fisico', 'virtual']),
        eq(reservasDisponibilidade.status, 'ativa'),
      )).orderBy(desc(reservasDisponibilidade.createdAt));
    for (const reserva of reservas) {
      if (ehZero(restante)) break;
      if (!reserva.disponibilidadeVirtualId) throw new Error('Reserva real sem disponibilidade');
      const devolver = minimoQtd(restante, reserva.quantidadeReservada);
      await this.devolverSaldo(tx, reserva.disponibilidadeVirtualId, devolver);
      const saldoReserva = subtrairQtd(reserva.quantidadeReservada, devolver);
      await tx.update(reservasDisponibilidade).set(
        ehZero(saldoReserva) ? { status: 'liberada' } : { quantidadeReservada: saldoReserva },
      ).where(eq(reservasDisponibilidade.id, reserva.id));
      restante = subtrairQtd(restante, devolver);
    }
    if (!ehZero(restante)) throw new ConflictException('Reserva real insuficiente para redução');
  }

  async liberarTodasReservasDoItem(tx: Tx, itemId: string): Promise<void> {
    const reservasAtivas = await tx.select().from(reservasDisponibilidade)
      .where(and(
        eq(reservasDisponibilidade.pedidoVendaItemId, itemId),
        eq(reservasDisponibilidade.status, 'ativa'),
      ))
      .orderBy(desc(reservasDisponibilidade.createdAt));

    for (const reserva of reservasAtivas) {
      if (reserva.tipoConsumo === 'overbooking') {
        await tx.update(reservasDisponibilidade).set({ status: 'liberada' })
          .where(eq(reservasDisponibilidade.id, reserva.id));
        continue; // nunca credita disponibilidade
      }
      if (!reserva.disponibilidadeVirtualId) throw new Error('Reserva real sem disponibilidade');
      await this.devolverSaldo(tx, reserva.disponibilidadeVirtualId, reserva.quantidadeReservada);
      await tx.update(reservasDisponibilidade).set({ status: 'liberada' })
        .where(eq(reservasDisponibilidade.id, reserva.id));
    }
  }

  async cancelarPendenciasDoPedido(tx: Tx, pedidoId: string, usuarioId: string): Promise<void> {
    const pendencias = await tx.select().from(pendenciasOverbooking)
      .where(and(
        eq(pendenciasOverbooking.pedidoVendaId, pedidoId),
        notInArray(pendenciasOverbooking.status, ['resolvida', 'cancelada']),
        isNull(pendenciasOverbooking.deletedAt),
      ));
    for (const pendencia of pendencias) {
      await tx.update(pendenciasOverbooking)
        .set({ status: 'cancelada', responsavelId: usuarioId, updatedAt: new Date() })
        .where(eq(pendenciasOverbooking.id, pendencia.id));
      await tx.insert(pendenciasOverbookingHistorico).values({
        pendenciaId: pendencia.id,
        acao: 'cancelada_com_pedido',
        autorId: usuarioId,
      });
    }
  }

  async removerItem(
    pedidoId: string,
    itemId: string,
    dto: RemoverItemDto,
    usuarioId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const item = await this.obterItemAtivoSobLock(tx, pedidoId, itemId);
      await this.liberarTodasReservasDoItem(tx, item.id);
      if (!ehZero(item.quantidadeOverbooking)) {
        await this.atualizarOuCancelarPendencia(
          tx,
          item.id,
          item.quantidadeOverbooking,
          usuarioId,
        );
      }
      await tx.update(pedidosVendaItens)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(pedidosVendaItens.id, item.id));
      await this.auditoria.registrar(tx, {
        tabela: 'pedidos_venda_itens',
        registroId: item.id,
        operacao: 'DELETE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: item,
        dadosNovos: { motivo: dto.motivo },
      });
    });
  }

  async cancelarPedido(pedidoId: string, motivo: string, usuarioId: string): Promise<PedidoVenda> {
    return this.db.transaction(async (tx) => {
      const pedido = await this.obterPedidoAtivoSobLock(tx, pedidoId);
      if (pedido.status === 'cancelado') throw new ConflictException('Pedido já cancelado');
      const itens = await tx.select().from(pedidosVendaItens)
        .where(and(
          eq(pedidosVendaItens.pedidoVendaId, pedido.id),
          isNull(pedidosVendaItens.deletedAt),
        ));
      for (const item of itens) await this.liberarTodasReservasDoItem(tx, item.id);
      await this.cancelarPendenciasDoPedido(tx, pedido.id, usuarioId);
      const cancelado = primeiroOuFalha(await tx.update(pedidosVenda)
        .set({ status: 'cancelado', motivoCancelamento: motivo, updatedAt: new Date() })
        .where(eq(pedidosVenda.id, pedido.id))
        .returning());
      await this.auditoria.registrar(tx, {
        tabela: 'pedidos_venda',
        registroId: pedido.id,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: pedido,
        dadosNovos: cancelado,
      });
      return cancelado;
    });
  }

  async finalizar(pedidoId: string, usuarioId: string): Promise<PedidoVenda> {
    const resultado = await this.db.transaction(async (tx) => {
      const pedido = await this.obterPedidoAtivoSobLock(tx, pedidoId);
      if (pedido.status === 'cancelado') throw new ConflictException('Pedido cancelado');
      if (pedido.status === 'finalizado') throw new ConflictException('Pedido já finalizado');

      const pendenteLegado = await tx.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
        .where(and(
          eq(pedidosVendaItens.pedidoVendaId, pedidoId),
          eq(pedidosVendaItens.status, 'aguardando_confirmacao_overbooking'),
          isNull(pedidosVendaItens.deletedAt),
        )).limit(1);
      if (pendenteLegado.length) {
        throw new ConflictException('OVERBOOKING_CONFIRMACAO_NECESSARIA');
      }
      // overbooking_confirmado é aceito; não tocar no saldo.

      const finalizado = primeiroOuFalha(await tx.update(pedidosVenda)
        .set({ status: 'finalizado', updatedAt: new Date() })
        .where(eq(pedidosVenda.id, pedidoId))
        .returning());
      await this.auditoria.registrar(tx, {
        tabela: 'pedidos_venda',
        registroId: pedidoId,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: pedido,
        dadosNovos: finalizado,
      });
      return {
        pedido: finalizado,
        eventos: [{
          nome: EVENTOS.PEDIDO_FINALIZADO,
          payload: { pedidoVendaId: pedidoId },
        }] as EventoDominio[],
      };
    });
    this.emitirEventosPosCommit(resultado.eventos);
    return resultado.pedido;
  }

  private emitirEventosPosCommit(eventos: EventoDominio[]): void {
    for (const evento of eventos) {
      this.eventEmitter.emit(evento.nome, evento.payload);
    }
  }

  private async obterPedidoAtivoSobLock(tx: Tx, pedidoId: string): Promise<PedidoVenda> {
    const [pedido] = await tx.select().from(pedidosVenda)
      .where(and(eq(pedidosVenda.id, pedidoId), isNull(pedidosVenda.deletedAt)))
      .for('update')
      .limit(1);
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    return pedido;
  }

  private async obterItemAtivoSobLock(
    tx: Tx,
    pedidoId: string,
    itemId: string,
  ): Promise<PedidoVendaItem> {
    const [item] = await tx.select().from(pedidosVendaItens)
      .where(and(
        eq(pedidosVendaItens.id, itemId),
        eq(pedidosVendaItens.pedidoVendaId, pedidoId),
        isNull(pedidosVendaItens.deletedAt),
      ))
      .for('update')
      .limit(1);
    if (!item) throw new NotFoundException('Item do pedido não encontrado');
    return item;
  }

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
