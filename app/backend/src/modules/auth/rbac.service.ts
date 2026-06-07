import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import { DESCRICOES_PERMISSOES, MAPA_PERFIL_PERMISSOES } from '../../common/rbac/permissoes';
import * as schema from '../../database/schema';

@Injectable()
export class RbacService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /**
   * Resolve as permissões efetivas a partir do BANCO (ADR-008 §1).
   * Faz join perfis → perfis_permissoes → permissoes pelos slugs dos perfis do usuário.
   * O MAPA_PERFIL_PERMISSOES não participa mais da decisão de autorização em runtime.
   */
  async resolverPermissoes(perfis: string[]): Promise<string[]> {
    if (perfis.length === 0) return [];

    const rows = await this.db
      .select({ codigo: schema.permissoes.codigo })
      .from(schema.perfis)
      .innerJoin(schema.perfisPermissoes, eq(schema.perfis.id, schema.perfisPermissoes.perfilId))
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id))
      .where(inArray(schema.perfis.slug, perfis));

    return [...new Set(rows.map((r) => r.codigo))];
  }

  temPermissao(permissoes: string[], codigo: string): boolean {
    return permissoes.includes(codigo);
  }

  assertCriadorNaoAprovador(criadorId: string, aprovadorId: string): void {
    if (criadorId === aprovadorId) {
      throw Object.assign(
        new Error('Conflito de segregação de funções: criador não pode ser o aprovador'),
        { statusCode: 409 },
      );
    }
  }

  /**
   * Bootstrap idempotente do catálogo de permissões e do mapa perfil→permissão
   * em `perfis_permissoes` (ADR-008 §2). Insere todas as permissões conhecidas e
   * vincula cada perfil ao seu conjunto. Não remove vínculos existentes.
   */
  async ensurePermissoes(): Promise<void> {
    for (const [codigo, descricao] of Object.entries(DESCRICOES_PERMISSOES)) {
      await this.db.insert(schema.permissoes).values({ codigo, descricao }).onConflictDoNothing();
    }

    for (const [slug, codigos] of Object.entries(MAPA_PERFIL_PERMISSOES)) {
      if (codigos.length === 0) continue;
      const perfil = await this.db
        .select()
        .from(schema.perfis)
        .where(eq(schema.perfis.slug, slug))
        .then((r) => r[0] ?? null);
      if (!perfil) continue;

      for (const codigo of codigos) {
        const perm = await this.db
          .select()
          .from(schema.permissoes)
          .where(eq(schema.permissoes.codigo, codigo))
          .then((r) => r[0] ?? null);
        if (!perm) continue;
        await this.db
          .insert(schema.perfisPermissoes)
          .values({ perfilId: perfil.id, permissaoId: perm.id })
          .onConflictDoNothing();
      }
    }
  }

  /** Alias mantido por compatibilidade com chamadas existentes (test-app da F1). */
  async ensurePermissoesF1(): Promise<void> {
    await this.ensurePermissoes();
  }

  /** Lista todos os perfis com suas permissões (gestão em runtime — PERFIS_GERENCIAR). */
  async listarPerfisComPermissoes(): Promise<
    Array<{ id: string; slug: string; nome: string; permissoes: string[] }>
  > {
    const perfis = await this.db.select().from(schema.perfis).orderBy(schema.perfis.slug);
    const vinculos = await this.db
      .select({ perfilId: schema.perfisPermissoes.perfilId, codigo: schema.permissoes.codigo })
      .from(schema.perfisPermissoes)
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id));

    return perfis.map((p) => ({
      id: p.id,
      slug: p.slug,
      nome: p.nome,
      permissoes: vinculos.filter((v) => v.perfilId === p.id).map((v) => v.codigo),
    }));
  }

  /**
   * Substitui o conjunto de permissões de um perfil pelo informado (ADR-008 §3).
   * Operação transacional: remove vínculos atuais e insere os novos. Retorna o
   * estado anterior e o novo para auditoria. Códigos inválidos são ignorados.
   */
  async definirPermissoesDoPerfil(
    slug: string,
    codigos: string[],
  ): Promise<{ anterior: string[]; novo: string[] } | null> {
    return this.db.transaction(async (tx) => {
      const perfil = await tx
        .select()
        .from(schema.perfis)
        .where(eq(schema.perfis.slug, slug))
        .then((r) => r[0] ?? null);
      if (!perfil) return null;

      const anteriorRows = await tx
        .select({ codigo: schema.permissoes.codigo })
        .from(schema.perfisPermissoes)
        .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id))
        .where(eq(schema.perfisPermissoes.perfilId, perfil.id));
      const anterior = anteriorRows.map((r) => r.codigo);

      const perms = codigos.length
        ? await tx.select().from(schema.permissoes).where(inArray(schema.permissoes.codigo, codigos))
        : [];

      await tx.delete(schema.perfisPermissoes).where(eq(schema.perfisPermissoes.perfilId, perfil.id));
      for (const perm of perms) {
        await tx
          .insert(schema.perfisPermissoes)
          .values({ perfilId: perfil.id, permissaoId: perm.id })
          .onConflictDoNothing();
      }

      return { anterior, novo: perms.map((p) => p.codigo) };
    });
  }
}
