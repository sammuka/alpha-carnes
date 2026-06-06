import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import { MAPA_PERFIL_PERMISSOES } from '../../common/rbac/permissoes';
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

  resolverPermissoes(perfis: string[]): string[] {
    const set = new Set<string>();
    for (const p of perfis) {
      const perms = MAPA_PERFIL_PERMISSOES[p] ?? [];
      for (const perm of perms) set.add(perm);
    }
    return [...set];
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

  async ensurePermissoesF1(): Promise<void> {
    const permissoesF1 = [
      { codigo: 'USUARIOS_GERENCIAR', descricao: 'Criar e editar usuários' },
      { codigo: 'USUARIOS_APROVAR', descricao: 'Aprovar novos usuários (SF-01: não pode ser o criador)' },
      { codigo: 'PERFIS_GERENCIAR', descricao: 'Gerenciar catálogo de perfis' },
      { codigo: 'AUDITORIA_VISUALIZAR', descricao: 'Consultar log de auditoria' },
    ];

    for (const p of permissoesF1) {
      await this.db.insert(schema.permissoes).values(p).onConflictDoNothing();
    }

    for (const [slug, codigos] of Object.entries(MAPA_PERFIL_PERMISSOES)) {
      if (codigos.length === 0) continue;
      const perfis = await this.db
        .select()
        .from(schema.perfis)
        .where(sql`${schema.perfis.slug} = ${slug}`);
      const perfil = perfis[0];
      if (!perfil) continue;
      const perfilId = perfil.id;
      for (const codigo of codigos) {
        const perms = await this.db
          .select()
          .from(schema.permissoes)
          .where(sql`${schema.permissoes.codigo} = ${codigo}`);
        const perm = perms[0];
        if (!perm) continue;
        await this.db
          .insert(schema.perfisPermissoes)
          .values({ perfilId, permissaoId: perm.id })
          .onConflictDoNothing();
      }
    }
  }
}
