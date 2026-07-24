import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import {
  montarPaginado,
  primeiroOuFalha,
  type Paginado,
} from '../../common/crud/paginacao';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { operacoes, parametros } from '../../database/schema';
import { EVENTOS } from '../../realtime/events/eventos';
import type {
  AlterarStatusOperacaoDto,
  CriarExtraordinariaDto,
  GerarCadenciaDto,
  ListarOperacoesDto,
  StatusOperacao,
} from './dto/operacao.dto';

export type Tx = NodePgDatabase<typeof schema>;
type Operacao = typeof operacoes.$inferSelect;

const DIAS_SEMANA_PT = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
] as const;

const TRANSICOES_OPERACAO: Record<StatusOperacao, readonly StatusOperacao[]> = {
  aberta: ['em_andamento'],
  em_andamento: ['fechada'],
  fechada: [],
};

function datasInclusivas(de: string, ate: string): string[] {
  const datas: string[] = [];
  for (
    let atual = new Date(`${de}T12:00:00Z`);
    atual <= new Date(`${ate}T12:00:00Z`);
    atual = new Date(atual.getTime() + 86_400_000)
  ) {
    datas.push(atual.toISOString().slice(0, 10));
  }
  return datas;
}

@Injectable()
export class OperacoesService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async garantirOperacao(tx: Tx, data: string, usuarioId?: string) {
    const atual = await tx.select({ id: operacoes.id, data: operacoes.data })
      .from(operacoes)
      .where(and(eq(operacoes.data, data), isNull(operacoes.deletedAt)))
      .then((r) => r[0]);
    if (atual) return { operacao: atual, criada: false };

    const diaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
    // Índice único parcial (deleted_at IS NULL): ON CONFLICT sem target falha no PG.
    // Em corrida, reconsulta a linha ativa após unique_violation (23505).
    try {
      const [criada] = await tx.insert(operacoes).values({
        data, diaSemana, rotulo: `Operação de ${DIAS_SEMANA_PT[diaSemana]}`,
        criadaPorId: usuarioId ?? null,
      }).returning({ id: operacoes.id, data: operacoes.data });
      if (criada) return { operacao: criada, criada: true };
    } catch (err) {
      const code = (err as { code?: string }).code
        ?? (err as { cause?: { code?: string } }).cause?.code;
      if (code !== '23505') throw err;
    }

    const concorrente = primeiroOuFalha(await tx.select({ id: operacoes.id, data: operacoes.data })
      .from(operacoes).where(and(eq(operacoes.data, data), isNull(operacoes.deletedAt))));
    return { operacao: concorrente, criada: false };
  }

  async encontrarAtivaPorData(tx: Tx, data: string) {
    return tx.select({ id: operacoes.id, data: operacoes.data })
      .from(operacoes)
      .where(and(eq(operacoes.data, data), isNull(operacoes.deletedAt)))
      .then((rows) => rows[0] ?? null);
  }

  async listar(query: ListarOperacoesDto): Promise<Paginado<Operacao>> {
    const page = query.pagina;
    const pageSize = query.limite;
    const limit = pageSize;
    const offset = (page - 1) * pageSize;
    const filtros = [isNull(operacoes.deletedAt)];
    if (query.de) filtros.push(gte(operacoes.data, query.de));
    if (query.ate) filtros.push(lte(operacoes.data, query.ate));
    if (query.status) filtros.push(eq(operacoes.status, query.status));
    const where = and(...filtros);

    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(operacoes).where(where)
        .orderBy(asc(operacoes.data)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(operacoes).where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0, { page, pageSize });
  }

  async detalhar(id: string): Promise<Operacao> {
    const linha = await this.db.select().from(operacoes)
      .where(and(eq(operacoes.id, id), isNull(operacoes.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!linha) throw new NotFoundException('Operação não encontrada');
    return linha;
  }

  async gerarCadencia(dto: GerarCadenciaDto, usuarioId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const parametro = primeiroOuFalha(await tx.select({ valor: parametros.valorJson })
        .from(parametros)
        .where(and(eq(parametros.chave, 'operacao.cadencia_dias_semana'), isNull(parametros.deletedAt))));
      const dias = z.object({ dias: z.array(z.number().int().min(0).max(6)) }).parse(parametro.valor).dias;
      const criadas: Array<{ id: string; data: string }> = [];
      for (const data of datasInclusivas(dto.de, dto.ate)) {
        if (!dias.includes(new Date(`${data}T12:00:00Z`).getUTCDay())) continue;
        const resultadoData = await this.garantirOperacao(tx, data, usuarioId);
        if (resultadoData.criada) {
          criadas.push(resultadoData.operacao);
          await this.auditoria.registrar(tx, {
            tabela: 'operacoes', registroId: resultadoData.operacao.id, operacao: 'INSERT',
            modulo: 'operacoes', usuarioId, dadosAnteriores: {}, dadosNovos: resultadoData.operacao,
          });
        }
      }
      return criadas;
    });
    for (const operacao of resultado) {
      this.eventEmitter.emit(EVENTOS.OPERACAO_CRIADA, {
        operacaoId: operacao.id,
        data: operacao.data,
      });
    }
    return { criadas: resultado.length, operacoes: resultado };
  }

  async criarExtraordinaria(dto: CriarExtraordinariaDto, usuarioId: string) {
    const operacao = await this.db.transaction(async (tx) => {
      const diaSemana = new Date(`${dto.data}T12:00:00Z`).getUTCDay();
      const [criada] = await tx.insert(operacoes).values({
        data: dto.data, diaSemana, rotulo: dto.rotulo,
        status: 'aberta', extraordinaria: true, criadaPorId: usuarioId,
      }).onConflictDoNothing().returning();
      if (!criada) throw new ConflictException('Já existe operação ativa nesta data');
      await this.auditoria.registrar(tx, {
        tabela: 'operacoes', registroId: criada.id, operacao: 'INSERT',
        modulo: 'operacoes', usuarioId, dadosAnteriores: {}, dadosNovos: criada,
      });
      return criada;
    });
    this.eventEmitter.emit(EVENTOS.OPERACAO_CRIADA, {
      operacaoId: operacao.id,
      data: operacao.data,
    });
    return operacao;
  }

  async alterarStatus(id: string, novoStatus: StatusOperacao, usuarioId: string) {
    return this.db.transaction(async (tx) => {
      const atual = await tx.select().from(operacoes)
        .where(and(eq(operacoes.id, id), isNull(operacoes.deletedAt)))
        .then((r) => r[0] ?? null);
      if (!atual) throw new NotFoundException('Operação não encontrada');
      if (!TRANSICOES_OPERACAO[atual.status as StatusOperacao].includes(novoStatus)) {
        throw new ConflictException(`Transição ${atual.status} → ${novoStatus} inválida`);
      }
      const atualizada = primeiroOuFalha(await tx.update(operacoes)
        .set({ status: novoStatus, updatedAt: new Date() })
        .where(eq(operacoes.id, id))
        .returning());
      await this.auditoria.registrar(tx, {
        tabela: 'operacoes', registroId: id, operacao: 'UPDATE',
        modulo: 'operacoes', usuarioId, dadosAnteriores: atual, dadosNovos: atualizada,
      });
      return atualizada;
    });
  }
}
