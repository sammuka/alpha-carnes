import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../../database/schema';
import { estabelecimentos } from '../../../../database/schema';

/** Executor Drizzle: `db` global ou transação (mesmo padrão de `clientes.service.ts`). */
export type Tx = NodePgDatabase<typeof schema>;

export type Estabelecimento = typeof estabelecimentos.$inferSelect;

/** Módulo gravado em `auditoria.modulo` (§11). */
export const MODULO_AUDITORIA = 'fiscal.empresas';

/** "Hoje" fiscal (D10): data civil em America/Sao_Paulo. */
export const HOJE_FISCAL = sql`(now() AT TIME ZONE 'America/Sao_Paulo')::date`;

/** Erro de regra de domínio (D13): 422 com `{ message, codigo, ...dados }`. */
export function regraViolada(codigo: string, message: string, dados: Record<string, unknown> = {}): never {
  throw new UnprocessableEntityException({ message, ...dados, codigo });
}

/** Erro de estado/unicidade/versão/sobreposição (D13): 409 com `{ message, codigo, ...dados }`. */
export function conflito(codigo: string, message: string, dados: Record<string, unknown> = {}): never {
  throw new ConflictException({ message, ...dados, codigo });
}

export function conflitoConcorrente(): never {
  return conflito(
    'CONFLITO_CONCORRENTE',
    'O registro foi alterado por outro usuário. Recarregue para continuar.',
  );
}

export function transicaoInvalida(situacao: string): never {
  return conflito('TRANSICAO_INVALIDA', 'Ação não permitida na situação atual.', { situacao });
}

/** Código SQLSTATE do erro do pg, direto ou embrulhado pelo Drizzle (`cause`). */
export function codigoPg(err: unknown): string | undefined {
  return (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;
}

/** Nome da constraint violada, direto ou embrulhado pelo Drizzle (`cause`). */
export function constraintPg(err: unknown): string | undefined {
  return (
    (err as { constraint?: string }).constraint
    ?? (err as { cause?: { constraint?: string } }).cause?.constraint
  );
}

/** `true` se `err` é violação de unicidade (`23505`), opcionalmente da constraint informada. */
export function ehViolacaoUnica(err: unknown, constraint?: string): boolean {
  if (codigoPg(err) !== '23505') return false;
  return constraint === undefined || constraintPg(err) === constraint;
}

/**
 * Primeira trava de toda operação sobre estabelecimento, CNAE, alteração ou regime (D14, §6):
 * `SELECT … FROM estabelecimentos WHERE id = $1 AND deleted_at IS NULL FOR NO KEY UPDATE`.
 * `empresa_id` das filhas vem desta linha, nunca do cliente.
 */
export async function travarEstabelecimento(tx: Tx, id: string): Promise<Estabelecimento> {
  const [linha] = await tx
    .select()
    .from(estabelecimentos)
    .where(and(eq(estabelecimentos.id, id), isNull(estabelecimentos.deletedAt)))
    .for('no key update');
  if (!linha) throw new NotFoundException('Estabelecimento não encontrado');
  return linha;
}

/** Segregação de função (D7): quem decide ≠ quem submeteu. */
export function exigirSegregacao(submetidoPorId: string | null, usuarioId: string): void {
  if (submetidoPorId === usuarioId) {
    regraViolada(
      'SEGREGACAO_FUNCAO',
      'A aprovação deve ser feita por usuário diferente de quem submeteu.',
    );
  }
}

/** Concorrência otimista (D14). */
export function exigirVersao(atual: number, informada: number): void {
  if (atual !== informada) conflitoConcorrente();
}
