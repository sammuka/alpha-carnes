import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { count, eq } from 'drizzle-orm';
import * as schema from '../../src/database/schema';
import { seed } from '../../src/database/seed';

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

  it('tem exatamente 4 permissões F1 após seed 2×', async () => {
    const [row] = await db.select({ total: count() }).from(schema.permissoes);
    expect(row?.total).toBe(4);
  });

  it('tem exatamente 1 usuário admin após seed 2×', async () => {
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
    const rows = await db
      .select()
      .from(schema.usuarios)
      .where(eq(schema.usuarios.email, adminEmail));
    expect(rows.length).toBe(1);
  });
});
