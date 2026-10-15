import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
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

/** Teto da lista de opções de conta pai; acima dele a busca (`q`) reduz o resultado. */
export const LIMITE_OPCOES_PAI = 50;

/**
 * Contas que o backend aceitaria como pai: a última versão decidida (a mesma de
 * `ultimaVersaoDecidida`) é APPROVED e sintética. Não depende de página nem de filtro da grade.
 * Uma consulta só (DISTINCT ON) em vez de uma por conta. `q` filtra por código ou nome, sem caixa;
 * `%`, `_` e `\` do texto são literais.
 */
export async function opcoesPaiVigentes(
  executor: Pick<NodePgDatabase<typeof schema>, 'execute'>,
  q: string,
  limite: number,
) {
  const padrao = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const resultado = await executor.execute(sql`
    select d.codigo, d.nome
      from (
        select distinct on (c.id) c.codigo, v.nome, v.classificacao, v.situacao
          from contas_contabeis c
          join conta_versoes v on v.conta_id = c.id
         where c.deleted_at is null
           and v.deleted_at is null
           and v.situacao in ('APPROVED', 'SUSPENDED')
         order by c.id, v.numero desc
      ) d
     where d.situacao = 'APPROVED'
       and d.classificacao = 'sintetica'
       and (${q} = '' or d.codigo ilike ${padrao} escape '\\' or d.nome ilike ${padrao} escape '\\')
     order by d.codigo
     limit ${limite}`);
  return resultado.rows as { codigo: string; nome: string }[];
}
