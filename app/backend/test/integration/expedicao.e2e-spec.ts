import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, criarOutroCliente, pesarPeca, fakes, type CenarioPesagem } from '../helpers/pesagem-fixtures';
import {
  criarCaminhao, abrirCarga, vincularPedido, adicionarPecaNaCarga,
  adicionarSubitemNaCarga, iniciarConferencia, concluirConferencia, fecharCaminhao,
} from '../helpers/expedicao-fixtures';
import {
  iniciarCorte,
  subitemCompleto,
  itemSaidaCanonicoCb,
  alinharPedidoItemComSaidaCorte,
} from '../helpers/corte-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Expedicao e2e (F5)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;
  let corteCookies: string;
  let expedicaoCookies: string;
  let gestorCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    const expedicao = await createTestUser(app, { perfil: 'expedicao' });
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    corteCookies = await loginCookies(app, corte.adminEmail, corte.adminPassword);
    expedicaoCookies = await loginCookies(app, expedicao.adminEmail, expedicao.adminPassword);
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

  async function cenario(dataOperacao: string, quantidade = 10): Promise<CenarioPesagem> {
    const base = await seedComercialBase(app, { fator: 1 });
    return montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao, quantidade },
    );
  }

  /** Cria uma peca 'associada' + com etiqueta (elegivel para carga). */
  async function pecaElegivel(c: CenarioPesagem, pedidoItemId: string): Promise<string> {
    const { default: request } = await import('supertest');
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId,
      itemComercialBaseId: c.itemComercialId,
    });
    await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: pedidoItemId });
    await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`)
      .set('Cookie', recebimentoCookies)
      .send();
    return pecaId;
  }

  /** Cria um subitem 'associado' + com etiqueta (elegivel para carga). */
  async function subitemElegivel(
    c: CenarioPesagem,
    pecaId: string,
    pedidoItemId: string,
  ): Promise<string> {
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    fakes(app).balanca.definirPeso('6.000');
    return subitemCompleto(app, corteCookies, transfId, c.itemComercialId, pedidoItemId);
  }

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.500');
    fakes(app).impressora.definirStatus('disponivel');
    fakes(app).leitor.definirStatus('disponivel');
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // 1. Ciclo de status (planejado -> em_carga -> em_conferencia -> fechado)
  // ──────────────────────────────────────────────────────────────────────────────
  it('ciclo completo: planejado -> em_carga -> em_conferencia -> fechado', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-01');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${pecaId}`);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);

    // Verificar em_carga
    const detalhe1 = await request(srv()).get(`/operacao/expedicao/caminhoes/${caminhaoId}`).set('Cookie', expedicaoCookies);
    expect(detalhe1.body.caminhao.statusCaminhao).toBe('em_carga');

    await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);

    // Verificar em_conferencia
    const detalhe2 = await request(srv()).get(`/operacao/expedicao/caminhoes/${caminhaoId}`).set('Cookie', expedicaoCookies);
    expect(detalhe2.body.caminhao.statusCaminhao).toBe('em_conferencia');

    // Conferir item
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
    await concluirConferencia(app, expedicaoCookies, caminhaoId);
    await fecharCaminhao(app, expedicaoCookies, caminhaoId);

    // Verificar fechado
    const detalhe3 = await request(srv()).get(`/operacao/expedicao/caminhoes/${caminhaoId}`).set('Cookie', expedicaoCookies);
    expect(detalhe3.body.caminhao.statusCaminhao).toBe('fechado');
  }, 60000);

  // ──────────────────────────────────────────────────────────────────────────────
  // 2. Transicao invalida -> 409
  // ──────────────────────────────────────────────────────────────────────────────
  it('transicao invalida (planejado -> em_conferencia) retorna 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-02');
    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    // Tentar iniciar conferencia sem abrir carga
    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/iniciar`)
      .set('Cookie', expedicaoCookies)
      .send();
    expect(res.status).toBe(409);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // 3. Expedicao aberta = mutavel; fechada = bloqueada
  // ──────────────────────────────────────────────────────────────────────────────
  it('mutacao pos-fechamento retorna 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-03');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${pecaId}`);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
    await concluirConferencia(app, expedicaoCookies, caminhaoId);
    await fecharCaminhao(app, expedicaoCookies, caminhaoId);

    // Tentar adicionar item apos fechamento
    const peca2Id = await pecaElegivel(c, p.pedidoItemId);
    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', id: peca2Id });
    expect(res.status).toBe(409);
  }, 60000);

  // ──────────────────────────────────────────────────────────────────────────────
  // 4. Elegibilidade: peca transformada -> 409; sem etiqueta -> 409
  // ──────────────────────────────────────────────────────────────────────────────
  it('peca em_transformacao nao e elegivel (409)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-04');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId,
    });
    // Associar para prosseguir, depois cortar (status -> em_transformacao)
    await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: p.pedidoItemId });
    await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`)
      .set('Cookie', recebimentoCookies)
      .send();
    await iniciarCorte(app, corteCookies, pecaId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', id: pecaId });
    expect(res.status).toBe(409);
    const msg = typeof res.body.message === 'string' ? res.body.message : res.body.message?.message ?? '';
    expect(msg).toMatch(/eleg[ií]vel/i);
  });

  it('peca sem etiqueta nao e elegivel (409)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-05');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId,
    });
    // Associar sem etiquetar
    await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: p.pedidoItemId });
    // Peca agora esta 'associada' mas sem etiqueta

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', id: pecaId });
    expect(res.status).toBe(409);
    const msg = typeof res.body.message === 'string' ? res.body.message : res.body.message?.message ?? '';
    expect(msg).toMatch(/etiqueta/i);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // 5. Entrada idempotente (mesmo caminhao)
  // ──────────────────────────────────────────────────────────────────────────────
  it('adicionar mesma peca duas vezes no mesmo caminhao e idempotente', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-06');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const res1 = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', id: pecaId });
    expect(res1.status).toBe(201);

    const res2 = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', id: pecaId });
    expect(res2.status).toBe(201);
    expect(res2.body.id).toBe(res1.body.id); // Mesmo registro retornado
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // 6. Item ja em carga de OUTRO caminhao -> 409
  // ──────────────────────────────────────────────────────────────────────────────
  it('peca em outro caminhao retorna 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-07');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);

    const caminhao1 = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao, placa: 'CAM-0001' });
    const caminhao2 = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao, placa: 'CAM-0002' });
    await abrirCarga(app, expedicaoCookies, caminhao1);
    await abrirCarga(app, expedicaoCookies, caminhao2);

    await adicionarPecaNaCarga(app, expedicaoCookies, caminhao1, pecaId);

    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhao2}/itens`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', id: pecaId });
    expect(res.status).toBe(409);
    const msg = typeof res.body.message === 'string' ? res.body.message : res.body.message?.message ?? '';
    expect(msg).toMatch(/outra carga/i);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // 7. Transferencia de subitem entra no historico
  // ──────────────────────────────────────────────────────────────────────────────
  it('transferencia gera registro no historico de associacoes', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-08');
    const p1 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const p2 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: await criarOutroCliente(app), itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p1.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p1.pedidoId);
    await vincularPedido(app, expedicaoCookies, caminhaoId, p2.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const cargaItemId = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);

    // Transferir para pedido 2
    const res = await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItemId}/transferir`)
      .set('Cookie', expedicaoCookies)
      .send({ pedidoVendaItemDestinoId: p2.pedidoItemId, motivo: 'Redistribuicao operacional' });
    expect(res.status).toBe(201);

    // Verificar historico
    const historico = await db()
      .select()
      .from(schema.associacoesPecaHistorico)
      .where(eq(schema.associacoesPecaHistorico.pecaId, pecaId));
    expect(historico.length).toBeGreaterThanOrEqual(1);
    const registro = historico.find((h) => h.acao === 'redirecionar');
    expect(registro).toBeDefined();
    expect(registro!.pedidoOrigemId).toBe(p1.pedidoId);
    expect(registro!.pedidoDestinoId).toBe(p2.pedidoId);
  }, 60000);

  // ──────────────────────────────────────────────────────────────────────────────
  // 8. Transferencia aberta OK / fechada -> 409; incompativel -> 409; completo -> 409
  // ──────────────────────────────────────────────────────────────────────────────
  it('transferencia com expedicao fechada retorna 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-09');
    const p1 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const p2 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: await criarOutroCliente(app), itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p1.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${pecaId}`);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p1.pedidoId);
    await vincularPedido(app, expedicaoCookies, caminhaoId, p2.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const cargaItemId = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);

    // Fechar
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
    await concluirConferencia(app, expedicaoCookies, caminhaoId);
    await fecharCaminhao(app, expedicaoCookies, caminhaoId);

    // Transferir pos-fechamento
    const res = await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItemId}/transferir`)
      .set('Cookie', expedicaoCookies)
      .send({ pedidoVendaItemDestinoId: p2.pedidoItemId, motivo: 'tentativa' });
    expect(res.status).toBe(409);
  }, 60000);

  it('transferencia para item comercial incompativel retorna 409', async () => {
    const { default: request } = await import('supertest');
    // Dois cenarios com items comerciais DIFERENTES
    const base1 = await seedComercialBase(app, { fator: 1 });
    const base2 = await seedComercialBase(app, { fator: 1 });
    const c1 = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base1,
      { dataOperacao: '2026-12-10', quantidade: 5 },
    );
    const c2 = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base2,
      { dataOperacao: '2026-12-16', quantidade: 5 },
    );

    const p1 = await criarPedido(app, comercialCookies, {
      compraId: c1.compraId, clienteId: c1.clienteId, itemComercialId: c1.itemComercialId,
      dataOperacao: c1.dataOperacao, quantidade: 5,
    });
    const p2 = await criarPedido(app, comercialCookies, {
      compraId: c2.compraId, clienteId: c2.clienteId, itemComercialId: c2.itemComercialId,
      dataOperacao: c2.dataOperacao, quantidade: 5,
    });

    const pecaId = await pecaElegivel(c1, p1.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c1.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const cargaItemId = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);

    const res = await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItemId}/transferir`)
      .set('Cookie', expedicaoCookies)
      .send({ pedidoVendaItemDestinoId: p2.pedidoItemId, motivo: 'tentativa' });
    expect(res.status).toBe(409);
  });

  it('transferencia para pedido ja completo retorna 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-11');
    // Pedido com quantidade 1
    const p1 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const p2 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: await criarOutroCliente(app), itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 1,
    });
    const peca1Id = await pecaElegivel(c, p1.pedidoItemId);
    const peca2Id = await pecaElegivel(c, p2.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const cargaItem1Id = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, peca1Id);
    await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, peca2Id);

    // p2 ja tem atendida=1 (peca2 foi associada a ela). Transferir peca1 para p2 deve falhar.
    const res = await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItem1Id}/transferir`)
      .set('Cookie', expedicaoCookies)
      .send({ pedidoVendaItemDestinoId: p2.pedidoItemId, motivo: 'tentativa' });
    expect(res.status).toBe(409);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // 9. Fechar congela; fechar idempotente
  // ──────────────────────────────────────────────────────────────────────────────
  it('fechar idempotente (segunda chamada retorna mesmo status)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-12');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${pecaId}`);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
    await concluirConferencia(app, expedicaoCookies, caminhaoId);
    await fecharCaminhao(app, expedicaoCookies, caminhaoId);

    // Segunda chamada idempotente
    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/fechar`)
      .set('Cookie', expedicaoCookies)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.statusCaminhao).toBe('fechado');
  }, 60000);

  // ──────────────────────────────────────────────────────────────────────────────
  // 10. Reabrir so com EXPEDICAO_REABRIR (403 sem permissao)
  // ──────────────────────────────────────────────────────────────────────────────
  it('reabrir sem EXPEDICAO_REABRIR retorna 403', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-13');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${pecaId}`);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
    await concluirConferencia(app, expedicaoCookies, caminhaoId);
    await fecharCaminhao(app, expedicaoCookies, caminhaoId);

    // Perfil 'expedicao' NAO tem EXPEDICAO_REABRIR
    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/reabrir`)
      .set('Cookie', expedicaoCookies)
      .send({ justificativa: 'Teste reabertura' });
    expect(res.status).toBe(403);
  }, 60000);

  it('reabrir com EXPEDICAO_REABRIR (gestor) retorna em_carga', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-14');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${pecaId}`);

    const caminhaoId = await criarCaminhao(app, gestorCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, gestorCookies, caminhaoId, p.pedidoId);
    await abrirCarga(app, gestorCookies, caminhaoId);
    await adicionarPecaNaCarga(app, gestorCookies, caminhaoId, pecaId);
    await iniciarConferencia(app, gestorCookies, caminhaoId);
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', gestorCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
    await concluirConferencia(app, gestorCookies, caminhaoId);
    await fecharCaminhao(app, gestorCookies, caminhaoId);

    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/reabrir`)
      .set('Cookie', gestorCookies)
      .send({ justificativa: 'Necessidade de alterar carga' });
    expect(res.status).toBe(201);
    expect(res.body.statusCaminhao).toBe('em_carga');
  }, 60000);

  // ──────────────────────────────────────────────────────────────────────────────
  // 11. Romaneio consolidado
  // ──────────────────────────────────────────────────────────────────────────────
  it('romaneio retorna previsto e carregado por pedido', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-15');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 3,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);

    const res = await request(srv())
      .get(`/operacao/expedicao/caminhoes/${caminhaoId}/romaneio`)
      .set('Cookie', expedicaoCookies);
    expect(res.status).toBe(200);
    expect(res.body.pedidos).toHaveLength(1);
    expect(res.body.pedidos[0].previsto).toBe(3);
    expect(res.body.pedidos[0].carregado).toBe(1);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: subitem na carga
  // ──────────────────────────────────────────────────────────────────────────────
  it('subitem elegivel entra na carga com sucesso', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-17');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    // Peça pesada + associada + etiquetada, depois cortada -> subitem completo
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId,
    });
    await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: p.pedidoItemId });

    const subId = await subitemElegivel(c, pecaId, p.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);

    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'subitem', id: subId });
    expect(res.status).toBe(201);
    expect(res.body.subitemId).toBe(subId);
    expect(res.body.tipoOrigem).toBe('subitem');
  });

  it('subitem sem etiqueta nao e elegivel (409)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-18');
    // Emenda 7.1: saída CB + alinhar — 409 da carga prova ausência de etiqueta
    const itemSaidaCbId = await itemSaidaCanonicoCb(app);
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: itemSaidaCbId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId,
    });
    await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: p.pedidoItemId });

    // Cortar e criar subitem SEM etiqueta (pesado + associado mas sem emitir etiqueta)
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    fakes(app).balanca.definirPeso('6.000');
    const { adicionarSubitem: addSub, pesarSubitem: pesarSub } = await import('../helpers/corte-fixtures');
    const subId = await addSub(app, corteCookies, transfId, itemSaidaCbId);
    await pesarSub(app, corteCookies, subId);
    await alinharPedidoItemComSaidaCorte(app, p.pedidoItemId, itemSaidaCbId);
    await request(srv())
      .post(`/operacao/corte/subitens/${subId}/associar`)
      .set('Cookie', corteCookies)
      .send({ pedidoVendaItemId: p.pedidoItemId });
    // subitem esta 'associado' mas SEM etiqueta_atual

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'subitem', id: subId });
    expect(res.status).toBe(409);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: remover item da carga
  // ──────────────────────────────────────────────────────────────────────────────
  it('remover item da carga devolve saldo', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-19');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 2,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const cargaItemId = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);

    // Verificar saldo atendido antes
    const antes = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, p.pedidoItemId))
      .then((r) => r[0]!);
    expect(antes.quantidadeAtendida).toBe('1.000');

    // Remover
    const res = await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItemId}/remover`)
      .set('Cookie', expedicaoCookies)
      .send({ motivo: 'Peca danificada' });
    expect(res.status).toBe(201);
    expect(res.body.statusCargaItem).toBe('removido');

    // Verificar saldo devolvido
    const depois = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, p.pedidoItemId))
      .then((r) => r[0]!);
    expect(depois.quantidadeAtendida).toBe('0.000');
  });

  it('remover item de carga fechada retorna 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-20');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${pecaId}`);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const cargaItemId = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
    await concluirConferencia(app, expedicaoCookies, caminhaoId);
    await fecharCaminhao(app, expedicaoCookies, caminhaoId);

    const res = await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItemId}/remover`)
      .set('Cookie', expedicaoCookies)
      .send({ motivo: 'tentativa' });
    expect(res.status).toBe(409);
  }, 60000);

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: fechar com faltas (forcado=true)
  // ──────────────────────────────────────────────────────────────────────────────
  it('fechar com faltas sem forcado retorna 409; com forcado=true e justificativa retorna 201', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-21');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const peca1 = await pecaElegivel(c, p.pedidoItemId);
    const peca2 = await pecaElegivel(c, p.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${peca1}`);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, peca1);
    await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, peca2);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);
    // Conferir so peca1 (peca2 ficara como falta)
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
    await concluirConferencia(app, expedicaoCookies, caminhaoId);

    // Fechar sem forcado — deve rejeitar por causa das faltas
    const sem = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/fechar`)
      .set('Cookie', expedicaoCookies)
      .send({});
    expect(sem.status).toBe(409);

    // Fechar com forcado + justificativa
    const com = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/fechar`)
      .set('Cookie', expedicaoCookies)
      .send({ forcado: true, justificativa: 'Urgencia operacional' });
    expect(com.status).toBe(201);
    expect(com.body.statusCaminhao).toBe('fechado');
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: transferencia para o mesmo pedido item -> 409
  // ──────────────────────────────────────────────────────────────────────────────
  it('transferencia para o mesmo pedido item retorna 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-22');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const cargaItemId = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);

    // Tentar transferir para o MESMO pedido item
    const res = await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItemId}/transferir`)
      .set('Cookie', expedicaoCookies)
      .send({ pedidoVendaItemDestinoId: p.pedidoItemId, motivo: 'teste' });
    expect(res.status).toBe(409);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: transferencia de subitem entre pedidos
  // ──────────────────────────────────────────────────────────────────────────────
  it('transferencia de subitem entre pedidos funciona', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-23');
    // Emenda 7.3: p1 e p2 na saída CB — transfer 201 prova redistribuição (não incompatibilidade de item)
    const itemSaidaCbId = await itemSaidaCanonicoCb(app);
    const p1 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: itemSaidaCbId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const p2 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: await criarOutroCliente(app), itemComercialId: itemSaidaCbId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    await alinharPedidoItemComSaidaCorte(app, p1.pedidoItemId, itemSaidaCbId);
    await alinharPedidoItemComSaidaCorte(app, p2.pedidoItemId, itemSaidaCbId);
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId,
    });
    await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: p1.pedidoItemId });

    const subId = await subitemElegivel(c, pecaId, p1.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p1.pedidoId);
    await vincularPedido(app, expedicaoCookies, caminhaoId, p2.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const cargaItemId = await adicionarSubitemNaCarga(app, expedicaoCookies, caminhaoId, subId);

    const res = await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItemId}/transferir`)
      .set('Cookie', expedicaoCookies)
      .send({ pedidoVendaItemDestinoId: p2.pedidoItemId, motivo: 'Redistribuicao' });
    expect(res.status).toBe(201);
    expect(res.body.pedidoVendaItemId).toBe(p2.pedidoItemId);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: listar caminhoes por data
  // ──────────────────────────────────────────────────────────────────────────────
  it('listar caminhoes por data retorna os criados', async () => {
    const { default: request } = await import('supertest');
    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: '2026-12-24' });
    const res = await request(srv())
      .get('/operacao/expedicao/caminhoes')
      .query({ dataOperacao: '2026-12-24' })
      .set('Cookie', expedicaoCookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((c: { id: string }) => c.id === caminhaoId)).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: abrir carga de caminhao ja em_carga -> 409
  // ──────────────────────────────────────────────────────────────────────────────
  it('abrir carga de caminhao ja em_carga retorna 409', async () => {
    const { default: request } = await import('supertest');
    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: '2026-12-25' });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    // Tentar abrir novamente
    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/abrir-carga`)
      .set('Cookie', expedicaoCookies)
      .send();
    expect(res.status).toBe(409);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: vincular pedido inexistente -> 404
  // ──────────────────────────────────────────────────────────────────────────────
  it('vincular pedido inexistente retorna 404', async () => {
    const { default: request } = await import('supertest');
    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: '2026-12-26' });
    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/pedidos`)
      .set('Cookie', expedicaoCookies)
      .send({ pedidoVendaId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: vincular pedido idempotente
  // ──────────────────────────────────────────────────────────────────────────────
  it('vincular mesmo pedido duas vezes e idempotente', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-27');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, p.pedidoId);

    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/pedidos`)
      .set('Cookie', expedicaoCookies)
      .send({ pedidoVendaId: p.pedidoId });
    expect(res.status).toBe(201); // idempotente, retorna o existente
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: remocao idempotente (item ja removido)
  // ──────────────────────────────────────────────────────────────────────────────
  it('remocao idempotente de item ja removido', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-28');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const cargaItemId = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);

    // Primeira remocao
    await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItemId}/remover`)
      .set('Cookie', expedicaoCookies)
      .send({ motivo: 'Peca errada' });

    // Segunda remocao (idempotente)
    const res = await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItemId}/remover`)
      .set('Cookie', expedicaoCookies)
      .send({ motivo: 'Repetido' });
    expect(res.status).toBe(201);
    expect(res.body.statusCargaItem).toBe('removido');
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: transferencia de item removido -> 409
  // ──────────────────────────────────────────────────────────────────────────────
  it('transferencia de item removido retorna 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-29');
    const p1 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const p2 = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: await criarOutroCliente(app), itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p1.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const cargaItemId = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);

    // Remover primeiro
    await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItemId}/remover`)
      .set('Cookie', expedicaoCookies)
      .send({ motivo: 'troca' });

    // Tentar transferir
    const res = await request(srv())
      .post(`/operacao/expedicao/itens/${cargaItemId}/transferir`)
      .set('Cookie', expedicaoCookies)
      .send({ pedidoVendaItemDestinoId: p2.pedidoItemId, motivo: 'tentativa' });
    expect(res.status).toBe(409);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Branch coverage: elegibilidade peca sem pedidoVendaId
  // ──────────────────────────────────────────────────────────────────────────────
  it('peca pesada (sem associacao) nao e elegivel (409)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-12-30');
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId,
    });
    // peca em status 'pesada' (sem associacao) = sem pedido, sem etiqueta

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', id: pecaId });
    expect(res.status).toBe(409);
  });
});
