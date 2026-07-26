import { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { criarConclusaoConferencia } from '../helpers/recebimento-fixtures';

type Db = NodePgDatabase<typeof schema>;

describe('conclusoes_conferencia — imutabilidade (DoD 3)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); }, 60000);
  afterAll(async () => { await cleanupDb(app); await app.close(); });

  const db = () => app.get<{ db: Db }>(DRIZZLE).db;

  it('UPDATE bloqueado por trigger', async () => {
    const { conclusaoId } = await criarConclusaoConferencia(app);
    try {
      await db().execute(sql`UPDATE conclusoes_conferencia SET quadro_json = '[]'::jsonb WHERE id = ${conclusaoId}`);
      fail('expected throw');
    } catch (e: unknown) {
      const err = e as { message?: string; cause?: { message?: string } };
      const texto = `${err.message ?? ''} ${err.cause?.message ?? ''}`;
      expect(texto).toMatch(/imutavel/i);
    }
  });

  it('DELETE bloqueado por trigger', async () => {
    const { conclusaoId } = await criarConclusaoConferencia(app);
    try {
      await db().execute(sql`DELETE FROM conclusoes_conferencia WHERE id = ${conclusaoId}`);
      fail('expected throw');
    } catch (e: unknown) {
      const err = e as { message?: string; cause?: { message?: string } };
      const texto = `${err.message ?? ''} ${err.cause?.message ?? ''}`;
      expect(texto).toMatch(/imutavel/i);
    }
  });
});
