import { INestApplication } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/schema';
import { produtos } from '../../src/database/schema';
import { DRIZZLE } from '../../src/database/database.module';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { createTestApp, cleanupDb } from '../helpers/test-app';

describe('Onda 13 — seed do catálogo MVP (AD-15, Provisório P11)', () => {
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

  it('seed cria 12 produtos com flags BOI/BPORCO corretas', async () => {
    await seedCatalogoMvp(db);
    const prods = await db.select().from(produtos);
    expect(prods).toHaveLength(12);
    expect(new Set(prods.map((p) => p.codigo)).size).toBe(12);

    const boi = prods.find((p) => p.codigo === 'BOI');
    expect(boi).toEqual(expect.objectContaining({
      tipoOperacional: 'compra_base',
      ativoVenda: false,
      ativoCompra: true,
    }));

    const bporco = prods.find((p) => p.codigo === 'BPORCO');
    expect(bporco).toEqual(expect.objectContaining({
      ativoVenda: true,
      ativoCompra: true,
    }));

    expect(prods.filter((p) => p.unidadePreco === 'unidade').map((p) => p.codigo).sort())
      .toEqual(['CXFIG', 'CXMIU', 'CXRABO']);
    expect(prods.every((p) => p.unidadePedido === 'unidade')).toBe(true);
    expect(prods.find((p) => p.codigo === 'TZ')).toEqual(expect.objectContaining({
      origemTransformacao: true,
      passaDesossa: true,
      ativoVenda: true,
      ativoCompra: true,
    }));
    expect(prods.filter((p) => p.saidaTransformacao).map((p) => p.codigo).sort())
      .toEqual(['CB', 'CBA', 'FC', 'JAC']);
  });

  it('seed é idempotente', async () => {
    await seedCatalogoMvp(db);
    await seedCatalogoMvp(db);
    expect(await db.select().from(produtos)).toHaveLength(12);
  });
});
