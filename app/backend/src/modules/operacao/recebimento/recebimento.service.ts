import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { comprasProgramadas, recebimentos, recebimentosItens } from '../../../database/schema';
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
import { DisponibilidadeService, type PedidoEmRisco } from '../../comercial/disponibilidade/disponibilidade.service';
import { DivergenciaRecebimentoService } from './divergencia/divergencia-recebimento.service';
import type { IniciarRecebimentoDto, RegistrarItemDto } from './dto/recebimento.dto';

type Tx = NodePgDatabase<typeof schema>;
type Recebimento = typeof recebimentos.$inferSelect;

@Injectable()
export class RecebimentoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly disponibilidade: DisponibilidadeService,
    private readonly divergencias: DivergenciaRecebimentoService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<Recebimento>> {
    const { limit, offset } = calcularRange(query);
    const where = query.incluirRemovidos ? undefined : isNull(recebimentos.deletedAt);
    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(recebimentos).where(where).orderBy(desc(recebimentos.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(recebimentos).where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  /** Detalhe com rastreabilidade: recebimento → itens → divergências. */
  async detalhar(id: string) {
    const recebimento = await this.db.query.recebimentos.findFirst({
      where: and(eq(recebimentos.id, id), isNull(recebimentos.deletedAt)),
      with: {
        fornecedor: true,
        itens: { with: { itemComercial: true } },
        divergencias: true,
      },
    });
    if (!recebimento) throw new NotFoundException('Recebimento não encontrado');
    return recebimento;
  }

  /**
   * Inicia o recebimento sobre uma compra CONFIRMADA (lote do dia). Itens
   * esperados derivam da disponibilidade do dia (fonte de verdade — Refino 1).
   * Idempotente: a unique parcial em compra_programada_id garante 1 recebimento
   * ativo; chamada repetida retorna o existente (jaIniciado). Evento pós-commit.
   */
  async iniciar(dto: IniciarRecebimentoDto, usuarioId: string): Promise<{ recebimento: Recebimento; jaIniciado: boolean }> {
    const resultado = await this.db.transaction(async (tx) => {
      const compra = await tx
        .select()
        .from(comprasProgramadas)
        .where(and(eq(comprasProgramadas.id, dto.compraProgramadaId), isNull(comprasProgramadas.deletedAt)))
        .then((r) => r[0] ?? null);
      if (!compra) throw new NotFoundException('Compra programada não encontrada');
      if (compra.status !== 'confirmada') {
        throw new ConflictException('Recebimento só pode ser iniciado sobre compra confirmada');
      }

      const existente = await tx
        .select()
        .from(recebimentos)
        .where(and(eq(recebimentos.compraProgramadaId, dto.compraProgramadaId), isNull(recebimentos.deletedAt)))
        .then((r) => r[0] ?? null);
      if (existente) return { recebimento: existente, jaIniciado: true };

      const criado = primeiroOuFalha(
        await tx
          .insert(recebimentos)
          .values({
            compraProgramadaId: compra.id,
            fornecedorId: compra.fornecedorId,
            dataOperacao: compra.dataOperacao,
            dataHoraChegada: dto.dataHoraChegada ? new Date(dto.dataHoraChegada) : undefined,
            notaFiscalFornecedor: dto.notaFiscalFornecedor,
            placaVeiculo: dto.placaVeiculo,
            motorista: dto.motorista,
            doca: dto.doca,
            observacoes: dto.observacoes,
            responsavelRecebimentoId: usuarioId,
            status: 'em_andamento',
          })
          .returning(),
      );

      // Itens esperados: derivados da disponibilidade do dia (não digitados).
      const esperados = await this.disponibilidade.listarEsperadoDaCompra(tx, compra.id);
      if (esperados.length > 0) {
        await tx.insert(recebimentosItens).values(
          esperados.map((e) => ({
            recebimentoId: criado.id,
            itemComercialId: e.itemComercialId,
            quantidadeEsperada: e.quantidadeTotalGerada,
            quantidadeRecebida: '0',
            statusApuracao: 'aguardando' as const,
          })),
        );
      }

      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos',
        registroId: criado.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: criado,
      });

      return { recebimento: criado, jaIniciado: false };
    });

    if (!resultado.jaIniciado) {
      this.eventEmitter.emit(EVENTOS.RECEBIMENTO_INICIADO, {
        recebimentoId: resultado.recebimento.id,
        compraProgramadaId: resultado.recebimento.compraProgramadaId,
        dataOperacao: resultado.recebimento.dataOperacao,
      });
    }
    return resultado;
  }

  /**
   * Registra a conferência de um item. O sistema computa a diferença
   * esperado×recebido; qualquer diferença (ou item excedente) EXIGE divergência
   * formal inline — ajuste sem ocorrência é rejeitado (409, RA-06). Impacto na
   * disponibilidade aplicado por delta na mesma transação (Refino 2). Pedido em
   * risco avaliado apenas quando há divergência (evita falso alerta em parcial).
   */
  async registrarItem(recebimentoId: string, dto: RegistrarItemDto, usuarioId: string): Promise<{ itemId: string }> {
    const resultado = await this.db.transaction(async (tx) => {
      const recebimento = await this.buscarAtivo(tx, recebimentoId);
      if (!recebimento) throw new NotFoundException('Recebimento não encontrado');
      if (recebimento.status === 'concluido') {
        throw new ConflictException('Recebimento concluído é imutável');
      }

      const recebido = formatarQtd(dto.quantidadeRecebida);

      let item = await tx
        .select()
        .from(recebimentosItens)
        .where(
          and(
            eq(recebimentosItens.recebimentoId, recebimentoId),
            eq(recebimentosItens.itemComercialId, dto.itemComercialId),
          ),
        )
        .then((r) => r[0] ?? null);

      const ehExcedente = !item;
      if (!item) {
        // Item não esperado: cria linha com esperada=0 (exige divergência item_excedente).
        item = primeiroOuFalha(
          await tx
            .insert(recebimentosItens)
            .values({
              recebimentoId,
              itemComercialId: dto.itemComercialId,
              quantidadeEsperada: '0',
              quantidadeRecebida: '0',
              statusApuracao: 'aguardando',
            })
            .returning(),
        );
      }

      const recebidaAnterior = item.quantidadeRecebida;
      // Divergente já aplicado à disponibilidade: só conta se o item já estava
      // marcado 'divergente' (item ainda 'aguardando'/'conforme' contribuiu com 0).
      const divergenteAnterior =
        item.statusApuracao === 'divergente' ? this.calcularDivergente(item.quantidadeEsperada, recebidaAnterior) : '0';
      const diff = subtrairQtd(item.quantidadeEsperada, recebido);
      const temDiferenca = ehExcedente || !ehZero(diff);

      // Qualquer diferença exige divergência formal inline.
      if (temDiferenca && !dto.divergencia) {
        throw new ConflictException('Diferença esperado×recebido exige registro formal de divergência');
      }

      const statusApuracao = temDiferenca ? 'divergente' : 'conforme';
      const atualizado = primeiroOuFalha(
        await tx
          .update(recebimentosItens)
          .set({
            quantidadeRecebida: recebido,
            pesoTotalApurado: dto.pesoTotalApurado !== undefined ? formatarQtd(dto.pesoTotalApurado) : item.pesoTotalApurado,
            statusApuracao,
            observacoes: dto.observacoes ?? item.observacoes,
          })
          .where(eq(recebimentosItens.id, item.id))
          .returning(),
      );

      let divergenciaAberta: { id: string; tipo: string } | null = null;
      if (temDiferenca && dto.divergencia) {
        const divergencia = await this.divergencias.abrirNaTx(
          tx,
          {
            recebimentoId,
            recebimentoItemId: atualizado.id,
            ...dto.divergencia,
          },
          usuarioId,
        );
        divergenciaAberta = { id: divergencia.id, tipo: divergencia.tipo };
        // Sinaliza o cabeçalho como com_divergencia (sem sobrescrever conclusão).
        await tx
          .update(recebimentos)
          .set({ status: 'com_divergencia' })
          .where(and(eq(recebimentos.id, recebimentoId), ne(recebimentos.status, 'concluido')));
      }

      // Impacto incremental por delta na disponibilidade (excedente não tem linha).
      const divergenteNovo = this.calcularDivergente(atualizado.quantidadeEsperada, recebido);
      const deltaRecebido = subtrairQtd(recebido, recebidaAnterior);
      const deltaComDivergencia = subtrairQtd(divergenteNovo, divergenteAnterior);
      if (!ehExcedente) {
        await this.disponibilidade.aplicarRecebimentoDelta(
          tx,
          {
            compraProgramadaId: recebimento.compraProgramadaId,
            itemComercialId: dto.itemComercialId,
            deltaRecebido,
            deltaComDivergencia,
          },
          usuarioId,
        );
      }

      // Pedido em risco: só quando há divergência (não a cada parcial — evita ruído).
      let pedidosEmRisco: PedidoEmRisco[] = [];
      if (divergenciaAberta && !ehExcedente) {
        pedidosEmRisco = await this.disponibilidade.listarPedidosEmRisco(
          tx,
          recebimento.compraProgramadaId,
          dto.itemComercialId,
        );
      }

      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos_itens',
        registroId: atualizado.id,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: item,
        dadosNovos: atualizado,
      });

      return {
        itemId: atualizado.id,
        dataOperacao: recebimento.dataOperacao,
        itemComercialId: dto.itemComercialId,
        divergenciaAberta,
        pedidosEmRisco,
      };
    });

    // PÓS-COMMIT (ADR-004).
    this.eventEmitter.emit(EVENTOS.RECEBIMENTO_REGISTRADO, {
      recebimentoId,
      dataOperacao: resultado.dataOperacao,
      etapa: 'item' as const,
      itemComercialId: resultado.itemComercialId,
    });
    if (resultado.divergenciaAberta) {
      this.eventEmitter.emit(EVENTOS.DIVERGENCIA_RECEBIMENTO_ABERTA, {
        divergenciaId: resultado.divergenciaAberta.id,
        recebimentoId,
        dataOperacao: resultado.dataOperacao,
        tipo: resultado.divergenciaAberta.tipo,
        status: 'aberta',
      });
    }
    if (resultado.pedidosEmRisco.length > 0) {
      this.eventEmitter.emit(EVENTOS.PEDIDO_EM_RISCO, {
        dataOperacao: resultado.dataOperacao,
        origem: 'recebimento' as const,
        pedidos: resultado.pedidosEmRisco,
      });
    }

    return { itemId: resultado.itemId };
  }

  /**
   * Conclui o recebimento. Bloqueia (409) se houver divergência ainda 'aberta'
   * (sem tratativa). Idempotente: UPDATE condicional por status (concluir 2× não
   * duplica efeito). Reconcilia pedidos em risco (recebido final vs reservado).
   */
  async concluir(recebimentoId: string, usuarioId: string): Promise<{ recebimento: Recebimento; jaConcluido: boolean }> {
    const resultado = await this.db.transaction(async (tx) => {
      const atual = await this.buscarAtivo(tx, recebimentoId);
      if (!atual) throw new NotFoundException('Recebimento não encontrado');

      const abertas = await this.divergencias.contarAbertasSemTratativa(tx, recebimentoId);
      if (abertas > 0) {
        throw new ConflictException('Não é permitido concluir com divergência sem tratativa registrada');
      }

      const concluido = await tx
        .update(recebimentos)
        .set({ status: 'concluido', usuarioConclusaoId: usuarioId, dataConclusao: sql`now()` })
        .where(and(eq(recebimentos.id, recebimentoId), ne(recebimentos.status, 'concluido')))
        .returning()
        .then((r) => r[0] ?? null);

      if (!concluido) {
        // Já concluído (por esta ou outra chamada concorrente) → no-op idempotente.
        // Re-lê para devolver o estado concluído consistente (não o 'atual' obsoleto).
        const jaConcluido = primeiroOuFalha(await this.buscarAtivo(tx, recebimentoId).then((r) => (r ? [r] : [])));
        return { recebimento: jaConcluido, jaConcluido: true, dataOperacao: jaConcluido.dataOperacao, pedidosEmRisco: [] as PedidoEmRisco[] };
      }

      // Reconciliação final: pedidos em risco por item (recebido final vs reservado).
      const itens = await tx
        .select({ itemComercialId: recebimentosItens.itemComercialId })
        .from(recebimentosItens)
        .where(eq(recebimentosItens.recebimentoId, recebimentoId));
      const pedidosEmRisco: PedidoEmRisco[] = [];
      for (const it of itens) {
        const risco = await this.disponibilidade.listarPedidosEmRisco(tx, concluido.compraProgramadaId, it.itemComercialId);
        pedidosEmRisco.push(...risco);
      }

      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos',
        registroId: recebimentoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: atual,
        dadosNovos: concluido,
      });

      return { recebimento: concluido, jaConcluido: false, dataOperacao: concluido.dataOperacao, pedidosEmRisco };
    });

    if (!resultado.jaConcluido) {
      this.eventEmitter.emit(EVENTOS.RECEBIMENTO_REGISTRADO, {
        recebimentoId,
        dataOperacao: resultado.dataOperacao,
        etapa: 'conclusao' as const,
      });
      if (resultado.pedidosEmRisco.length > 0) {
        this.eventEmitter.emit(EVENTOS.PEDIDO_EM_RISCO, {
          dataOperacao: resultado.dataOperacao,
          origem: 'conclusao' as const,
          pedidos: resultado.pedidosEmRisco,
        });
      }
    }

    return { recebimento: resultado.recebimento, jaConcluido: resultado.jaConcluido };
  }

  /** Quantidade com divergência de um item = |esperada − recebida| (0 se conforme). */
  private calcularDivergente(esperada: string, recebida: string): string {
    const diff = subtrairQtd(esperada, recebida);
    return compararQtd(diff, '0') < 0 ? subtrairQtd('0', diff) : diff;
  }

  private async buscarAtivo(tx: Tx, id: string): Promise<Recebimento | null> {
    return tx
      .select()
      .from(recebimentos)
      .where(and(eq(recebimentos.id, id), isNull(recebimentos.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
