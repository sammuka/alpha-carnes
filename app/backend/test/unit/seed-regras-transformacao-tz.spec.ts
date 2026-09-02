import { INestApplication } from '@nestjs/common';
import { eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/schema';
import { regrasTransformacao } from '../../src/database/schema';
import { DRIZZLE } from '../../src/database/database.module';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { seedRegrasTransformacaoTz } from '../../src/database/seed-regras-transformacao-tz';
import { createTestApp, cleanupDb } from '../helpers/test-app';

describe('seedRegrasTransformacaoTz', () => {
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

  it('cria TZ_A (CB+JAC) e TZ_B (CBA+FC) com provisorio=true', async () => {
    await seedCatalogoMvp(db);
    await seedRegrasTransformacaoTz(db);
    await seedRegrasTransformacaoTz(db); // idempotente
    const regras = await db
      .select()
      .from(regrasTransformacao)
      .where(isNull(regrasTransformacao.deletedAt));
    const ativas = regras.filter((r) => r.codigo === 'TZ_A' || r.codigo === 'TZ_B');
    expect(ativas).toHaveLength(2);
    expect(ativas.every((r) => r.provisorio === true)).toBe(true);

    const saidas = await db
      .select({
        regra: schema.regrasTransformacao.codigo,
        produto: schema.produtos.codigo,
      })
      .from(schema.regrasTransformacaoSaidas)
      .innerJoin(schema.regrasTransformacao, eq(schema.regrasTransformacao.id, schema.regrasTransformacaoSaidas.regraId))
      .innerJoin(schema.produtos, eq(schema.produtos.id, schema.regrasTransformacaoSaidas.produtoId))
      .where(isNull(schema.regrasTransformacao.deletedAt));
    expect(saidas).toEqual(
      expect.arrayContaining([
        { regra: 'TZ_A', produto: 'CB' },
        { regra: 'TZ_A', produto: 'JAC' },
        { regra: 'TZ_B', produto: 'CBA' },
        { regra: 'TZ_B', produto: 'FC' },
      ]),
    );
    expect(saidas).toHaveLength(4);
  });
});
