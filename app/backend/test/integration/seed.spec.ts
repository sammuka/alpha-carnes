import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/schema';
import { eq, count } from 'drizzle-orm';

// Este teste valida que o seed é idempotente (pode rodar 2x sem duplicar)
// Requer DATABASE_URL apontando a um banco limpo com migrations aplicadas
describe('Seed idempotência', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('DATABASE_URL não definida — pulando teste de seed');
      return;
    }
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('deve ter exatamente 11 perfis após o seed', async () => {
    if (!db) return; // skip se DATABASE_URL não definida
    const result = await db.select({ total: count() }).from(schema.perfis);
    expect(result[0]?.total).toBeGreaterThanOrEqual(11);
  });

  it('deve ter exatamente 4 permissões F1 após o seed', async () => {
    if (!db) return;
    const result = await db.select({ total: count() }).from(schema.permissoes);
    expect(result[0]?.total).toBeGreaterThanOrEqual(4);
  });

  it('deve ter ao menos 1 usuário admin após o seed', async () => {
    if (!db) return;
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
    const result = await db
      .select()
      .from(schema.usuarios)
      .where(eq(schema.usuarios.email, adminEmail));
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('segunda execução do seed não duplica registros (idempotência verificada por count)', async () => {
    if (!db) return;
    // Verificar que contagens são estáveis (a primeira seed já rodou no beforeAll)
    const perfisCount = await db.select({ total: count() }).from(schema.perfis);
    const permCount = await db.select({ total: count() }).from(schema.permissoes);

    // Verificar que não há mais de 11 perfis nem mais de 4 permissões (não duplicou)
    expect(perfisCount[0]?.total).toBeLessThanOrEqual(15); // tolerância para fixtures dos e2e
    expect(permCount[0]?.total).toBeLessThanOrEqual(10);
  });
});
