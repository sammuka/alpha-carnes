import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { ocorrenciasFornecedor, ocorrenciasFornecedorHistorico } from '../../../../database/schema';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import {
  calcularRange,
  montarPaginado,
  primeiroOuFalha,
  type ListarQuery,
  type Paginado,
} from '../../../../common/crud/paginacao';
import { EVENTOS } from '../../../../realtime/events/eventos';
import type { AbrirOcorrenciaDto, AtualizarOcorrenciaDto, EncerrarOcorrenciaDto } from './dto/ocorrencia-fornecedor.dto';

type Tx = NodePgDatabase<typeof schema>;
type Ocorrencia = typeof ocorrenciasFornecedor.$inferSelect;

@Injectable()
export class OcorrenciaFornecedorService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<Ocorrencia>> {
    const { limit, offset } = calcularRange(query);
    const [linhas, totalRow] = await Promise.all([
      this.db
        .select()
        .from(ocorrenciasFornecedor)
        .orderBy(desc(ocorrenciasFornecedor.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(ocorrenciasFornecedor),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string) {
    const ocorrencia = await this.db.query.ocorrenciasFornecedor.findFirst({
      where: eq(ocorrenciasFornecedor.id, id),
      with: { historico: true, fornecedor: true, divergencia: true },
    });
    if (!ocorrencia) throw new NotFoundException('Ocorrência não encontrada');
    return ocorrencia;
  }

  /**
   * Abre a ocorrência dentro de uma transação fornecida (reuso pela divergência
   * ao mover para aguardando_fornecedor). Registra a primeira entrada da timeline.
   */
  async abrirNaTx(
    tx: Tx,
    dto: AbrirOcorrenciaDto & { conclusaoConferenciaId?: string },
    usuarioId: string,
  ): Promise<Ocorrencia> {
    const criada = primeiroOuFalha(
      await tx
        .insert(ocorrenciasFornecedor)
        .values({
          fornecedorId: dto.fornecedorId,
          compraProgramadaId: dto.compraProgramadaId,
          divergenciaId: dto.divergenciaId,
          conclusaoConferenciaId: dto.conclusaoConferenciaId,
          descricao: dto.descricao,
          impacto: dto.impacto,
          status: 'aberta',
          usuarioAberturaId: usuarioId,
        })
        .returning(),
    );

    await tx.insert(ocorrenciasFornecedorHistorico).values({
      ocorrenciaId: criada.id,
      usuarioId,
      acao: 'abertura',
      retornoFornecedor: dto.retornoFornecedor,
      proximoPasso: dto.proximoPasso,
      situacao: 'aberta',
    });

    await this.auditoria.registrar(tx, {
      tabela: 'ocorrencias_fornecedor',
      registroId: criada.id,
      operacao: 'INSERT',
      modulo: 'operacao',
      usuarioId,
      dadosAnteriores: {},
      dadosNovos: criada,
    });

    return criada;
  }

  async abrir(dto: AbrirOcorrenciaDto, usuarioId: string, dataOperacao?: string): Promise<Ocorrencia> {
    const ocorrencia = await this.db.transaction((tx) => this.abrirNaTx(tx, dto, usuarioId));
    this.emitirAbertura(ocorrencia, dataOperacao);
    return ocorrencia;
  }

  async atualizar(id: string, dto: AtualizarOcorrenciaDto, usuarioId: string, dataOperacao?: string): Promise<Ocorrencia> {
    const ocorrencia = await this.db.transaction(async (tx) => {
      const anterior = await this.buscar(tx, id);
      if (!anterior) throw new NotFoundException('Ocorrência não encontrada');
      if (anterior.status === 'resolvida') throw new ConflictException('Ocorrência já encerrada');

      const atualizada = primeiroOuFalha(
        await tx
          .update(ocorrenciasFornecedor)
          .set({ status: dto.status ?? anterior.status, impacto: dto.impacto ?? anterior.impacto })
          .where(eq(ocorrenciasFornecedor.id, id))
          .returning(),
      );

      await tx.insert(ocorrenciasFornecedorHistorico).values({
        ocorrenciaId: id,
        usuarioId,
        acao: dto.acao,
        retornoFornecedor: dto.retornoFornecedor,
        proximoPasso: dto.proximoPasso,
        situacao: dto.situacao ?? atualizada.status,
      });

      await this.auditoria.registrar(tx, {
        tabela: 'ocorrencias_fornecedor',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: atualizada,
      });

      return atualizada;
    });

    this.emitirAtualizacao(ocorrencia, dataOperacao);
    return ocorrencia;
  }

  async encerrar(id: string, dto: EncerrarOcorrenciaDto, usuarioId: string, dataOperacao?: string): Promise<Ocorrencia> {
    const ocorrencia = await this.db.transaction(async (tx) => {
      const anterior = await this.buscar(tx, id);
      if (!anterior) throw new NotFoundException('Ocorrência não encontrada');
      if (anterior.status === 'resolvida') throw new ConflictException('Ocorrência já encerrada');

      const encerrada = primeiroOuFalha(
        await tx
          .update(ocorrenciasFornecedor)
          .set({ status: 'resolvida', desfecho: dto.desfecho, dataHoraEncerramento: sql`now()` })
          .where(eq(ocorrenciasFornecedor.id, id))
          .returning(),
      );

      await tx.insert(ocorrenciasFornecedorHistorico).values({
        ocorrenciaId: id,
        usuarioId,
        acao: 'encerramento',
        retornoFornecedor: dto.retornoFornecedor,
        situacao: 'resolvida',
        proximoPasso: dto.desfecho,
      });

      await this.auditoria.registrar(tx, {
        tabela: 'ocorrencias_fornecedor',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: encerrada,
      });

      return encerrada;
    });

    this.emitirAtualizacao(ocorrencia, dataOperacao);
    return ocorrencia;
  }

  private async buscar(tx: Tx, id: string): Promise<Ocorrencia | null> {
    return tx
      .select()
      .from(ocorrenciasFornecedor)
      .where(eq(ocorrenciasFornecedor.id, id))
      .then((r) => r[0] ?? null);
  }

  /**
   * Emite o evento de abertura pós-commit. `dataOperacao` é resolvida pela
   * compra vinculada quando não informada (mantém o broadcast na room do dia).
   */
  emitirAbertura(ocorrencia: Ocorrencia, dataOperacao?: string): void {
    this.eventEmitter.emit(EVENTOS.OCORRENCIA_FORNECEDOR_ABERTA, {
      ocorrenciaId: ocorrencia.id,
      fornecedorId: ocorrencia.fornecedorId,
      dataOperacao: dataOperacao ?? '',
      status: ocorrencia.status,
    });
  }

  emitirAtualizacao(ocorrencia: Ocorrencia, dataOperacao?: string): void {
    this.eventEmitter.emit(EVENTOS.OCORRENCIA_FORNECEDOR_ATUALIZADA, {
      ocorrenciaId: ocorrencia.id,
      fornecedorId: ocorrencia.fornecedorId,
      dataOperacao: dataOperacao ?? '',
      status: ocorrencia.status,
    });
  }

  /** Resolve a data operacional da compra vinculada (para rooms de tempo real). */
  async resolverDataOperacao(compraProgramadaId?: string | null): Promise<string> {
    if (!compraProgramadaId) return '';
    const compra = await this.db
      .select({ dataOperacao: schema.operacoes.data })
      .from(schema.comprasProgramadas)
      .innerJoin(schema.operacoes, eq(schema.operacoes.id, schema.comprasProgramadas.operacaoId))
      .where(and(eq(schema.comprasProgramadas.id, compraProgramadaId), isNull(schema.comprasProgramadas.deletedAt)))
      .then((r) => r[0] ?? null);
    return compra?.dataOperacao ?? '';
  }
}
