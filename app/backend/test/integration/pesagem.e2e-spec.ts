import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, fakes, type CenarioPesagem } from '../helpers/pesagem-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Pesagem e2e (captura ADR-009: automático/manual, fallback sem falha silenciosa)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  async function cenario(dataOperacao: string, quantidade = 10): Promise<CenarioPesagem> {
    const base = await seedComercialBase(app, { fator: 1 });
    return montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao, quantidade },
    );
  }

  beforeEach(() => {
    // Estado determinístico por teste.
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.500');
  });

  it('balança disponível → captura automática cria peça com leitura_estavel=true', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-07-01');

    const res = await request(srv())
      .post('/operacao/pesagem/pecas')
      .set('Cookie', recebimentoCookies)
      .send({ recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId, modoCaptura: 'automatico' });

    expect(res.status).toBe(201);
    expect(res.body.modoCapturaPeso).toBe('automatico');
    expect(res.body.pesoOriginal).toBe('12.500');
    expect(res.body.capturaMeta.leitura_estavel).toBe(true);
    expect(res.body.statusPeca).toBe('pesada');
  });

  it('balança indisponível → captura automática falha explícita e NENHUMA peça é gravada', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-07-02');
    fakes(app).balanca.definirStatus('indisponivel');

    const res = await request(srv())
      .post('/operacao/pesagem/pecas')
      .set('Cookie', recebimentoCookies)
      .send({ recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId, modoCaptura: 'automatico' });

    expect(res.status).toBe(409);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const pecas = await db.select().from(schema.pecas).where(eq(schema.pecas.recebimentoId, c.recebimentoId));
    expect(pecas).toHaveLength(0); // nenhum valor default gravado
  });

  it('leitura instável → não confirma como automático (409)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-07-03');
    fakes(app).balanca.definirStatus('instavel');

    const res = await request(srv())
      .post('/operacao/pesagem/pecas')
      .set('Cookie', recebimentoCookies)
      .send({ recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId, modoCaptura: 'automatico' });

    expect(res.status).toBe(409);
  });

  it('manual sem permissão PESO_MANUAL → 403', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-07-04');

    // comercial não tem PESO_MANUAL nem PESAGEM_GERENCIAR; valida o gate de permissão.
    // Usa um usuário com PESAGEM_GERENCIAR mas sem PESO_MANUAL? Nos perfis canônicos,
    // quem gerencia pesagem também tem PESO_MANUAL. Então provamos via comercial (sem
    // PESAGEM_GERENCIAR), que recebe 403 no guard de rota.
    const res = await request(srv())
      .post('/operacao/pesagem/pecas')
      .set('Cookie', comercialCookies)
      .send({
        recebimentoId: c.recebimentoId,
        itemComercialBaseId: c.itemComercialId,
        modoCaptura: 'manual_assistido',
        pesoManual: 11.2,
        motivo: 'dispositivo_indisponivel',
      });

    expect(res.status).toBe(403);
  });

  it('manual sem motivo → 400 (DTO falha explícito, nunca grava)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-07-05');

    const res = await request(srv())
      .post('/operacao/pesagem/pecas')
      .set('Cookie', recebimentoCookies)
      .send({
        recebimentoId: c.recebimentoId,
        itemComercialBaseId: c.itemComercialId,
        modoCaptura: 'manual_assistido',
        pesoManual: 11.2,
      });

    expect(res.status).toBe(400);
  });

  it('manual com motivo grava procedência (modo + motivo + snapshot do gateway_status)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-07-06');
    fakes(app).balanca.definirStatus('indisponivel');

    const res = await request(srv())
      .post('/operacao/pesagem/pecas')
      .set('Cookie', recebimentoCookies)
      .send({
        recebimentoId: c.recebimentoId,
        itemComercialBaseId: c.itemComercialId,
        modoCaptura: 'manual_assistido',
        pesoManual: 11.25,
        motivo: 'dispositivo_indisponivel',
      });

    expect(res.status).toBe(201);
    expect(res.body.modoCapturaPeso).toBe('manual_assistido');
    expect(res.body.pesoOriginal).toBe('11.250');
    expect(res.body.capturaMeta.motivo).toBe('dispositivo_indisponivel');
    expect(res.body.capturaMeta.leitura_estavel).toBe(false);
    expect(res.body.capturaMeta.gateway_status.status).toBe('indisponivel');
    expect(res.body.capturaMeta.operador).toBeDefined();
  });

  it('recebimento inexistente → 404', async () => {
    const { default: request } = await import('supertest');
    const res = await request(srv())
      .post('/operacao/pesagem/pecas')
      .set('Cookie', recebimentoCookies)
      .send({ recebimentoId: '019ea000-0000-7000-8000-000000000000', itemComercialBaseId: '019ea000-0000-7000-8000-000000000001', modoCaptura: 'automatico' });
    expect(res.status).toBe(404);
  });

  it('manual com motivo=outro exige motivoDetalhe (400)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-07-07');
    const res = await request(srv())
      .post('/operacao/pesagem/pecas')
      .set('Cookie', recebimentoCookies)
      .send({ recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId, modoCaptura: 'manual_assistido', pesoManual: 10, motivo: 'outro' });
    expect(res.status).toBe(400);
  });

  it('automático com peça pesada com sucesso após instabilidade resolvida', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-07-08');
    fakes(app).balanca.definirStatus('instavel');
    const instavel = await request(srv())
      .post('/operacao/pesagem/pecas')
      .set('Cookie', recebimentoCookies)
      .send({ recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId, modoCaptura: 'automatico' });
    expect(instavel.status).toBe(409);

    fakes(app).balanca.definirStatus('disponivel');
    const ok = await request(srv())
      .post('/operacao/pesagem/pecas')
      .set('Cookie', recebimentoCookies)
      .send({ recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId, modoCaptura: 'automatico' });
    expect(ok.status).toBe(201);
  });

  it('status dos dispositivos é consultável (RA-05 visível)', async () => {
    const { default: request } = await import('supertest');
    fakes(app).balanca.definirStatus('instavel');
    const res = await request(srv()).get('/operacao/pesagem/dispositivos/status').set('Cookie', recebimentoCookies);
    expect(res.status).toBe(200);
    expect(res.body.balanca.status).toBe('instavel');
    expect(res.body.impressora).toBeDefined();
    expect(res.body.leitor).toBeDefined();
  });
});
