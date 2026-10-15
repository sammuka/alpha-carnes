import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { montarPaginado } from '../../../../common/crud/paginacao';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { classificacoesIbsCbs } from '../../../../database/schema';
import { EVENTOS } from '../../../../realtime/events/eventos';
import { conflito, ehViolacaoUnica } from '../empresas/fiscal-comum';
import type { ClassificacaoIbsCbsDto } from './dto/classificacao-ibs-cbs.dto';
import type { ListarCatalogoQuery } from './dto/comum.dto';

type Db = NodePgDatabase<typeof schema>;

const MODULO = 'fiscal.regras';

@Injectable()
export class ClassificacoesIbsCbsService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async listar(query: ListarCatalogoQuery) {
    const filtro = query.search?.trim();
    const termo = filtro ? `%${filtro.replace(/[%_]/g, '')}%` : undefined;
    const where = and(
      isNull(classificacoesIbsCbs.deletedAt),
      termo
        ? sql`(${classificacoesIbsCbs.codigo} ILIKE ${termo} OR ${classificacoesIbsCbs.descricao} ILIKE ${termo})`
        : undefined,
    );
    const totalLinha = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(classificacoesIbsCbs)
      .where(where);
    const data = await this.db
      .select({
        id: classificacoesIbsCbs.id,
        codigo: classificacoesIbsCbs.codigo,
        descricao: classificacoesIbsCbs.descricao,
      })
      .from(classificacoesIbsCbs)
      .where(where)
      .orderBy(classificacoesIbsCbs.codigo)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return montarPaginado(data, totalLinha[0]?.total ?? 0, query);
  }

  async criar(dto: ClassificacaoIbsCbsDto, usuarioId: string) {
    try {
      const linha = await this.db.transaction(async (tx) => {
        const [gravada] = await tx.insert(classificacoesIbsCbs).values({
          codigo: dto.codigo,
          descricao: dto.descricao,
          criadoPorId: usuarioId,
          atualizadoPorId: usuarioId,
        }).returning();
        if (!gravada) throw new Error('Falha ao gravar classificação IBS/CBS');
        await this.auditoria.registrar(tx, {
          tabela: 'classificacoes_ibs_cbs',
          registroId: gravada.id,
          operacao: 'INSERT',
          modulo: MODULO,
          usuarioId,
          dadosNovos: gravada,
          justificativa: dto.justificativa,
        });
        return gravada;
      });
      this.eventos.emit(EVENTOS.REGRA_TRIBUTARIA_ALTERADA, {
        regraId: linha.id,
        enquadramentoId: linha.id,
        codigo: linha.codigo,
        numeroVersao: linha.versao,
        acao: 'classificacao_criada',
        situacao: 'ATIVA',
      });
      return { id: linha.id, codigo: linha.codigo, descricao: linha.descricao, versao: linha.versao };
    } catch (err) {
      if (ehViolacaoUnica(err, 'uq_classificacoes_codigo')) {
        conflito('CODIGO_JA_CADASTRADO', 'Código já cadastrado.');
      }
      throw err;
    }
  }
}
