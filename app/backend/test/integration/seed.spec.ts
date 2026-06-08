import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { count, eq } from 'drizzle-orm';
import * as schema from '../../src/database/schema';
import { seed } from '../../src/database/seed';
import { DESCRICOES_PERMISSOES } from '../../src/common/rbac/permissoes';

describe('Seed idempotência', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL não definida');

    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });

    // Executar seed 2× para provar idempotência (DoD da F1)
    await seed();
    await seed();
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('tem exatamente 11 perfis canônicos após seed 2×', async () => {
    const [row] = await db.select({ total: count() }).from(schema.perfis);
    expect(row?.total).toBe(11);
  });

  it('tem exatamente o catálogo de permissões após seed 2× (idempotente)', async () => {
    const [row] = await db.select({ total: count() }).from(schema.permissoes);
    expect(row?.total).toBe(Object.keys(DESCRICOES_PERMISSOES).length);
  });

  it('tem exatamente 1 usuário admin após seed 2×', async () => {
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
    const rows = await db
      .select()
      .from(schema.usuarios)
      .where(eq(schema.usuarios.email, adminEmail));
    expect(rows.length).toBe(1);
  });

  it('perfil corte tem a permissão CORTE_GERENCIAR após seed', async () => {
    const linhas = await db
      .select({ codigo: schema.permissoes.codigo })
      .from(schema.perfis)
      .innerJoin(schema.perfisPermissoes, eq(schema.perfis.id, schema.perfisPermissoes.perfilId))
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id))
      .where(eq(schema.perfis.slug, 'corte'));
    expect(linhas.map((l) => l.codigo)).toContain('CORTE_GERENCIAR');
  });

  it('perfil expedicao tem EXPEDICAO_GERENCIAR após seed', async () => {
    const linhas = await db
      .select({ codigo: schema.permissoes.codigo })
      .from(schema.perfis)
      .innerJoin(schema.perfisPermissoes, eq(schema.perfis.id, schema.perfisPermissoes.perfilId))
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id))
      .where(eq(schema.perfis.slug, 'expedicao'));
    expect(linhas.map((l) => l.codigo)).toContain('EXPEDICAO_GERENCIAR');
  });

  it('perfil gestor tem EXPEDICAO_REABRIR após seed', async () => {
    const linhas = await db
      .select({ codigo: schema.permissoes.codigo })
      .from(schema.perfis)
      .innerJoin(schema.perfisPermissoes, eq(schema.perfis.id, schema.perfisPermissoes.perfilId))
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id))
      .where(eq(schema.perfis.slug, 'gestor'));
    expect(linhas.map((l) => l.codigo)).toContain('EXPEDICAO_REABRIR');
  });
});
