import { INestApplication } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/schema';
import { produtos, regrasDesdobramentoComercial } from '../../src/database/schema';
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
      .from(produtos)
      .where(and(eq(produtos.codigo, 'BOI'), isNull(produtos.deletedAt)));
    expect(boi).toBeDefined();
    expect(boi!.tipoOperacional).toBe('compra_base');
    expect(boi!.ativoCompra).toBe(true);
    expect(boi!.ativoVenda).toBe(false);

    const regras = await db
      .select({
        codigoDestino: produtos.codigo,
        fator: regrasDesdobramentoComercial.fatorQuantidade,
      })
      .from(regrasDesdobramentoComercial)
      .innerJoin(produtos, eq(produtos.id, regrasDesdobramentoComercial.produtoDestinoId))
      .where(
        and(
          eq(regrasDesdobramentoComercial.produtoOrigemId, boi!.id),
          isNull(regrasDesdobramentoComercial.deletedAt),
        ),
      );

    expect(regras).toHaveLength(3);
    expect(regras.map((r) => ({ codigoDestino: r.codigoDestino, fator: Number(r.fator) }))).toEqual(
      expect.arrayContaining([
        { codigoDestino: 'TZ', fator: 2 },
        { codigoDestino: 'DT', fator: 2 },
        { codigoDestino: 'PA', fator: 2 },
      ]),
    );
  });

  it('não cria regras de identidade origem=destino (AD-15)', async () => {
    await seedCatalogoMvp(db);
    await seedRegrasDesdobramentoComercial(db);

    const identidade = await db
      .select({ id: regrasDesdobramentoComercial.id })
      .from(regrasDesdobramentoComercial)
      .where(
        and(
          isNull(regrasDesdobramentoComercial.deletedAt),
          eq(regrasDesdobramentoComercial.produtoOrigemId, regrasDesdobramentoComercial.produtoDestinoId),
        ),
      );

    expect(identidade).toHaveLength(0);
  });
});
