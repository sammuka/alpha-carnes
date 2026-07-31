import { sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { usuariosRepresentantes } from '../../database/schema';

/**
 * Autorização correlacionada por representante.
 *
 * Sem linha em usuarios_representantes: Todos.
 * Com ao menos uma linha: somente igualdade com um ID vinculado.
 * representanteId NULL: autorizado apenas no caso Todos; no caso restrito,
 * `IS NOT NULL` é falso e o recurso permanece oculto.
 */
export function escopoRepresentantes(
  usuarioId: string,
  representanteId: AnyPgColumn,
): SQL<boolean> {
  return sql<boolean>`(
    NOT EXISTS (
      SELECT 1
      FROM ${usuariosRepresentantes} AS ur_any
      WHERE ur_any.usuario_id = ${usuarioId}
    )
    OR (
      ${representanteId} IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM ${usuariosRepresentantes} AS ur_allowed
        WHERE ur_allowed.usuario_id = ${usuarioId}
          AND ur_allowed.representante_id = ${representanteId}
      )
    )
  )`;
}
