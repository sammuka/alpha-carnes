import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { auditoria, usuarios } from '../../database/schema';
import {
  calcularRange,
  montarPaginado,
  type Paginado,
} from '../../common/crud/paginacao';
import type { ListarAuditoriaQuery } from './dto/auditoria.dto';

export interface RegistroAuditoriaListagem {
  id: string;
  tabela: string;
  registroId: string;
  operacao: string;
  modulo: string | null;
  usuarioId: string | null;
  usuarioNome: string | null;
  dadosAnteriores: Record<string, unknown>;
  dadosNovos: Record<string, unknown>;
  justificativa: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

@Injectable()
export class AuditoriaConsultaService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarAuditoriaQuery): Promise<Paginado<RegistroAuditoriaListagem>> {
    const { limit, offset } = calcularRange(query);
    const filtros: SQL[] = [];

    if (query.modulo) filtros.push(eq(auditoria.modulo, query.modulo));
    if (query.operacao) filtros.push(eq(auditoria.operacao, query.operacao));
    if (query.usuarioId) filtros.push(eq(auditoria.usuarioId, query.usuarioId));
    if (query.registroId) filtros.push(eq(auditoria.registroId, query.registroId));
    if (query.tabela) filtros.push(eq(auditoria.tabela, query.tabela));
    if (query.dataInicio) filtros.push(gte(auditoria.createdAt, new Date(query.dataInicio)));
    if (query.dataFim) filtros.push(lte(auditoria.createdAt, new Date(query.dataFim)));

    const where = filtros.length > 0 ? and(...filtros) : undefined;

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select({
          id: auditoria.id,
          tabela: auditoria.tabela,
          registroId: auditoria.registroId,
          operacao: auditoria.operacao,
          modulo: auditoria.modulo,
          usuarioId: auditoria.usuarioId,
          usuarioNome: usuarios.nome,
          dadosAnteriores: auditoria.dadosAnteriores,
          dadosNovos: auditoria.dadosNovos,
          justificativa: auditoria.justificativa,
          ip: auditoria.ip,
          userAgent: auditoria.userAgent,
          createdAt: auditoria.createdAt,
        })
        .from(auditoria)
        .leftJoin(usuarios, eq(auditoria.usuarioId, usuarios.id))
        .where(where)
        .orderBy(desc(auditoria.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(auditoria)
        .where(where),
    ]);

    const data: RegistroAuditoriaListagem[] = linhas.map((r) => ({
      ...r,
      dadosAnteriores: r.dadosAnteriores as Record<string, unknown>,
      dadosNovos: r.dadosNovos as Record<string, unknown>,
    }));

    return montarPaginado(data, totalRow[0]?.total ?? 0, query);
  }
}
