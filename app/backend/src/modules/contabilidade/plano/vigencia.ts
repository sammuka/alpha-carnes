import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../../database/schema';
import { contaVersoes } from '../../../database/schema';

type Executor = Pick<NodePgDatabase<typeof schema>, 'select'>;

/**
 * Última versão com decisão (APPROVED ou SUSPENDED) de uma conta, não excluída.
 * Regra de vigência: a conta só está vigente se esta versão for APPROVED.
 * DRAFT, REVIEW e REJECTED não decidem nada: revisão em aberto não derruba a versão aprovada.
 */
export async function ultimaVersaoDecidida(executor: Executor, contaId: string) {
  const [versao] = await executor.select().from(contaVersoes).where(and(
    eq(contaVersoes.contaId, contaId),
    inArray(contaVersoes.situacao, ['APPROVED', 'SUSPENDED']),
    isNull(contaVersoes.deletedAt),
  )).orderBy(desc(contaVersoes.numero)).limit(1);
  return versao ?? null;
}
