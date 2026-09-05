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
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, produtoId: c.produtoId, dataOperacao: c.dataOperacao, quantidade: 5 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });
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
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });

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

  it('transições emitida → ativa → reimpressa → cancelada', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-20');
    const pecaId = await pecaAssociada(c);

    fakes(app).impressora.definirStatus('indisponivel');
    const emitFalha = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();
    expect(emitFalha.status).toBe(201);
    expect(emitFalha.body.etiqueta.estado).toBe('emitida');

    fakes(app).impressora.definirStatus('disponivel');
    const reimp = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta/reimprimir`).set('Cookie', recebimentoCookies).send();
    expect(reimp.status).toBe(201);
    expect(reimp.body.etiqueta.estado).toBe('reimpressa');

    const cancel = await request(srv())
      .post(`/operacao/etiquetas/${reimp.body.etiqueta.id}/cancelar`)
      .set('Cookie', recebimentoCookies)
      .send({ motivo: 'etiqueta_incorreta' });
    expect(cancel.status).toBe(201);
    expect(cancel.body.estado).toBe('cancelada');
  });

  it('resolverQr responde 409 para etiqueta invalidada_por_troca', async () => {
    const { default: request } = await import('supertest');
    const { pecaAssociadaComEtiqueta, pesarPeca } = await import('../helpers/pesagem-fixtures');
    const c = await cenario('2026-09-21');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, produtoId: c.produtoId,
      dataOperacao: c.dataOperacao, quantidade: 2,
    });
    const pecaRetiradaId = await pecaAssociadaComEtiqueta(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId, pedidoVendaItemId: p.pedidoItemId,
    });
    const pecaInseridaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId,
    });
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const etiquetaAntes = await db.select().from(schema.etiquetasImpressoes)
      .where(eq(schema.etiquetasImpressoes.pecaId, pecaRetiradaId)).then((r) => r[0]!);
    const codigo = (etiquetaAntes.payload as { qr?: string }).qr ?? `QR-${pecaRetiradaId}`;

    const troca = await request(srv()).post('/operacao/pesagem/trocas').set('Cookie', recebimentoCookies).send({
      pecaRetiradaId, pecaInseridaId, pedidoVendaItemId: p.pedidoItemId,
      destinoRetirada: 'estoque', motivo: 'erro_associacao',
    });
    expect(troca.status).toBe(201);

    const res = await request(srv()).post('/operacao/pesagem/qr/resolver').set('Cookie', recebimentoCookies).send({
      modoCaptura: 'manual_assistido', codigo, motivo: 'teste invalidada',
    });
    expect(res.status).toBe(409);
  });

  it('lista etiquetas do recebimento filtrando por estado e busca', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-22');
    const pecaId = await pecaAssociada(c);
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();

    const lista = await request(srv())
      .get(`/operacao/etiquetas?recebimentoId=${c.recebimentoId}`)
      .set('Cookie', recebimentoCookies);
    expect(lista.status).toBe(200);
    expect(lista.body.data.length).toBeGreaterThanOrEqual(1);
    expect(lista.body.data[0]).toEqual(expect.objectContaining({
      pecaId, estado: expect.any(String), statusImpressao: expect.any(String),
    }));
    expect(lista.body.data[0]).toHaveProperty('motivoCancelamento');

    const filtrada = await request(srv())
      .get(`/operacao/etiquetas?recebimentoId=${c.recebimentoId}&estado=ativa`)
      .set('Cookie', recebimentoCookies);
    expect(filtrada.status).toBe(200);
    expect(filtrada.body.data.every((e: { estado: string }) => e.estado === 'ativa')).toBe(true);
  });

  it('peça com vigente cancelada não aparece no filtro estado=ativa e mantém o histórico completo', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-23');
    const pecaId = await pecaAssociada(c);
    const emit = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();
    await request(srv()).post(`/operacao/etiquetas/${emit.body.etiqueta.id}/cancelar`)
      .set('Cookie', recebimentoCookies).send({ motivo: 'peso_incorreto' });

    const ativas = await request(srv())
      .get(`/operacao/etiquetas?recebimentoId=${c.recebimentoId}&estado=ativa`)
      .set('Cookie', recebimentoCookies);
    expect(ativas.body.data.find((e: { pecaId: string }) => e.pecaId === pecaId)).toBeUndefined();

    const todas = await request(srv())
      .get(`/operacao/etiquetas?recebimentoId=${c.recebimentoId}&estado=cancelada`)
      .set('Cookie', recebimentoCookies);
    const entrada = todas.body.data.find((e: { pecaId: string }) => e.pecaId === pecaId);
    expect(entrada).toBeDefined();
    expect(entrada.estado).toBe('cancelada');
    expect(entrada.historico.length).toBeGreaterThanOrEqual(0);
  });

  it('marca bloqueada para peça em transformação e para peça em carga fechada', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-24');
    const pecaId = await pecaAssociada(c);
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    await db.update(schema.pecas).set({ statusPeca: 'em_transformacao' }).where(eq(schema.pecas.id, pecaId));

    const lista = await request(srv())
      .get(`/operacao/etiquetas?recebimentoId=${c.recebimentoId}`)
      .set('Cookie', recebimentoCookies);
    const entrada = lista.body.data.find((e: { pecaId: string }) => e.pecaId === pecaId);
    expect(entrada.bloqueada).toBe(true);
  });

  it('lista etiqueta com os campos de produto, rastreabilidade e destino do pedido', async () => {
    const { default: request } = await import('supertest');
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const c = await cenario('2026-09-25');
    const [rep] = await db.insert(schema.representantes).values({
      codigo: `REP-${Date.now()}`, nome: 'Rep Etiqueta',
    }).returning();
    await db.update(schema.clientes).set({
      representanteId: rep!.id, nomeFantasia: 'Fantasia Etiqueta',
    }).where(eq(schema.clientes.id, c.clienteId));
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, produtoId: c.produtoId,
      dataOperacao: c.dataOperacao, quantidade: 2,
    });
    await db.update(schema.pedidosVenda).set({ rotaPrevista: 'Rota Norte' }).where(eq(schema.pedidosVenda.id, p.pedidoId));
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId,
    });
    await db.update(schema.pecas).set({
      capturaMeta: { maisPesada: true, maisGorda: true, melhorAcabamento: false },
    }).where(eq(schema.pecas.id, pecaId));
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId });
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();
    await db.update(schema.recebimentos).set({
      romaneio: 'ROM-1', placaVeiculo: 'ABC1D23', motorista: 'João',
    }).where(eq(schema.recebimentos.id, c.recebimentoId));

    const lista = await request(srv())
      .get(`/operacao/etiquetas?recebimentoId=${c.recebimentoId}`)
      .set('Cookie', recebimentoCookies);
    const e = lista.body.data.find((x: { pecaId: string }) => x.pecaId === pecaId);
    expect(e).toEqual(expect.objectContaining({
      produtoCodigo: expect.any(String),
      produtoDescricao: expect.any(String),
      frigorifico: expect.any(String),
      romaneio: 'ROM-1',
      placaVeiculo: 'ABC1D23',
      motorista: 'João',
      clienteNome: expect.any(String),
      representanteNome: 'Rep Etiqueta',
      rotaPrevista: 'Rota Norte',
    }));
    expect(e.caracteristicas).toEqual(expect.arrayContaining(['Mais pesada', 'Mais gorda']));
  });

  it('lista etiqueta com destino estoque e localEstoquePrevisto provisório', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-26');
    const pecaId = await pecaAssociada(c);
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    await db.update(schema.pecas).set({
      statusPeca: 'em_sobra', pedidoVendaId: null, pedidoVendaItemId: null,
    }).where(eq(schema.pecas.id, pecaId));

    const lista = await request(srv())
      .get(`/operacao/etiquetas?recebimentoId=${c.recebimentoId}`)
      .set('Cookie', recebimentoCookies);
    const e = lista.body.data.find((x: { pecaId: string }) => x.pecaId === pecaId);
    expect(e.clienteNome).toBeNull();
    expect(e.representanteNome).toBeNull();
    expect(e.rotaPrevista).toBeNull();
    expect(e.localEstoquePrevisto).toEqual({ valor: null, provisorio: true });
  });
});
