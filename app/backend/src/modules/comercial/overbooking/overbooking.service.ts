import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { montarPaginado, type Paginado } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  pendenciasOverbooking,
  pendenciasOverbookingHistorico,
  operacoes,
} from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import type { Tx } from '../../operacoes/operacoes.service';
import {
  TRANSICOES_PENDENCIA,
  type AlterarPendenciaDto,
  type ListarPendenciasDto,
  type StatusPendencia,
} from './dto/overbooking.dto';

type Pendencia = typeof pendenciasOverbooking.$inferSelect;

@Injectable()
export class OverbookingService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
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

  // usado pelo controller de decisão (alias tipado)
  async decidir(
    id: string,
    dto: AlterarPendenciaDto,
    usuarioId: string,
  ) {
    return this.alterarStatus(id, dto.status, dto.detalhe, usuarioId);
  }

  private async obterAtivaSobLock(tx: Tx, id: string): Promise<Pendencia> {
    const [atual] = await tx.select().from(pendenciasOverbooking)
      .where(and(eq(pendenciasOverbooking.id, id), isNull(pendenciasOverbooking.deletedAt)))
      .for('update')
      .limit(1);
    if (!atual) throw new NotFoundException('Pendência não encontrada');
    return atual;
  }

  /** Data da Operação — obrigatória nos payloads: é a room do broadcast (roomsDaData). */
  private async dataDaOperacao(tx: Tx, operacaoId: string): Promise<string> {
    const [linha] = await tx.select({ data: operacoes.data }).from(operacoes)
      .where(eq(operacoes.id, operacaoId));
    if (!linha) throw new NotFoundException('Operação da pendência não encontrada');
    return linha.data;
  }
}
