import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { montarPaginado } from '../../../../common/crud/paginacao';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { ncms } from '../../../../database/schema';
import { EVENTOS } from '../../../../realtime/events/eventos';
import type { CreateNcmDto, ListarNcmQuery } from './dto/ncm.dto';
import { conflito, ehViolacaoUnica } from '../empresas/fiscal-comum';

type Db = NodePgDatabase<typeof schema>;

const MODULO = 'fiscal.enquadramentos';

@Injectable()
export class NcmsService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async listar(query: ListarNcmQuery) {
    const filtro = query.search?.trim();
    const termo = filtro ? `%${filtro.replace(/[%_]/g, '')}%` : undefined;
    const where = and(
      isNull(ncms.deletedAt),
      termo ? sql`(${ncms.codigo} ILIKE ${termo} OR ${ncms.descricao} ILIKE ${termo})` : undefined,
    );
    const totalLinha = await this.db.select({ total: sql<number>`count(*)::int` }).from(ncms).where(where);
    const data = await this.db
      .select({ id: ncms.id, codigo: ncms.codigo, descricao: ncms.descricao })
      .from(ncms)
      .where(where)
      .orderBy(ncms.codigo)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return montarPaginado(data, totalLinha[0]?.total ?? 0, query);
  }

  async criar(dto: CreateNcmDto, usuarioId: string) {
    try {
      const criada = await this.db.transaction(async (tx) => {
        const [linha] = await tx.insert(ncms).values({
          codigo: dto.codigo,
          descricao: dto.descricao,
          criadoPorId: usuarioId,
          atualizadoPorId: usuarioId,
        }).returning();
        if (!linha) throw new Error('Falha ao gravar NCM');
        await this.auditoria.registrar(tx, {
          tabela: 'ncms',
          registroId: linha.id,
          operacao: 'INSERT',
          modulo: MODULO,
          usuarioId,
          dadosNovos: linha,
          justificativa: dto.justificativa,
        });
        return linha;
      });
      this.eventos.emit(EVENTOS.ENQUADRAMENTO_FISCAL_ALTERADO, {
        enquadramentoId: criada.id,
        acao: 'ncm_criado',
      });
      return { id: criada.id, codigo: criada.codigo, descricao: criada.descricao, versao: criada.versao };
    } catch (err) {
      if (ehViolacaoUnica(err, 'uq_ncms_codigo')) {
        conflito('NCM_DUPLICADO', 'Já existe NCM com este código.');
      }
      throw err;
    }
  }
}
