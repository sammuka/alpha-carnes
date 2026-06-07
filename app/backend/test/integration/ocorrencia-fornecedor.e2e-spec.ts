import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada } from '../helpers/comercial-fixtures';

describe('Ocorrência com fornecedor e2e (abertura, timeline, encerramento)', () => {
  let app: INestApplication;
  let comprasCookies: string; // gerencia ocorrência
  let comercialCookies: string; // sem permissão de ocorrência

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  async function abrirOcorrencia(dataOperacao: string) {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao, quantidade: 10 });
    const res = await request(srv())
      .post('/operacao/ocorrencias-fornecedor')
      .set('Cookie', comprasCookies)
      .send({ fornecedorId: base.fornecedorId, compraProgramadaId: compraId, descricao: 'Atraso recorrente' });
    return res;
  }

  it('abrir ocorrência → 201 e gera entrada na timeline', async () => {
    const res = await abrirOcorrencia('2026-12-01');
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('aberta');

    const detalhe = await request(srv()).get(`/operacao/ocorrencias-fornecedor/${res.body.id}`).set('Cookie', comprasCookies);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.historico).toHaveLength(1);
    expect(detalhe.body.historico[0].acao).toBe('abertura');
  });

  it('atualizar ocorrência adiciona entrada na timeline (ordenada)', async () => {
    const aberta = await abrirOcorrencia('2026-12-02');
    const id = aberta.body.id as string;

    const upd = await request(srv())
      .patch(`/operacao/ocorrencias-fornecedor/${id}`)
      .set('Cookie', comprasCookies)
      .send({ status: 'aguardando_fornecedor', acao: 'Contato realizado', retornoFornecedor: 'Vão verificar' });
    expect(upd.status).toBe(200);
    expect(upd.body.status).toBe('aguardando_fornecedor');

    const detalhe = await request(srv()).get(`/operacao/ocorrencias-fornecedor/${id}`).set('Cookie', comprasCookies);
    expect(detalhe.body.historico.length).toBeGreaterThanOrEqual(2);
  });

  it('encerrar SEM desfecho → 400 (validação)', async () => {
    const aberta = await abrirOcorrencia('2026-12-03');
    const id = aberta.body.id as string;
    const res = await request(srv()).post(`/operacao/ocorrencias-fornecedor/${id}/encerrar`).set('Cookie', comprasCookies).send({});
    expect(res.status).toBe(400);
  });

  it('encerrar COM desfecho → 201 (resolvida) e timeline final', async () => {
    const aberta = await abrirOcorrencia('2026-12-04');
    const id = aberta.body.id as string;
    const res = await request(srv())
      .post(`/operacao/ocorrencias-fornecedor/${id}/encerrar`)
      .set('Cookie', comprasCookies)
      .send({ desfecho: 'Compensação acordada' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('resolvida');
    expect(res.body.desfecho).toBe('Compensação acordada');

    const detalhe = await request(srv()).get(`/operacao/ocorrencias-fornecedor/${id}`).set('Cookie', comprasCookies);
    const ultima = detalhe.body.historico[detalhe.body.historico.length - 1];
    expect(ultima.acao).toBe('encerramento');
  });

  it('atualizar/encerrar ocorrência inexistente → 404', async () => {
    const id = '019ea000-0000-7000-8000-000000000aaa';
    const upd = await request(srv()).patch(`/operacao/ocorrencias-fornecedor/${id}`).set('Cookie', comprasCookies).send({ acao: 'x' });
    expect(upd.status).toBe(404);
    const enc = await request(srv()).post(`/operacao/ocorrencias-fornecedor/${id}/encerrar`).set('Cookie', comprasCookies).send({ desfecho: 'y' });
    expect(enc.status).toBe(404);
    const det = await request(srv()).get(`/operacao/ocorrencias-fornecedor/${id}`).set('Cookie', comprasCookies);
    expect(det.status).toBe(404);
  });

  it('atualizar/encerrar ocorrência já resolvida → 409', async () => {
    const aberta = await abrirOcorrencia('2026-12-05');
    const id = aberta.body.id as string;
    await request(srv()).post(`/operacao/ocorrencias-fornecedor/${id}/encerrar`).set('Cookie', comprasCookies).send({ desfecho: 'Resolvido' });
    const upd = await request(srv()).patch(`/operacao/ocorrencias-fornecedor/${id}`).set('Cookie', comprasCookies).send({ acao: 'tentativa' });
    expect(upd.status).toBe(409);
    const enc = await request(srv()).post(`/operacao/ocorrencias-fornecedor/${id}/encerrar`).set('Cookie', comprasCookies).send({ desfecho: 'de novo' });
    expect(enc.status).toBe(409);
  });

  it('abrir ocorrência avulsa sem compra (dataOperacao vazia) → 201', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const res = await request(srv())
      .post('/operacao/ocorrencias-fornecedor')
      .set('Cookie', comprasCookies)
      .send({ fornecedorId: base.fornecedorId, descricao: 'Ocorrência avulsa sem compra vinculada' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('aberta');
  });

  it('RBAC: comercial sem OCORRENCIA_FORNECEDOR_GERENCIAR → 403', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const res = await request(srv())
      .post('/operacao/ocorrencias-fornecedor')
      .set('Cookie', comercialCookies)
      .send({ fornecedorId: base.fornecedorId, descricao: 'teste' });
    expect(res.status).toBe(403);
  });
});
