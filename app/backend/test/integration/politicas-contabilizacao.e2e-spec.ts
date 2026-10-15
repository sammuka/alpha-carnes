import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb, createTestUser } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { centrosCusto, contasContabeis } from '../../src/database/schema/contabilidade-plano.schema';
import {
  politicasContabilizacao,
  politicaVersoes,
  politicaSimulacoes,
} from '../../src/database/schema/contabilidade-politicas.schema';

describe('Políticas de contabilização', () => {
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

  it('recusa tipo fora do enum, competência fora do dia 01 e simulação desbalanceada', async () => {
    const centro = await db.insert(centrosCusto).values({ codigo: 'CT1', nome: 'Operação industrial' }).returning();
    const debito = await db.insert(contasContabeis).values({ codigo: '1.1.01' }).returning();
    const credito = await db.insert(contasContabeis).values({ codigo: '2.1.01' }).returning();
    const politica = await db.insert(politicasContabilizacao).values({
      codigo: 'LIQUIDACAO-2026-10',
      tipoEvento: 'LIQUIDACAO',
      competencia: '2026-10-01',
    }).returning();
    await expect(db.insert(politicasContabilizacao).values({
      codigo: 'OUTRO-2026-10',
      tipoEvento: 'COMPRA',
      competencia: '2026-10-01',
    })).rejects.toThrow();
    await expect(db.insert(politicasContabilizacao).values({
      codigo: 'LIQUIDACAO-2026-11',
      tipoEvento: 'LIQUIDACAO',
      competencia: '2026-11-15',
    })).rejects.toThrow();
    const versao = await db.insert(politicaVersoes).values({
      politicaId: politica[0].id,
      numero: 1,
      contaDebitoId: debito[0].id,
      contaCreditoId: credito[0].id,
      centroCustoId: centro[0].id,
      vigenciaInicio: '2026-10-01',
      situacao: 'DRAFT',
      justificativa: 'abre',
      responsavelId: adminId,
    }).returning();
    await expect(db.insert(politicaSimulacoes).values({
      politicaId: politica[0].id,
      versaoNumero: versao[0].numero,
      valor: '10.00',
      debito: '10.00',
      credito: '10.01',
    })).rejects.toThrow();
  });
});
