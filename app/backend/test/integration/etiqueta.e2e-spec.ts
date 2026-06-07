import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes, type CenarioPesagem } from '../helpers/pesagem-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Etiqueta + leitura QR e2e (RF-PS-23/24, ADR-009, REFINO 1)', () => {
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

  async function cenario(dataOperacao: string): Promise<CenarioPesagem> {
    const base = await seedComercialBase(app, { fator: 1 });
    return montarCenarioPesagem(app, { compras: comprasCookies, recebimento: recebimentoCookies }, base, { dataOperacao, quantidade: 10 });
  }

  async function pecaAssociada(c: CenarioPesagem): Promise<string> {
    const { default: request } = await import('supertest');
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId, dataOperacao: c.dataOperacao, quantidade: 5 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId });
    return pecaId;
  }

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).impressora.definirStatus('disponivel');
    fakes(app).leitor.definirStatus('disponivel');
  });

  it('etiqueta só pode ser emitida após a confirmação (409 antes de associar)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-01');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });

    const res = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();
    expect(res.status).toBe(409);
  });

  it('impressora disponível → emite etiqueta impressa e atribui QR à peça', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-02');
    const pecaId = await pecaAssociada(c);

    const res = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();
    expect(res.status).toBe(201);
    expect(res.body.etiqueta.statusImpressao).toBe('impressa');
    expect(res.body.peca.etiquetaAtual).toBeTruthy();
  });

  it('REFINO 1 — impressora indisponível: etiqueta lógica avança, impressão = falha_impressao (não trava)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-03');
    const pecaId = await pecaAssociada(c);
    fakes(app).impressora.definirStatus('indisponivel');

    const res = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();
    expect(res.status).toBe(201); // não trava o fluxo
    expect(res.body.etiqueta.statusImpressao).toBe('falha_impressao');
    expect(res.body.peca.etiquetaAtual).toBeTruthy(); // QR atribuído mesmo assim
  });

  it('reimpressão é auditada (linha reimpressao=true)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-04');
    const pecaId = await pecaAssociada(c);
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();

    const re = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta/reimprimir`).set('Cookie', recebimentoCookies).send();
    expect(re.status).toBe(201);
    expect(re.body.etiqueta.reimpressao).toBe(true);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const linhas = await db.select().from(schema.etiquetasImpressoes).where(eq(schema.etiquetasImpressoes.pecaId, pecaId));
    expect(linhas.length).toBe(2);
    expect(linhas.some((l) => l.reimpressao)).toBe(true);
  });

  it('QR digitado manualmente resolve a peça real (leitor indisponível → caminho manual)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-05');
    const pecaId = await pecaAssociada(c);
    const emitir = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();
    const codigo = emitir.body.peca.etiquetaAtual as string;
    fakes(app).leitor.definirStatus('indisponivel');

    const res = await request(srv()).post('/operacao/pesagem/qr/resolver').set('Cookie', recebimentoCookies).send({
      modoCaptura: 'manual_assistido',
      codigo,
      motivo: 'leitor sem energia',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(pecaId);
  });

  it('QR inválido → erro explícito (sem inventar vínculo)', async () => {
    const { default: request } = await import('supertest');
    const res = await request(srv()).post('/operacao/pesagem/qr/resolver').set('Cookie', recebimentoCookies).send({
      modoCaptura: 'manual_assistido',
      codigo: 'QR-inexistente-123',
      motivo: 'teste',
    });
    expect(res.status).toBe(404);
  });

  it('QR automático lê do gateway e resolve a peça', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-06');
    const pecaId = await pecaAssociada(c);
    const emitir = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();
    const codigo = emitir.body.peca.etiquetaAtual as string;
    fakes(app).leitor.definirStatus('disponivel');
    fakes(app).leitor.definirCodigo(codigo);

    const res = await request(srv()).post('/operacao/pesagem/qr/resolver').set('Cookie', recebimentoCookies).send({ modoCaptura: 'automatico' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(pecaId);
  });

  it('emitir etiqueta de peça inexistente → 404; reimprimir sem etiqueta emitida → 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-07');
    const fake = '019ea000-0000-7000-8000-0000000000bb';
    const emit404 = await request(srv()).post(`/operacao/pesagem/pecas/${fake}/etiqueta`).set('Cookie', recebimentoCookies).send();
    expect(emit404.status).toBe(404);

    const pecaId = await pecaAssociada(c);
    const reSemEmitir = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta/reimprimir`).set('Cookie', recebimentoCookies).send();
    expect(reSemEmitir.status).toBe(409); // ainda não emitiu a primeira
  });

  it('leitura manual de QR sem código → 400 (DTO)', async () => {
    const { default: request } = await import('supertest');
    const res = await request(srv()).post('/operacao/pesagem/qr/resolver').set('Cookie', recebimentoCookies).send({ modoCaptura: 'manual_assistido' });
    expect(res.status).toBe(400);
  });

  it('leitura manual de QR sem permissão LEITURA_MANUAL → 403', async () => {
    const { default: request } = await import('supertest');
    const res = await request(srv()).post('/operacao/pesagem/qr/resolver').set('Cookie', comercialCookies).send({
      modoCaptura: 'manual_assistido',
      codigo: 'QR-qualquer',
      motivo: 'teste',
    });
    expect(res.status).toBe(403);
  });
});
