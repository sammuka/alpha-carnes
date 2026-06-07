import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import { auditoria } from '../../database/schema/auditoria.schema';
import * as schema from '../../database/schema';

export type OperacaoAuditoria = 'INSERT' | 'UPDATE' | 'DELETE' | 'ACAO_MANUAL';

/** Executor de banco: o `db` global ou uma transação Drizzle. */
export type DbOuTx = Pick<NodePgDatabase<typeof schema>, 'insert'>;

export interface RegistroAuditoria {
  tabela: string;
  registroId: string;
  operacao: OperacaoAuditoria;
  modulo: string;
  usuarioId?: string | null;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
  justificativa?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Registra auditoria de mutações de negócio (RA-02: transacional + auditada).
 *
 * O método `registrar` recebe o executor de banco (`tx`) e insere a linha de
 * auditoria DENTRO da mesma transação da mutação — se a mutação falhar, a
 * auditoria sofre rollback junto (atomicidade). Captura estado anterior e novo.
 */
@Injectable()
export class AuditoriaService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  /** Insere um registro de auditoria usando o executor fornecido (transação ou db global). */
  async registrar(tx: DbOuTx, registro: RegistroAuditoria): Promise<void> {
    await tx.insert(auditoria).values({
      tabela: registro.tabela,
      registroId: registro.registroId,
      operacao: registro.operacao,
      modulo: registro.modulo,
      usuarioId: registro.usuarioId ?? undefined,
      dadosAnteriores: this.normalizar(registro.dadosAnteriores),
      dadosNovos: this.normalizar(registro.dadosNovos),
      justificativa: registro.justificativa ?? undefined,
      ip: registro.ip ?? undefined,
      userAgent: registro.userAgent ?? undefined,
    });
  }

  /** Garante um objeto JSONB serializável (datas viram ISO; null/undefined viram {}). */
  private normalizar(valor: unknown): Record<string, unknown> {
    if (valor === null || valor === undefined) return {};
    return JSON.parse(JSON.stringify(valor)) as Record<string, unknown>;
  }
}
