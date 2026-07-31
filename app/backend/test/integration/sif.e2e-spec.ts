import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  cleanupDb,
  createTestApp,
  createTestUser,
  loginCookies,
} from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';

describe('sif (catálogo, pendências, geração e retificação)', () => {
  let app: INestApplication;
  let gestorCookies: string;
  let comprasCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function criarOperacao(data: string) {
    const base = await seedComercialBase(app);
    const compra = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: data,
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 1 }],
      })
      .expect(201);
    return { operacaoId: compra.body.operacaoId as string, base };
  }

  it('4.1 lista 4 relatórios idempotentes por operação', async () => {
    const { operacaoId } = await criarOperacao('2026-09-10');
    const res = await request(app.getHttpServer())
      .get(`/sif/relatorios?operacaoId=${operacaoId}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(res.body).toHaveLength(4);
    const segunda = await request(app.getHttpServer())
      .get(`/sif/relatorios?operacaoId=${operacaoId}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(segunda.body).toHaveLength(4);
  });

  it('4.2 gera versão quando sem pendências', async () => {
    const { operacaoId } = await criarOperacao('2026-09-11');
    const lista = await request(app.getHttpServer())
      .get(`/sif/relatorios?operacaoId=${operacaoId}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const relatorio = lista.body.find((r: { tipo: string }) => r.tipo === 'controle_expedicao');
    const gerar = await request(app.getHttpServer())
      .post(`/sif/relatorios/${relatorio.id}/gerar`)
      .set('Cookie', gestorCookies)
      .expect(201);
    expect(gerar.body.relatorio.versaoAtual).toBe(1);
  });

  it('4.3 retifica versão gerada', async () => {
    const { operacaoId } = await criarOperacao('2026-09-12');
    const lista = await request(app.getHttpServer())
      .get(`/sif/relatorios?operacaoId=${operacaoId}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const relatorio = lista.body.find((r: { tipo: string }) => r.tipo === 'mapa_recebimento');
    await request(app.getHttpServer())
      .post(`/sif/relatorios/${relatorio.id}/gerar`)
      .set('Cookie', gestorCookies)
      .expect(201);
    const retificar = await request(app.getHttpServer())
      .post(`/sif/relatorios/${relatorio.id}/retificar`)
      .set('Cookie', gestorCookies)
      .send({ motivo: 'Correção de apontamento após revisão do recebimento do dia' })
      .expect(201);
    expect(retificar.body.relatorio.versaoAtual).toBe(2);
  });

  it('4.12 produção/desossa sem transformações fica pronta para gerar', async () => {
    const { operacaoId: opA } = await criarOperacao('2026-09-20');
    const { operacaoId: opB } = await criarOperacao('2026-09-21');

    const listaA = await request(app.getHttpServer())
      .get(`/sif/relatorios?operacaoId=${opA}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const desossaA = listaA.body.find((r: { tipo: string }) => r.tipo === 'producao_desossa');
    expect(desossaA.status).toBe('pronto_para_gerar');
    expect(desossaA.pendenciasJson).toEqual([]);

    const listaB = await request(app.getHttpServer())
      .get(`/sif/relatorios?operacaoId=${opB}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const desossaB = listaB.body.find((r: { tipo: string }) => r.tipo === 'producao_desossa');
    expect(desossaB.status).toBe('pronto_para_gerar');
  });
});
