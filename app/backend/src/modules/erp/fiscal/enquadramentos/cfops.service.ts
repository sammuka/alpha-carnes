import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { montarPaginado } from '../../../../common/crud/paginacao';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { cfops } from '../../../../database/schema';
import { EVENTOS } from '../../../../realtime/events/eventos';
import type { CreateCfopDto, ListarCodigoFiscalQuery } from './dto/cfop.dto';
import { conflito, ehViolacaoUnica } from '../empresas/fiscal-comum';

type Db = NodePgDatabase<typeof schema>;

const MODULO = 'fiscal.enquadramentos';

@Injectable()
export class CfopsService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async listar(query: ListarCodigoFiscalQuery) {
    const filtro = query.search?.trim();
    const termo = filtro ? `%${filtro.replace(/[%_]/g, '')}%` : undefined;
    // O código é guardado sem máscara: "04.01" ou "5.102" busca por "0401" e "5102".
    const termoCodigo = filtro ? `%${filtro.replace(/[%_. -]/g, '') || filtro.replace(/[%_]/g, '')}%` : undefined;
    const where = and(
      isNull(cfops.deletedAt),
      termo ? sql`(${cfops.codigo} ILIKE ${termoCodigo} OR ${cfops.descricao} ILIKE ${termo})` : undefined,
    );
    const totalLinha = await this.db.select({ total: sql<number>`count(*)::int` }).from(cfops).where(where);
    const data = await this.db
      .select({ id: cfops.id, codigo: cfops.codigo, descricao: cfops.descricao })
      .from(cfops)
      .where(where)
      .orderBy(cfops.codigo)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return montarPaginado(data, totalLinha[0]?.total ?? 0, query);
  }

  async criar(dto: CreateCfopDto, usuarioId: string) {
    try {
      const criada = await this.db.transaction(async (tx) => {
        const [linha] = await tx.insert(cfops).values({
          codigo: dto.codigo,
          descricao: dto.descricao,
          criadoPorId: usuarioId,
          atualizadoPorId: usuarioId,
        }).returning();
        if (!linha) throw new Error('Falha ao gravar CFOP');
        await this.auditoria.registrar(tx, {
          tabela: 'cfops',
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
        acao: 'cfop_criado',
      });
      return { id: criada.id, codigo: criada.codigo, descricao: criada.descricao, versao: criada.versao };
    } catch (err) {
      if (ehViolacaoUnica(err, 'uq_cfops_codigo')) {
        conflito('CFOP_DUPLICADO', 'Já existe CFOP com este código.');
      }
      throw err;
    }
  }
}
