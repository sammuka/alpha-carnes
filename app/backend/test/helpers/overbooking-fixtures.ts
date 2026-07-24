import type { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/schema';

type DbBundle = {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
};

/** Snapshot dos seis agregados que o challenge não pode mutar. */
export async function snapshotOverbooking(
  drizzle: DbBundle,
  opts: { disponibilidadeId: string; dataOperacao?: string },
) {
  const { db } = drizzle;
  const result = await db.execute<{
    operacoes: string;
    pedidos: string;
    itens: string;
    reservas: string;
    pendencias: string;
    disponivel: string;
    reservada: string;
  }>(sql`
    SELECT
      (SELECT count(*)::text FROM operacoes WHERE deleted_at IS NULL) AS operacoes,
      (SELECT count(*)::text FROM pedidos_venda WHERE deleted_at IS NULL) AS pedidos,
      (SELECT count(*)::text FROM pedidos_venda_itens WHERE deleted_at IS NULL) AS itens,
      (SELECT count(*)::text FROM reservas_disponibilidade) AS reservas,
      (SELECT count(*)::text FROM pendencias_overbooking WHERE deleted_at IS NULL) AS pendencias,
      (SELECT quantidade_disponivel::text FROM disponibilidades_virtuais WHERE id = ${opts.disponibilidadeId}::uuid) AS disponivel,
      (SELECT quantidade_reservada::text FROM disponibilidades_virtuais WHERE id = ${opts.disponibilidadeId}::uuid) AS reservada
  `);
  const agg = result.rows[0];

  return {
    operacoes: agg?.operacoes ?? '0',
    pedidos: agg?.pedidos ?? '0',
    itens: agg?.itens ?? '0',
    reservas: agg?.reservas ?? '0',
    pendencias: agg?.pendencias ?? '0',
    disponivel: agg?.disponivel ?? null,
    reservada: agg?.reservada ?? null,
    dataOperacao: opts.dataOperacao ?? null,
  };
}

/** Intercepta SQL no pool e reporta textos; retorna cleanup. */
export function observarSql(
  drizzle: DbBundle,
  onSql: (texto: string) => void,
): () => void {
  const pool = drizzle.pool;
  const original = pool.query.bind(pool) as (...a: unknown[]) => unknown;
  const patched = (config: unknown, values?: unknown, callback?: unknown) => {
    const texto = typeof config === 'string'
      ? config
      : (config && typeof config === 'object' && 'text' in (config as object)
        ? String((config as { text: string }).text)
        : null);
    if (typeof texto === 'string') onSql(texto);
    return original(config, values, callback);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pool as any).query = patched;
  return () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pool as any).query = original;
  };
}

/** AllExceptionsFilter aninha getResponse() em message — normaliza o challenge. */
export function challengePayload(body: {
  code?: string;
  itens?: unknown;
  message?: unknown;
}): {
  code?: string;
  message?: string;
  itens?: Array<Record<string, unknown>>;
} {
  if (body && typeof body.message === 'object' && body.message !== null) {
    return body.message as {
      code?: string;
      message?: string;
      itens?: Array<Record<string, unknown>>;
    };
  }
  return body as {
    code?: string;
    message?: string;
    itens?: Array<Record<string, unknown>>;
  };
}
