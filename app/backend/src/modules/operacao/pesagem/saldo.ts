import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { pedidosVendaItens } from '../../../database/schema';

type Tx = NodePgDatabase<typeof schema>;

/** Incrementa atendida só enquanto < pedida (anti-overbooking). false = item completo. */
export async function consumirSaldo(tx: Tx, pedidoVendaItemId: string): Promise<boolean> {
  const r = await tx
    .update(pedidosVendaItens)
    .set({ quantidadeAtendida: sql`${pedidosVendaItens.quantidadeAtendida} + 1` })
    .where(
      and(
        eq(pedidosVendaItens.id, pedidoVendaItemId),
        sql`${pedidosVendaItens.quantidadeAtendida} < ${pedidosVendaItens.quantidadePedida}`,
      ),
    )
    .returning({ id: pedidosVendaItens.id });
  return r.length > 0;
}

/** Devolve 1 unidade ao item (CHECK >= 0 é backstop). */
export async function devolverSaldo(tx: Tx, pedidoVendaItemId: string): Promise<void> {
  await tx
    .update(pedidosVendaItens)
    .set({ quantidadeAtendida: sql`${pedidosVendaItens.quantidadeAtendida} - 1` })
    .where(eq(pedidosVendaItens.id, pedidoVendaItemId));
}
