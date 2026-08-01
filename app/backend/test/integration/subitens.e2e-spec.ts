import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, criarOutroCliente, pesarPeca, fakes, type CenarioPesagem } from '../helpers/pesagem-fixtures';
import {
  iniciarCorte,
  adicionarSubitem,
  pesarSubitem,
  itemSaidaCanonicoCb,
  alinharPedidoItemComSaidaCorte,
  prepararTransformacaoComRegraTzA,
} from '../helpers/corte-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Subitens e2e (F4c — pesar/associar/redirecionar/sem-cobertura)', () => {
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

  async function cenario(dataOperacao: string): Promise<CenarioPesagem> {
    const base = await seedComercialBase(app, { fator: 1 });
    return montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao, quantidade: 10 },
    );
  }

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('6.000');
    fakes(app).impressora.definirStatus('disponivel');
  });

  it('pesar subitem ADR-009: indisponível → 409; sem motivo manual → 400; manual ok com snapshot', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-11-01');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const itemSaidaCbId = await itemSaidaCanonicoCb(app);
    const subId = await adicionarSubitem(app, corteCookies, transfId, itemSaidaCbId);

    fakes(app).balanca.definirStatus('indisponivel');
    const auto = await pesarSubitem(app, corteCookies, subId, { modoCaptura: 'automatico' });
    expect(auto.status).toBe(409);

    const semMotivo = await pesarSubitem(app, corteCookies, subId, { modoCaptura: 'manual_assistido', pesoManual: 6.0 });
    expect(semMotivo.status).toBe(400);

    const ok = await pesarSubitem(app, corteCookies, subId, { modoCaptura: 'manual_assistido', pesoManual: 6.0, motivo: 'dispositivo_indisponivel' });
    expect(ok.status).toBe(201);
    expect(ok.body.statusSubitem).toBe('pesado');
    expect(ok.body.capturaMeta.leitura_estavel).toBe(false);
    expect(ok.body.capturaMeta.motivo).toBe('dispositivo_indisponivel');
    expect(ok.body.capturaMeta.gateway_status.status).toBe('indisponivel');
  });

  it('associar subitem reclassificado consome unidade do item correto (não o item base da peça)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-11-02');

    // Emenda 7 / DoD 7.7: "item2" = JAC (saída TZ_A), não item inventado fora da regra
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const saidas = await prepararTransformacaoComRegraTzA(app, corteCookies, transfId);
    const item2Id = saidas.itemSaidaJacId; // reclassifica para JAC
    const itemBaseId = saidas.itemSaidaCbId; // "base" compatível com regra = CB

    const pedido2 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: item2Id,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });
    const pedidoBase = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: itemBaseId,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });

    const subId = await adicionarSubitem(app, corteCookies, transfId, item2Id);
    await pesarSubitem(app, corteCookies, subId);

    const incompat = await request(srv())
      .post(`/operacao/corte/subitens/${subId}/associar`)
      .set('Cookie', corteCookies)
      .send({ pedidoVendaItemId: pedidoBase.pedidoItemId });
    expect(incompat.status).toBe(409);

    const ok = await request(srv())
      .post(`/operacao/corte/subitens/${subId}/associar`)
      .set('Cookie', corteCookies)
      .send({ pedidoVendaItemId: pedido2.pedidoItemId });
    expect(ok.status).toBe(201);

    const item2Linha = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, pedido2.pedidoItemId))
      .then((r) => r[0]!);
    expect(item2Linha.quantidadeAtendida).toBe('1.000');

    const itemBaseLinha = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, pedidoBase.pedidoItemId))
      .then((r) => r[0]!);
    expect(itemBaseLinha.quantidadeAtendida).toBe('0.000');
  });

  it('redirecionar subitem: devolve saldo origem e consome destino', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-11-03');
    const itemSaidaCbId = await itemSaidaCanonicoCb(app);
    const pa = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, itemComercialId: itemSaidaCbId, dataOperacao: c.dataOperacao, quantidade: 2 });
    const pb = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: await criarOutroCliente(app), itemComercialId: itemSaidaCbId, dataOperacao: c.dataOperacao, quantidade: 2 });

    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, itemSaidaCbId);
    await pesarSubitem(app, corteCookies, subId);
    await alinharPedidoItemComSaidaCorte(app, pa.pedidoItemId, itemSaidaCbId);
    await request(srv()).post(`/operacao/corte/subitens/${subId}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: pa.pedidoItemId });

    const redir = await request(srv())
      .post(`/operacao/corte/subitens/${subId}/redirecionar`)
      .set('Cookie', corteCookies)
      .send({ pedidoVendaItemId: pb.pedidoItemId, motivo: 'cliente A reduziu pedido' });
    expect(redir.status).toBe(201);

    const itemA = await db().select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pa.pedidoItemId)).then((r) => r[0]!);
    const itemB = await db().select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pb.pedidoItemId)).then((r) => r[0]!);
    expect(itemA.quantidadeAtendida).toBe('0.000');
    expect(itemB.quantidadeAtendida).toBe('1.000');
  });

  it('sem cobertura: sobra sem motivo → 400; com motivo → em_sobra; divergência abre ocorrência', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-11-04');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const itemSaidaCbId = await itemSaidaCanonicoCb(app);
    const subId = await adicionarSubitem(app, corteCookies, transfId, itemSaidaCbId);
    await pesarSubitem(app, corteCookies, subId);

    const semMotivo = await request(srv()).post(`/operacao/corte/subitens/${subId}/sem-cobertura`).set('Cookie', corteCookies).send({ destino: 'sobra' });
    expect(semMotivo.status).toBe(400);

    const comMotivo = await request(srv()).post(`/operacao/corte/subitens/${subId}/sem-cobertura`).set('Cookie', corteCookies).send({ destino: 'sobra', motivo: 'sem pedido compatível' });
    expect(comMotivo.status).toBe(201);
    expect(comMotivo.body.statusSubitem).toBe('em_sobra');

    // Divergência cria uma ocorrência formal
    const sub2 = await adicionarSubitem(app, corteCookies, transfId, itemSaidaCbId);
    await pesarSubitem(app, corteCookies, sub2);
    const div = await request(srv()).post(`/operacao/corte/subitens/${sub2}/sem-cobertura`).set('Cookie', corteCookies).send({
      destino: 'divergencia',
      // Tipologia canônica pós-0013 (legado qualidade_divergente → outro).
      divergencia: { tipo: 'outro', descricao: 'osso exposto', acaoImediata: 'separar para análise' },
    });
    expect(div.status).toBe(201);

    const divs = await db().select().from(schema.divergenciasRecebimento).where(eq(schema.divergenciasRecebimento.recebimentoId, c.recebimentoId));
    expect(divs.some((d) => d.tipo === 'outro')).toBe(true);
  });
});
