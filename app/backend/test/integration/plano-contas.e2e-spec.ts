import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb, createTestUser } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { centrosCusto, contasContabeis, contaVersoes } from '../../src/database/schema/contabilidade-plano.schema';

describe('Plano de contas', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let adminId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const [usuario] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, admin.adminEmail));
    if (!usuario) throw new Error('admin ausente');
    adminId = usuario.id;
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('recusa natureza fora do enum e vigência invertida', async () => {
    const centro = await db.insert(centrosCusto).values({ codigo: 'CT1', nome: 'Operação industrial' }).returning();
    const conta = await db.insert(contasContabeis).values({ codigo: '1' }).returning();
    const base = {
      contaId: conta[0].id,
      numero: 1,
      nome: 'Caixa',
      classificacao: 'analitica' as const,
      grupo: 'Circulante',
      centroCustoId: centro[0].id,
      situacao: 'DRAFT' as const,
      justificativa: 'teste',
      responsavelId: adminId,
    };
    await expect(db.insert(contaVersoes).values({
      ...base,
      natureza: 'OUTRA',
      vigenciaInicio: '2026-10-01',
    })).rejects.toThrow();
    await expect(db.insert(contaVersoes).values({
      ...base,
      natureza: 'ATIVO',
      vigenciaInicio: '2026-10-01',
      vigenciaFim: '2026-09-01',
    })).rejects.toThrow();
  });
});
