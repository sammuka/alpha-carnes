import { INestApplication } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/schema';
import { itensComerciais, produtos } from '../../src/database/schema';
import { DRIZZLE } from '../../src/database/database.module';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { createTestApp, cleanupDb } from '../helpers/test-app';

describe('Onda 4 — seed do catálogo MVP (D5/D6, Provisório P11)', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDb(app);
  });

  it('seed cria onze pares item comercial e produto vinculados um para um', async () => {
    await seedCatalogoMvp(db);
    const itens = await db.select().from(itensComerciais);
    const prods = await db.select().from(produtos);
    expect(itens).toHaveLength(11);
    expect(prods).toHaveLength(11);
    expect(prods.every((p) => p.legadoItemComercialId !== null)).toBe(true);
    expect(new Set(prods.map((p) => p.legadoItemComercialId)).size).toBe(11);
    expect(prods.filter((p) => p.unidadePreco === 'unidade').map((p) => p.codigo).sort())
      .toEqual(['CXFIG', 'CXMIU', 'CXRABO']);
  });

  it('seed e idempotente', async () => {
    await seedCatalogoMvp(db);
    await seedCatalogoMvp(db);
    expect(await db.select().from(produtos)).toHaveLength(11);
  });
});
