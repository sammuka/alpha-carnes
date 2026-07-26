import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  cleanupDb,
  createTestApp,
  createTestUser,
  loginCookies,
} from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';

describe('dashboard-operacao (10 KPIs, alertas e atividades)', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let gestorCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('5.1 retorna 10 KPIs na ordem do protótipo', async () => {
    const base = await seedComercialBase(app);
    const compra = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-09-15',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 5 }],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/gestao/dashboard?operacaoId=${compra.body.operacaoId}`)
      .set('Cookie', gestorCookies)
      .expect(200);

    expect(res.body.kpis).toHaveLength(10);
    expect(res.body.kpis.map((k: { chave: string }) => k.chave)).toEqual([
      'compras_programadas', 'disponibilidade_total', 'reservas_em_elaboracao',
      'pedidos_finalizados', 'overbookings_abertos', 'recebimentos_aguardados',
      'divergencias_abertas', 'pecas_em_desossa', 'relatorios_sif_pendentes',
      'faturamentos_pendentes',
    ]);
    expect(res.body.operacao.id).toBe(compra.body.operacaoId);
  });

  it('5.2 nenhum alerta quando não há fato', async () => {
    const base = await seedComercialBase(app);
    const compra = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-09-16',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 1 }],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/gestao/dashboard?operacaoId=${compra.body.operacaoId}`)
      .set('Cookie', gestorCookies)
      .expect(200);

    expect(res.body.alertas).toEqual([]);
  });

  it('5.3 sem operação cadastrada retorna 404 OPERACAO_INEXISTENTE', async () => {
    await cleanupDb(app);
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    const cookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    const res = await request(app.getHttpServer())
      .get('/gestao/dashboard')
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatchObject({ message: 'OPERACAO_INEXISTENTE' });
  });
});
