import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes, type CenarioPesagem } from '../helpers/pesagem-fixtures';
import {
  iniciarCorte,
  adicionarSubitem,
  pesarSubitem,
  itemSaidaCanonicoCb,
  alinharPedidoItemComSaidaCorte,
} from '../helpers/corte-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Reetiqueta de subitem e2e (F4c — RF-RT-04, best-effort)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;
  let corteCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    corteCookies = await loginCookies(app, corte.adminEmail, corte.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

  async function subitemAssociado(dataOp: string): Promise<{ subId: string; pecaId: string; c: CenarioPesagem }> {
    const { default: request } = await import('supertest');
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(app, { compras: comprasCookies, recebimento: recebimentoCookies }, base, { dataOperacao: dataOp, quantidade: 10 });
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('6.000');
    fakes(app).impressora.definirStatus('disponivel');
    const itemSaidaCbId = await itemSaidaCanonicoCb(app);
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, produtoId: itemSaidaCbId, dataOperacao: c.dataOperacao, quantidade: 5 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, itemSaidaCbId);
    await pesarSubitem(app, corteCookies, subId);
    await alinharPedidoItemComSaidaCorte(app, p.pedidoItemId, itemSaidaCbId);
    await request(srv()).post(`/operacao/corte/subitens/${subId}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: p.pedidoItemId });
    return { subId, pecaId, c };
  }

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).impressora.definirStatus('disponivel');
    fakes(app).leitor.definirStatus('disponivel');
  });

  it('emite etiqueta nova do subitem referenciando a peça original; QR resolve o subitem', async () => {
    const { default: request } = await import('supertest');
    const { subId, pecaId } = await subitemAssociado('2026-12-01');
    const emit = await request(srv()).post(`/operacao/corte/subitens/${subId}/etiqueta`).set('Cookie', corteCookies).send();
    expect(emit.status).toBe(201);
    expect(emit.body.etiqueta.statusImpressao).toBe('impressa');
    const codigo = emit.body.subitem.etiquetaAtual as string;
    expect(codigo).toContain('QR-SUB-');
    expect(emit.body.etiqueta.payload.pecaOrigemId).toBe(pecaId);

    fakes(app).leitor.definirStatus('indisponivel');
    const res = await request(srv()).post('/operacao/corte/subitens/qr/resolver').set('Cookie', corteCookies).send({
      modoCaptura: 'manual_assistido',
      codigo,
      motivo: 'leitor sem energia',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(subId);
  });

  it('impressora indisponível → falha_impressao sem travar; reimpressão auditada', async () => {
    const { default: request } = await import('supertest');
    const { subId } = await subitemAssociado('2026-12-02');
    fakes(app).impressora.definirStatus('indisponivel');

    const emit = await request(srv()).post(`/operacao/corte/subitens/${subId}/etiqueta`).set('Cookie', corteCookies).send();
    expect(emit.status).toBe(201);
    expect(emit.body.etiqueta.statusImpressao).toBe('falha_impressao');
    expect(emit.body.subitem.etiquetaAtual).toBeTruthy();

    fakes(app).impressora.definirStatus('disponivel');
    const re = await request(srv()).post(`/operacao/corte/subitens/${subId}/etiqueta/reimprimir`).set('Cookie', corteCookies).send();
    expect(re.status).toBe(201);
    expect(re.body.etiqueta.reimpressao).toBe(true);

    const linhas = await db().select().from(schema.etiquetasImpressoes).where(eq(schema.etiquetasImpressoes.subitemId, subId));
    expect(linhas.length).toBe(2);
  });

  it('QR de subitem inválido → 404', async () => {
    const { default: request } = await import('supertest');
    const res = await request(srv()).post('/operacao/corte/subitens/qr/resolver').set('Cookie', corteCookies).send({
      modoCaptura: 'manual_assistido',
      codigo: 'QR-SUB-019ea000-0000-7000-8000-0000000000ff',
      motivo: 'teste',
    });
    expect(res.status).toBe(404);
  });
});
