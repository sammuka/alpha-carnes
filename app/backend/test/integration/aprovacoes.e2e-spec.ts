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
  let corteCookies: string;
  let operacaoId: string;
  let base: Awaited<ReturnType<typeof seedComercialBase>>;

  beforeAll(async () => {
    app = await createTestApp();
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    corteCookies = await loginCookies(app, corte.adminEmail, corte.adminPassword);

    base = await seedComercialBase(app);
    const compra = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-09-01',
        fornecedorId: base.fornecedorId,
        itens: [{ produtoId: base.produtoCompraId, quantidadeComprada: 1 }],
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

  it('DoD 7.5.3 comparativo de ocorrência sem conclusão retorna 404 CONCLUSAO_INEXISTENTE', async () => {
    const ocorrencia = await request(app.getHttpServer())
      .post('/operacao/ocorrencias-fornecedor')
      .set('Cookie', gestorCookies)
      .send({ fornecedorId: base.fornecedorId, descricao: 'Ocorrência de teste sem conferência tripla vinculada' })
      .expect(201);
    const res = await request(app.getHttpServer())
      .get(`/gestao/aprovacoes/ocorrencias/${ocorrencia.body.id}/comparativo`)
      .set('Cookie', gestorCookies)
      .expect(404);
    // AllExceptionsFilter envelopa HttpException.getResponse() em `message`
    const payload = typeof res.body.message === 'object' ? res.body.message : res.body;
    expect(payload.codigo).toBe('CONCLUSAO_INEXISTENTE');
  });

  it('DoD 7.5.2a corte sem APROVACOES_LER recebe 403 na fila', async () => {
    await request(app.getHttpServer())
      .get(`/gestao/aprovacoes?operacaoId=${operacaoId}&aba=operacionais`)
      .set('Cookie', corteCookies)
      .expect(403);
  });

  it('DoD 7.5.2b compras sem APROVACOES_DECIDIR recebe 403 ao decidir', async () => {
    const criada = await request(app.getHttpServer())
      .post('/gestao/aprovacoes/operacionais')
      .set('Cookie', gestorCookies)
      .send({ operacaoId, tipo: 'ajuste_estoque_relevante', origem: 'RBAC 7.5.2b', descricao: 'Solicitação para teste de 403 na decisão', impacto: 'nenhum' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/gestao/aprovacoes/operacionais/${criada.body.id}/decidir`)
      .set('Cookie', comprasCookies)
      .send({ decisao: 'aprovada', motivo: 'motivo com dez+ caracteres' })
      .expect(403);
  });
});
