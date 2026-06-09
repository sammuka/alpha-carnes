import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { criarCaminhaoComCargaFechada } from '../helpers/faturamento-fixtures';
import { fakes } from '../helpers/pesagem-fixtures';
import { NFSE_GATEWAY } from '../../src/integracoes/nfse/nfse.types';
import type { FakeNfseGateway } from '../../src/integracoes/nfse/fake-nfse.gateway';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

process.env['EISS_RETRY_DELAY_MS'] = '1';

describe('Faturamento — concorrência (F6a)', () => {
  let app: INestApplication;

  let faturamentoCookies: string;
  let comprasCookies: string;
  let recebimentoCookies: string;
  let comercialCookies: string;
  let expedicaoCookies: string;

  const srv = () => app.getHttpServer();
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
  const nfseGateway = () => app.get<FakeNfseGateway>(NFSE_GATEWAY);

  beforeAll(async () => {
    app = await createTestApp({ EISS_RETRY_DELAY_MS: '1' });

    const fat = await createTestUser(app, { perfil: 'faturamento' });
    const comp = await createTestUser(app, { perfil: 'compras' });
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const com = await createTestUser(app, { perfil: 'comercial' });
    const exp = await createTestUser(app, { perfil: 'expedicao' });

    faturamentoCookies = await loginCookies(app, fat.adminEmail, fat.adminPassword);
    comprasCookies = await loginCookies(app, comp.adminEmail, comp.adminPassword);
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comercialCookies = await loginCookies(app, com.adminEmail, com.adminPassword);
    expedicaoCookies = await loginCookies(app, exp.adminEmail, exp.adminPassword);
  }, 90000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  beforeEach(() => {
    nfseGateway().definirCenario('sucesso');
    nfseGateway().definirConsultarAchaNota(true);
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('15.000');
    fakes(app).impressora.definirStatus('disponivel');
    fakes(app).leitor.definirStatus('disponivel');
  });

  const allCookies = () => ({
    compras: comprasCookies,
    recebimento: recebimentoCookies,
    comercial: comercialCookies,
    expedicao: expedicaoCookies,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Teste de concorrência principal: dois emitir paralelos para o mesmo pedido
  // ─────────────────────────────────────────────────────────────────────────

  it('2 emitir paralelos no mesmo pedido → exatamente 1 emite e 1 recebe 409; gateway chamado 1 vez', async () => {
    const { default: request } = await import('supertest');
    nfseGateway().definirCenario('sucesso');

    // Setup: criar caminhão fechado com 1 pedido
    const { caminhaoId, pedidoVendaId, faturamentoContexto } =
      await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-03-01' });

    // Consolidar primeiro (cria faturamento)
    const consRes = await request(srv())
      .get(`/operacao/faturamento/caminhoes/${caminhaoId}/consolidacao`)
      .set('Cookie', faturamentoCookies);
    expect(consRes.status).toBe(200);

    // Spy no gateway para contar chamadas reais
    const emitirSpy = jest.spyOn(nfseGateway(), 'emitir');

    // Disparar 2 requisições paralelas para o mesmo pedido
    const [res1, res2] = await Promise.all([
      request(srv())
        .post(`/operacao/faturamento/caminhoes/${caminhaoId}/emitir`)
        .set('Cookie', faturamentoCookies)
        .send({ pedidoVendaId, valor: faturamentoContexto.valor }),
      request(srv())
        .post(`/operacao/faturamento/caminhoes/${caminhaoId}/emitir`)
        .set('Cookie', faturamentoCookies)
        .send({ pedidoVendaId, valor: faturamentoContexto.valor }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Exatamente 1 sucesso (201) e 1 conflito (409)
    expect(statuses).toEqual([201, 409]);

    // Gateway deve ter sido chamado exatamente 1 vez (o segundo foi barrado antes do gateway)
    expect(emitirSpy).toHaveBeenCalledTimes(1);

    // Deve haver exatamente 1 NF no banco para o pedido
    const nfs = await db().select().from(schema.notasFiscais)
      .where(and(eq(schema.notasFiscais.pedidoVendaId, pedidoVendaId), isNull(schema.notasFiscais.deletedAt)));
    expect(nfs).toHaveLength(1);
    expect(nfs[0]!.statusNfse).toBe('emitida');

    emitirSpy.mockRestore();
  }, 90000);

  // ─────────────────────────────────────────────────────────────────────────
  // Após erro_emissao, nova emissão é permitida (índice parcial libera)
  // ─────────────────────────────────────────────────────────────────────────

  it('após erro_emissao, nova emissão para o mesmo pedido é permitida', async () => {
    const { default: request } = await import('supertest');

    const { caminhaoId, pedidoVendaId, faturamentoContexto } =
      await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-03-02' });

    // Consolidar
    await request(srv())
      .get(`/operacao/faturamento/caminhoes/${caminhaoId}/consolidacao`)
      .set('Cookie', faturamentoCookies);

    // Primeira emissão — erro_negocio → erro_emissao
    nfseGateway().definirCenario('erro_negocio');
    const res1 = await request(srv())
      .post(`/operacao/faturamento/caminhoes/${caminhaoId}/emitir`)
      .set('Cookie', faturamentoCookies)
      .send({ pedidoVendaId, valor: faturamentoContexto.valor });
    expect(res1.status).toBe(201);
    expect(res1.body.statusNfse).toBe('erro_emissao');

    // O índice parcial uq_notas_fiscais_pedido_viva EXCLUI erro_emissao —
    // portanto uma nova emissão direta deve ser permitida (insere nova linha)
    nfseGateway().definirCenario('sucesso');
    const res2 = await request(srv())
      .post(`/operacao/faturamento/caminhoes/${caminhaoId}/emitir`)
      .set('Cookie', faturamentoCookies)
      .send({ pedidoVendaId, valor: faturamentoContexto.valor });

    // Nova emissão deve ser aceita (201) — não bloqueada pelo índice parcial
    expect(res2.status).toBe(201);
    expect(res2.body.statusNfse).toBe('emitida');
  }, 90000);

  // ─────────────────────────────────────────────────────────────────────────
  // Três emissões paralelas para o mesmo pedido — apenas 1 sucede
  // ─────────────────────────────────────────────────────────────────────────

  it('3 emitir paralelos no mesmo pedido → exatamente 1 sucede, 2 recebem 409', async () => {
    const { default: request } = await import('supertest');
    nfseGateway().definirCenario('sucesso');

    const { caminhaoId, pedidoVendaId, faturamentoContexto } =
      await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-03-03' });

    // Consolidar
    await request(srv())
      .get(`/operacao/faturamento/caminhoes/${caminhaoId}/consolidacao`)
      .set('Cookie', faturamentoCookies);

    const resultados = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(srv())
          .post(`/operacao/faturamento/caminhoes/${caminhaoId}/emitir`)
          .set('Cookie', faturamentoCookies)
          .send({ pedidoVendaId, valor: faturamentoContexto.valor }),
      ),
    );

    const sucessos = resultados.filter((r) => r.status === 201).length;
    const conflitos = resultados.filter((r) => r.status === 409).length;

    expect(sucessos).toBe(1);
    expect(conflitos).toBe(2);

    // Exatamente 1 NF no banco
    const nfs = await db().select().from(schema.notasFiscais)
      .where(and(eq(schema.notasFiscais.pedidoVendaId, pedidoVendaId), isNull(schema.notasFiscais.deletedAt)));
    expect(nfs).toHaveLength(1);
  }, 90000);
});
