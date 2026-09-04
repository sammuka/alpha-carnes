import { INestApplication } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/schema';
import { itensCompra, itensComerciais, regrasDesdobramentoComercial } from '../../src/database/schema';
import { DRIZZLE } from '../../src/database/database.module';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { seedRegrasDesdobramentoComercial } from '../../src/database/seed-regras-desdobramento-comercial';
import { createTestApp, cleanupDb } from '../helpers/test-app';

describe('seedRegrasDesdobramentoComercial', () => {
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

  it('cria BOI → 2 TZ + 2 DT + 2 PA (AD-01) e é idempotente', async () => {
    await seedCatalogoMvp(db);
    await seedRegrasDesdobramentoComercial(db);
    await seedRegrasDesdobramentoComercial(db);

    const [boi] = await db
      .select()
      .from(itensCompra)
      .where(and(eq(itensCompra.codigo, 'BOI'), isNull(itensCompra.deletedAt)));
    expect(boi).toBeDefined();
    expect(boi!.unidadeCompra).toBe('unidade');

    const regras = await db
      .select({
        codigoComercial: itensComerciais.codigo,
        fator: regrasDesdobramentoComercial.fatorQuantidade,
      })
      .from(regrasDesdobramentoComercial)
      .innerJoin(itensComerciais, eq(itensComerciais.id, regrasDesdobramentoComercial.itemComercialId))
      .where(
        and(
          eq(regrasDesdobramentoComercial.itemCompraId, boi!.id),
          isNull(regrasDesdobramentoComercial.deletedAt),
        ),
      );

    expect(regras).toHaveLength(3);
    expect(regras.map((r) => ({ codigoComercial: r.codigoComercial, fator: Number(r.fator) }))).toEqual(
      expect.arrayContaining([
        { codigoComercial: 'TZ', fator: 2 },
        { codigoComercial: 'DT', fator: 2 },
        { codigoComercial: 'PA', fator: 2 },
      ]),
    );
  });

  it('liga TZ/DT/PA compra → comercial 1:1 quando o item de compra já existe', async () => {
    await seedCatalogoMvp(db);
    await db.insert(itensCompra).values([
      { codigo: 'TZ', descricao: 'traseiro', unidadeCompra: 'kg' },
      { codigo: 'DT', descricao: 'Dianteiro', unidadeCompra: 'kg' },
      { codigo: 'PA', descricao: 'Ponta de agulha', unidadeCompra: 'kg' },
    ]);
    await seedRegrasDesdobramentoComercial(db);

    const identidade = await db
      .select({
        compra: itensCompra.codigo,
        comercial: itensComerciais.codigo,
        fator: regrasDesdobramentoComercial.fatorQuantidade,
      })
      .from(regrasDesdobramentoComercial)
      .innerJoin(itensCompra, eq(itensCompra.id, regrasDesdobramentoComercial.itemCompraId))
      .innerJoin(itensComerciais, eq(itensComerciais.id, regrasDesdobramentoComercial.itemComercialId))
      .where(isNull(regrasDesdobramentoComercial.deletedAt));

    expect(identidade).toEqual(
      expect.arrayContaining([
        { compra: 'TZ', comercial: 'TZ', fator: expect.any(String) },
        { compra: 'DT', comercial: 'DT', fator: expect.any(String) },
        { compra: 'PA', comercial: 'PA', fator: expect.any(String) },
      ]),
    );
    expect(identidade.filter((r) => r.compra === r.comercial).every((r) => Number(r.fator) === 1)).toBe(true);
  });
});
