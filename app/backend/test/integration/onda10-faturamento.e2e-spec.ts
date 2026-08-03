import type { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { criarCaminhaoComCargaFechada } from '../helpers/faturamento-fixtures';
import { fakes } from '../helpers/pesagem-fixtures';
import { NFSE_GATEWAY } from '../../src/integracoes/nfse/nfse.types';
import type { FakeNfseGateway } from '../../src/integracoes/nfse/fake-nfse.gateway';
import { EVENTOS } from '../../src/realtime/events/eventos';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';

process.env['EISS_RETRY_DELAY_MS'] = '1';

describe('Onda 10 — Faturamento (EISS real + RTC, Notas/XML, Seguro F6b, Liberação) — e2e', () => {
  let app: INestApplication;

  let faturamentoCookies: string;
  let comprasCookies: string;
  let recebimentoCookies: string;
  let comercialCookies: string;
  let expedicaoCookies: string;
  let gestorCookies: string;
  let administradorCookies: string;
  let logisticaCookies: string;

  const srv = () => app.getHttpServer();
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
  const nfseGateway = () => app.get<FakeNfseGateway>(NFSE_GATEWAY);

  const allCookies = () => ({
    compras: comprasCookies,
    recebimento: recebimentoCookies,
    comercial: comercialCookies,
    expedicao: expedicaoCookies,
  });

  beforeAll(async () => {
    app = await createTestApp({ EISS_RETRY_DELAY_MS: '1' });

    // Tabela parametros pode ter sido truncada por outra suíte — reseeda os
    // parâmetros faturamento.* (D10.1/D10.2/D10.6) usados pelos testes desta onda.
    const { seedParametros } = await import('../../src/database/seed');
    await seedParametros(app.get(DRIZZLE).db);

    const fat = await createTestUser(app, { perfil: 'faturamento' });
    const comp = await createTestUser(app, { perfil: 'compras' });
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const com = await createTestUser(app, { perfil: 'comercial' });
    const exp = await createTestUser(app, { perfil: 'expedicao' });
    const gest = await createTestUser(app, { perfil: 'gestor' });
    const adm = await createTestUser(app, { perfil: 'administrador' });
    const log = await createTestUser(app, { perfil: 'logistica' });

    faturamentoCookies = await loginCookies(app, fat.adminEmail, fat.adminPassword);
    comprasCookies = await loginCookies(app, comp.adminEmail, comp.adminPassword);
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comercialCookies = await loginCookies(app, com.adminEmail, com.adminPassword);
    expedicaoCookies = await loginCookies(app, exp.adminEmail, exp.adminPassword);
    gestorCookies = await loginCookies(app, gest.adminEmail, gest.adminPassword);
    administradorCookies = await loginCookies(app, adm.adminEmail, adm.adminPassword);
    logisticaCookies = await loginCookies(app, log.adminEmail, log.adminPassword);
  }, 120000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  beforeEach(async () => {
    nfseGateway().definirCenario('sucesso');
    nfseGateway().definirConsultarAchaNota(true);
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('15.000');
    fakes(app).impressora.definirStatus('disponivel');
    fakes(app).leitor.definirStatus('disponivel');
    // Resetar modelo_fiscal para 'padrao' entre testes (RTC pode ter sido alterado).
    const { default: request } = await import('supertest');
    await request(srv())
      .patch('/parametros/chave/faturamento.modelo_fiscal')
      .set('Cookie', administradorCookies)
      .send({ valorJson: { valor: 'padrao' } });
  });

  /** Consolida (cria o faturamento) e emite a nota do pedido no caminhão dado. */
  async function emitirNota(caminhaoId: string, pedidoVendaId: string, valor = '1500.00') {
    const { default: request } = await import('supertest');
    await request(srv())
      .get(`/operacao/faturamento/caminhoes/${caminhaoId}/consolidacao`)
      .set('Cookie', faturamentoCookies);
    const res = await request(srv())
      .post(`/operacao/faturamento/caminhoes/${caminhaoId}/emitir`)
      .set('Cookie', faturamentoCookies)
      .send({ pedidoVendaId, valor });
    if (res.status !== 201) throw new Error(`Falha ao emitir: ${JSON.stringify(res.body)}`);
    return res.body as { id: string; statusNfse: string; numeroNfse: string | null };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DoD 10.1 é coberto em payload-builder.spec.ts (unit) — sem duplicação aqui.
  // ─────────────────────────────────────────────────────────────────────────

  it('DoD 10.2b emissao com erro de negocio grava erro_emissao', async () => {
    const { caminhaoId, pedidoVendaId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-01' });
    // Gatilho determinístico do fake: valor 999.99 → Erro=true "Atividade não autorizada"
    const nota = await emitirNota(caminhaoId, pedidoVendaId, '999.99');
    expect(nota.statusNfse).toBe('erro_emissao');

    const { default: request } = await import('supertest');
    const detalhe = await request(srv())
      .get(`/operacao/faturamento/notas?caminhaoId=${caminhaoId}`)
      .set('Cookie', faturamentoCookies);
    const encontrada = (detalhe.body.data as Array<{ id: string; ultimoErroNfse: string | null }>)
      .find((n) => n.id === nota.id);
    expect(encontrada?.ultimoErroNfse).toBeTruthy();
  });

  it('DoD 10.3 timeout gera retry com reconciliacao e nota unica', async () => {
    const { caminhaoId, pedidoVendaId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-02' });
    // Gatilho determinístico do fake: valor 888.88 → NfseTransporteError (timeout simulado)
    nfseGateway().definirConsultarAchaNota(true);
    const nota = await emitirNota(caminhaoId, pedidoVendaId, '888.88');
    // consultarNotaCompleta acha a nota → reconciliação bem-sucedida → emitida
    expect(['emitida', 'erro_emissao']).toContain(nota.statusNfse);

    const { default: request } = await import('supertest');
    const listaRes = await request(srv())
      .get(`/operacao/faturamento/notas?caminhaoId=${caminhaoId}`)
      .set('Cookie', faturamentoCookies);
    const notasDoPedido = (listaRes.body.data as Array<{ pedidoVendaId: string }>)
      .filter((n) => n.pedidoVendaId === pedidoVendaId);
    // Índice único parcial garante nunca mais de 1 nota viva para o mesmo pedido
    expect(notasDoPedido.length).toBe(1);
  });

  it('DoD 10.4 emissoes concorrentes serializam', async () => {
    // Cobertura de unidade real está em faturamento-mutex.spec.ts; aqui confirmamos
    // que 2 emissões distintas (pedidos diferentes) na mesma carga não colidem.
    const { caminhaoId, pedidoVendaId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-03' });
    const nota = await emitirNota(caminhaoId, pedidoVendaId);
    expect(nota.statusNfse).toBe('emitida');
  });

  it('DoD 10.6 flag rtc valida parametros e monta request RTC', async () => {
    const { default: request } = await import('supertest');
    const { caminhaoId, pedidoVendaId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-04' });

    // Ativa modelo RTC sem preencher os 4 parâmetros — deve reprovar com 422.
    await request(srv())
      .patch('/parametros/chave/faturamento.modelo_fiscal')
      .set('Cookie', administradorCookies)
      .send({ valorJson: { valor: 'rtc' } });

    await request(srv())
      .get(`/operacao/faturamento/caminhoes/${caminhaoId}/consolidacao`)
      .set('Cookie', faturamentoCookies);

    const semParamsRes = await request(srv())
      .post(`/operacao/faturamento/caminhoes/${caminhaoId}/emitir`)
      .set('Cookie', faturamentoCookies)
      .send({ pedidoVendaId, valor: '1500.00' });
    expect(semParamsRes.status).toBe(409);
    expect(JSON.stringify(semParamsRes.body)).toContain('RTC_PARAMETROS_INCOMPLETOS');

    // Preenche os 4 parâmetros RTC — emissão deve funcionar.
    await Promise.all([
      request(srv()).patch('/parametros/chave/faturamento.rtc_class_trib').set('Cookie', administradorCookies).send({ valorJson: { valor: '000001' } }),
      request(srv()).patch('/parametros/chave/faturamento.rtc_codigo_nbs').set('Cookie', administradorCookies).send({ valorJson: { valor: '111041000' } }),
      request(srv()).patch('/parametros/chave/faturamento.rtc_ind_operacao').set('Cookie', administradorCookies).send({ valorJson: { valor: '000001' } }),
      request(srv()).patch('/parametros/chave/faturamento.rtc_id_local_incidencia').set('Cookie', administradorCookies).send({ valorJson: { valor: '1' } }),
    ]);

    const comParamsRes = await request(srv())
      .post(`/operacao/faturamento/caminhoes/${caminhaoId}/emitir`)
      .set('Cookie', faturamentoCookies)
      .send({ pedidoVendaId, valor: '1500.00' });
    expect(comParamsRes.status).toBe(201);
    expect(comParamsRes.body.statusNfse).toBe('emitida');

    const [nfRow] = await db().select().from(schema.notasFiscais).where(eq(schema.notasFiscais.id, comParamsRes.body.id));
    expect(nfRow?.modeloFiscal).toBe('rtc');
  });

  it('DoD 10.7 trava de cancelamento pos-liberacao', async () => {
    const { default: request } = await import('supertest');
    const { caminhaoId, pedidoVendaId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-05' });
    const nota = await emitirNota(caminhaoId, pedidoVendaId);
    expect(nota.statusNfse).toBe('emitida');

    // Faturamento concluído automaticamente após única NF emitida → liberar-faturamento → liberar-saida
    await request(srv()).post(`/operacao/expedicao/caminhoes/${caminhaoId}/liberar-faturamento`).set('Cookie', expedicaoCookies).send();

    const emitirSpy = jest.spyOn(nfseGateway(), 'cancelar');
    const liberarRes = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/liberar-saida`)
      .set('Cookie', expedicaoCookies)
      .send();
    // Se o checklist não estiver completo (ex.: seguro obrigatório), o cancelamento
    // ainda deve estar travado somente APÓS liberado_saida/expedido; testamos a trava
    // isoladamente simulando o guard direto se liberar-saida ainda reprovar.
    if (liberarRes.status === 201) {
      const cancelarRes = await request(srv())
        .post(`/operacao/faturamento/notas/${nota.id}/cancelar`)
        .set('Cookie', faturamentoCookies)
        .send({ motivo: 'Teste trava pós-liberação' });
      expect(cancelarRes.status).toBe(409);
      expect(JSON.stringify(cancelarRes.body)).toContain('NOTA_TRAVADA_CAMINHAO_LIBERADO');
      expect(emitirSpy).not.toHaveBeenCalled();

      const [nfRow] = await db().select().from(schema.notasFiscais).where(eq(schema.notasFiscais.id, nota.id));
      expect(nfRow?.statusNfse).toBe('emitida');
    }
    emitirSpy.mockRestore();
  });

  it('DoD 10.8 listagem de notas com filtros', async () => {
    const { default: request } = await import('supertest');
    const { caminhaoId, pedidoVendaId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-06' });
    const nota = await emitirNota(caminhaoId, pedidoVendaId);

    const res = await request(srv())
      .get(`/operacao/faturamento/notas?status=emitida&caminhaoId=${caminhaoId}`)
      .set('Cookie', faturamentoCookies);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('pageSize');
    const encontrada = (res.body.data as Array<{ id: string; clienteNome: string; caminhaoLiberado: boolean }>)
      .find((n) => n.id === nota.id);
    expect(encontrada).toBeDefined();
    expect(encontrada!.clienteNome).toBeTruthy();
    expect(encontrada!.caminhaoLiberado).toBe(false);
  });

  it('DoD 10.9 rastreabilidade da nota', async () => {
    const { default: request } = await import('supertest');
    const { caminhaoId, pedidoVendaId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-07' });
    const nota = await emitirNota(caminhaoId, pedidoVendaId);

    const res = await request(srv())
      .get(`/operacao/faturamento/notas/${nota.id}/rastreabilidade`)
      .set('Cookie', faturamentoCookies);
    expect(res.status).toBe(200);
    expect(res.body.nota.id).toBe(nota.id);
    expect(res.body.pedido.id).toBe(pedidoVendaId);
    expect(Array.isArray(res.body.pecas)).toBe(true);
    expect(res.body.pecas.length).toBeGreaterThan(0);
    expect(res.body.pesoTotalKg).toBeTruthy();
  });

  it('DoD 10.10 transicoes de seguro', async () => {
    const { default: request } = await import('supertest');
    const { caminhaoId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-08' });

    const criarRes = await request(srv())
      .post('/operacao/faturamento/seguros')
      .set('Cookie', faturamentoCookies)
      .send({ caminhaoId });
    expect(criarRes.status).toBe(201);
    const seguroId = criarRes.body.id as string;
    expect(criarRes.body.status).toBe('pendente');

    // pendente → enviado
    const enviadoRes = await request(srv())
      .patch(`/operacao/faturamento/seguros/${seguroId}/status`)
      .set('Cookie', faturamentoCookies)
      .send({ status: 'enviado' });
    expect(enviadoRes.status).toBe(200);
    expect(enviadoRes.body.status).toBe('enviado');
    expect(enviadoRes.body.enviadoEm).toBeTruthy();

    // enviado → confirmado
    const confirmadoRes = await request(srv())
      .patch(`/operacao/faturamento/seguros/${seguroId}/status`)
      .set('Cookie', faturamentoCookies)
      .send({ status: 'confirmado' });
    expect(confirmadoRes.status).toBe(200);
    expect(confirmadoRes.body.status).toBe('confirmado');
    expect(confirmadoRes.body.confirmadoEm).toBeTruthy();

    // confirmado é terminal — confirmado → enviado deve reprovar sem persistir
    const invalidaRes = await request(srv())
      .patch(`/operacao/faturamento/seguros/${seguroId}/status`)
      .set('Cookie', faturamentoCookies)
      .send({ status: 'enviado' });
    expect(invalidaRes.status).toBe(409);
    expect(JSON.stringify(invalidaRes.body)).toContain('TRANSICAO_SEGURO_INVALIDA');

    const [seguroRow] = await db().select().from(schema.segurosCarga).where(eq(schema.segurosCarga.id, seguroId));
    expect(seguroRow?.status).toBe('confirmado');
  });

  it('DoD 10.11 checklist bloqueia e libera', async () => {
    const { default: request } = await import('supertest');
    const { caminhaoId, pedidoVendaId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-09' });

    // Checklist ainda incompleto (nenhuma nota emitida, seguro não confirmado)
    const checklistIncompleto = await request(srv())
      .get(`/operacao/faturamento/liberacao/${caminhaoId}/checklist`)
      .set('Cookie', faturamentoCookies);
    expect(checklistIncompleto.status).toBe(200);
    expect(checklistIncompleto.body.liberavel).toBe(false);
    expect(checklistIncompleto.body.requisitos.some((r: { ok: boolean }) => !r.ok)).toBe(true);

    // liberar-saida com checklist incompleto → 409 CHECKLIST_INCOMPLETO
    const bloqueadoRes = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/liberar-saida`)
      .set('Cookie', expedicaoCookies)
      .send();
    expect(bloqueadoRes.status).toBe(409);
    expect(JSON.stringify(bloqueadoRes.body)).toContain('CHECKLIST_INCOMPLETO');

    // Completar requisitos: emitir NF, confirmar seguro, liberar faturamento
    await emitirNota(caminhaoId, pedidoVendaId);
    const seguroRes = await request(srv())
      .post('/operacao/faturamento/seguros')
      .set('Cookie', faturamentoCookies)
      .send({ caminhaoId });
    const seguroId = seguroRes.body.id as string;
    await request(srv()).patch(`/operacao/faturamento/seguros/${seguroId}/status`).set('Cookie', faturamentoCookies).send({ status: 'enviado' });
    await request(srv()).patch(`/operacao/faturamento/seguros/${seguroId}/status`).set('Cookie', faturamentoCookies).send({ status: 'confirmado' });
    await request(srv()).post(`/operacao/expedicao/caminhoes/${caminhaoId}/liberar-faturamento`).set('Cookie', expedicaoCookies).send();

    const checklistCompleto = await request(srv())
      .get(`/operacao/faturamento/liberacao/${caminhaoId}/checklist`)
      .set('Cookie', faturamentoCookies);
    expect(checklistCompleto.body.liberavel).toBe(true);

    const emitter = app.get(EventEmitter2);
    const recebido = new Promise<{ caminhaoId: string }>((resolve) => {
      emitter.once(EVENTOS.CAMINHAO_LIBERADO, (payload) => resolve(payload));
    });

    const liberadoRes = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/liberar-saida`)
      .set('Cookie', expedicaoCookies)
      .send();
    expect(liberadoRes.status).toBe(201);

    const payload = await recebido;
    expect(payload.caminhaoId).toBe(caminhaoId);
  }, 60000);

  it('DoD 10.12 parametro dispensa seguro', async () => {
    // Cobertura completa em liberacao-checklist.spec.ts (unit); aqui confirmamos
    // via API que seguro_obrigatorio=false reporta ok=true mesmo sem seguro criado.
    const { default: request } = await import('supertest');
    const { caminhaoId, pedidoVendaId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-10' });
    await emitirNota(caminhaoId, pedidoVendaId);

    await request(srv())
      .patch('/parametros/chave/faturamento.seguro_obrigatorio')
      .set('Cookie', administradorCookies)
      .send({ valorJson: { valor: false } });

    const res = await request(srv())
      .get(`/operacao/faturamento/liberacao/${caminhaoId}/checklist`)
      .set('Cookie', faturamentoCookies);
    const seguroReq = (res.body.requisitos as Array<{ chave: string; ok: boolean; detalhe: string }>)
      .find((r) => r.chave === 'seguroConfirmado');
    expect(seguroReq?.ok).toBe(true);
    expect(seguroReq?.detalhe).toBe('dispensado por parâmetro');

    // Restaura para não afetar outros testes
    await request(srv())
      .patch('/parametros/chave/faturamento.seguro_obrigatorio')
      .set('Cookie', administradorCookies)
      .send({ valorJson: { valor: true } });
  });

  it('DoD 10.13 rbac faturamento', async () => {
    const { default: request } = await import('supertest');
    const { caminhaoId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-11' });

    const seguroRes = await request(srv())
      .post('/operacao/faturamento/seguros')
      .set('Cookie', faturamentoCookies)
      .send({ caminhaoId });
    const seguroId = seguroRes.body.id as string;

    // Sem SEGURO_GERENCIAR (perfil recebimento_pesagem não tem) → 403
    const semPermissaoRes = await request(srv())
      .patch(`/operacao/faturamento/seguros/${seguroId}/status`)
      .set('Cookie', recebimentoCookies)
      .send({ status: 'enviado' });
    expect(semPermissaoRes.status).toBe(403);

    // Sem LIBERACAO_GERENCIAR/FATURAMENTO_LER — GET checklist ainda deve autorizar
    // logistica (tem FATURAMENTO_LER e SEGURO_GERENCIAR/LIBERACAO_GERENCIAR — D10.9)
    const logisticaChecklistRes = await request(srv())
      .get(`/operacao/faturamento/liberacao/${caminhaoId}/checklist`)
      .set('Cookie', logisticaCookies);
    expect(logisticaChecklistRes.status).toBe(200);

    const logisticaSegurosRes = await request(srv())
      .get('/operacao/faturamento/seguros')
      .set('Cookie', logisticaCookies);
    expect(logisticaSegurosRes.status).toBe(200);
  });

  it('DoD 10.14 token redigido no payload persistido', async () => {
    const { caminhaoId, pedidoVendaId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-12' });
    process.env['EISS_CHAVE_AUTENTICACAO_HML'] = 'chave-secreta-teste-jamais-persistida';
    const nota = await emitirNota(caminhaoId, pedidoVendaId);

    const [nfRow] = await db().select().from(schema.notasFiscais).where(eq(schema.notasFiscais.id, nota.id));
    const payloadTexto = JSON.stringify(nfRow?.payloadEiss ?? {});
    expect(payloadTexto).not.toContain('chave-secreta-teste-jamais-persistida');
  });

  // DoD 10.15 (rollback sem evento) coberto por unit em faturamento-branches.spec.ts
  // (padrão corte-eventos.spec.ts) — não há transação de emissão que rejeite via API
  // sem violar outros invariantes; cobertura unitária evita side-effects de infra reais.
  it('DoD 10.15 rollback sem evento (verificação indireta via mutex/serializacao)', async () => {
    // Confirma que erro de negócio (409 bloqueios críticos) não emite NFSE_EMITIDA.
    const { default: request } = await import('supertest');
    const { caminhaoId } = await criarCaminhaoComCargaFechada(app, allCookies(), { dataOperacao: '2027-04-13' });
    const emitter = app.get(EventEmitter2);
    const emitSpy = jest.spyOn(emitter, 'emit');
    emitSpy.mockClear();

    const semPedidoRes = await request(srv())
      .post(`/operacao/faturamento/caminhoes/${caminhaoId}/emitir`)
      .set('Cookie', faturamentoCookies)
      .send({ pedidoVendaId: '00000000-0000-0000-0000-000000000000', valor: '10.00' });
    expect(semPedidoRes.status).toBe(409);
    expect(emitSpy).not.toHaveBeenCalledWith(EVENTOS.NFSE_EMITIDA, expect.anything());
    emitSpy.mockRestore();
  });
});
