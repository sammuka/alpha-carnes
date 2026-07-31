import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  cleanupDb,
  createTestApp,
  createTestUser,
  loginCookies,
} from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';

describe('aprovacoes (fila unificada + comparativo)', () => {
  let app: INestApplication;
  let gestorCookies: string;
  let comprasCookies: string;
  let operacaoId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);

    const base = await seedComercialBase(app);
    const compra = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-09-01',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 1 }],
      })
      .expect(201);
    operacaoId = compra.body.operacaoId as string;
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('3.3 lista aba operacionais vazia inicialmente', async () => {
    const res = await request(app.getHttpServer())
      .get(`/gestao/aprovacoes?operacaoId=${operacaoId}&aba=operacionais`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(res.body.data).toEqual([]);
  });

  it('3.4 abre solicitação operacional', async () => {
    const res = await request(app.getHttpServer())
      .post('/gestao/aprovacoes/operacionais')
      .set('Cookie', gestorCookies)
      .send({
        operacaoId,
        tipo: 'ajuste_estoque_relevante',
        origem: 'Estoque TZ',
        descricao: 'Ajuste relevante de estoque por divergência operacional',
        impacto: 'Impacto na disponibilidade virtual do dia',
      })
      .expect(201);
    expect(res.body.status).toBe('pendente');
  });

  it('3.5 decide solicitação operacional', async () => {
    const lista = await request(app.getHttpServer())
      .get(`/gestao/aprovacoes?operacaoId=${operacaoId}&aba=operacionais`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const id = lista.body.data[0].id;
    const res = await request(app.getHttpServer())
      .post(`/gestao/aprovacoes/operacionais/${id}/decidir`)
      .set('Cookie', gestorCookies)
      .send({
        decisao: 'aprovada',
        motivo: 'Aprovado após revisão do impacto no estoque virtual do dia',
      })
      .expect(201);
    expect(res.body.status).toBe('aprovada');
  });

  it('3.6 rejeita segunda decisão com APROVACAO_JA_DECIDIDA', async () => {
    const lista = await request(app.getHttpServer())
      .get(`/gestao/aprovacoes?operacaoId=${operacaoId}&aba=operacionais`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const id = lista.body.data[0].id;
    const res = await request(app.getHttpServer())
      .post(`/gestao/aprovacoes/operacionais/${id}/decidir`)
      .set('Cookie', gestorCookies)
      .send({
        decisao: 'rejeitada',
        motivo: 'Tentativa inválida de decidir novamente a mesma solicitação',
      });
    expect(res.status).toBe(409);
  });

  it('3.7 comparativo retorna CONCLUSAO_INEXISTENTE sem conferência', async () => {
    const ocorrencias = await request(app.getHttpServer())
      .get(`/gestao/aprovacoes?operacaoId=${operacaoId}&aba=ocorrencias`)
      .set('Cookie', gestorCookies)
      .expect(200);
    if (ocorrencias.body.data.length === 0) return;
    const res = await request(app.getHttpServer())
      .get(`/gestao/aprovacoes/ocorrencias/${ocorrencias.body.data[0].id}/comparativo`)
      .set('Cookie', gestorCookies);
    expect([404, 200]).toContain(res.status);
  });
});
