import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import { MENUS_CANONICOS } from '../../common/rbac/menus-canonicos';
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

  /**
   * União dos menus visíveis dos perfis do usuário, em ordem canônica do catálogo.
   * Lido do banco a cada requisição (decisão 11): alterar menus vale na próxima navegação.
   */
  async menusVisiveisDePerfis(perfis: string[]): Promise<string[]> {
    if (perfis.length === 0) return [];

    const rows = await this.db
      .select({ menus: schema.perfis.menusVisiveis })
      .from(schema.perfis)
      .where(inArray(schema.perfis.slug, perfis));

    const uniao = new Set(rows.flatMap((r) => r.menus));
    return MENUS_CANONICOS.filter((href) => uniao.has(href));
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
    // 1. Insere todas as permissões em lote (idempotente).
    const permissoesValues = Object.entries(DESCRICOES_PERMISSOES).map(([codigo, descricao]) => ({
      codigo,
      descricao,
    }));
    if (permissoesValues.length > 0) {
      await this.db.insert(schema.permissoes).values(permissoesValues).onConflictDoNothing();
    }

    // 2. Carrega perfis e permissões existentes em dois SELECTs (mapas por slug/código).
    const [perfisDb, permissoesDb] = await Promise.all([
      this.db.select({ id: schema.perfis.id, slug: schema.perfis.slug }).from(schema.perfis),
      this.db.select({ id: schema.permissoes.id, codigo: schema.permissoes.codigo }).from(schema.permissoes),
    ]);
    const perfilIdPorSlug = new Map(perfisDb.map((p) => [p.slug, p.id]));
    const permIdPorCodigo = new Map(permissoesDb.map((p) => [p.codigo, p.id]));

    // 3. Monta todos os vínculos perfil→permissão e insere em um único lote.
    const vinculos: { perfilId: string; permissaoId: string }[] = [];
    for (const [slug, codigos] of Object.entries(MAPA_PERFIL_PERMISSOES)) {
      const perfilId = perfilIdPorSlug.get(slug);
      if (!perfilId) continue;
      for (const codigo of codigos) {
        const permissaoId = permIdPorCodigo.get(codigo);
        if (!permissaoId) continue;
        vinculos.push({ perfilId, permissaoId });
      }
    }
    if (vinculos.length > 0) {
      await this.db.insert(schema.perfisPermissoes).values(vinculos).onConflictDoNothing();
    }
  }

  /** Alias mantido por compatibilidade com chamadas existentes (test-app da F1). */
  async ensurePermissoesF1(): Promise<void> {
    await this.ensurePermissoes();
  }

  /** Lista todos os perfis com permissões e menus visíveis (PERFIS_GERENCIAR). */
  async listarPerfisComPermissoes(): Promise<
    Array<{ id: string; slug: string; nome: string; permissoes: string[]; menusVisiveis: string[] }>
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
      menusVisiveis: p.menusVisiveis,
    }));
  }

  /** Substitui a lista de menus visíveis do perfil. Devolve anterior e novo para auditoria. */
  async definirMenusDoPerfil(
    slug: string,
    menus: string[],
  ): Promise<{ anterior: string[]; novo: string[] } | null> {
    return this.db.transaction(async (tx) => {
      const perfil = await tx
        .select()
        .from(schema.perfis)
        .where(eq(schema.perfis.slug, slug))
        .then((r) => r[0] ?? null);
      if (!perfil) return null;

      const novo = [...new Set(menus)];
      await tx.update(schema.perfis).set({ menusVisiveis: novo }).where(eq(schema.perfis.id, perfil.id));

      return { anterior: perfil.menusVisiveis, novo };
    });
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
