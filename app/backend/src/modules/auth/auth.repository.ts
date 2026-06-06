import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';

export type UsuarioComPerfis = typeof schema.usuarios.$inferSelect & {
  perfis: string[];
  permissoes: string[];
};

@Injectable()
export class AuthRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async findUsuarioByEmail(email: string) {
    const rows = await this.db
      .select()
      .from(schema.usuarios)
      .where(and(eq(schema.usuarios.email, email), isNull(schema.usuarios.deletedAt)));
    return rows[0] ?? null;
  }

  async findUsuarioComPerfisPermissoes(usuarioId: string): Promise<UsuarioComPerfis | null> {
    const usuario = await this.db
      .select()
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, usuarioId))
      .then((r) => r[0] ?? null);

    if (!usuario) return null;

    const perfisRows = await this.db
      .select({ slug: schema.perfis.slug })
      .from(schema.usuariosPerfis)
      .innerJoin(schema.perfis, eq(schema.usuariosPerfis.perfilId, schema.perfis.id))
      .where(eq(schema.usuariosPerfis.usuarioId, usuarioId));

    const perfisslugs = perfisRows.map((r) => r.slug);

    const permissoesRows = await this.db
      .select({ codigo: schema.permissoes.codigo })
      .from(schema.usuariosPerfis)
      .innerJoin(schema.perfisPermissoes, eq(schema.usuariosPerfis.perfilId, schema.perfisPermissoes.perfilId))
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id))
      .where(eq(schema.usuariosPerfis.usuarioId, usuarioId));

    const permissoes = [...new Set(permissoesRows.map((r) => r.codigo))];

    return { ...usuario, perfis: perfisslugs, permissoes };
  }

  async saveRefreshToken(data: {
    usuarioId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  }) {
    const [token] = await this.db
      .insert(schema.refreshTokens)
      .values(data)
      .returning();
    return token;
  }

  async findRefreshToken(tokenHash: string) {
    const rows = await this.db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.tokenHash, tokenHash));
    return rows[0] ?? null;
  }

  async revokeRefreshToken(tokenHash: string, replacedById?: string) {
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date(), replacedById: replacedById ?? null })
      .where(eq(schema.refreshTokens.tokenHash, tokenHash));
  }

  async updateUltimoAcesso(usuarioId: string) {
    await this.db
      .update(schema.usuarios)
      .set({ ultimoAcesso: new Date() })
      .where(eq(schema.usuarios.id, usuarioId));
  }
}
