import { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada } from '../helpers/comercial-fixtures';
import { PedidosService } from '../../src/modules/comercial/pedidos/pedidos.service';

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Task 6 — AD-03 (unicidade do pedido aberto) e D31 (herança representante/rota).
 */
describe('pedidos-onda4 (AD-03 unicidade + D31 herança)', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let service: PedidosService;
  let usuarioId: string;
  let dtoBase: {
    compraProgramadaId: string;
    clienteId: string;
    dataOperacao: string;
    salvarComoRascunho: boolean;
    itens: Array<{ produtoId: string; quantidadePedida: number }>;
  };
  let ctx: {
    clienteComRotaId: string;
    clienteSemRotaId: string;
    representanteId: string;
    nomeRepresentante: string;
    nomeRotaDoCliente: string;
    rotaDesvioId: string;
  };

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    service = app.get(PedidosService);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const [usuario] = await db.select().from(schema.usuarios).limit(1);
    if (!usuario) throw new Error('Nenhum usuário seed disponível para o teste');
    usuarioId = usuario.id;

    const base = await seedComercialBase(app, { fator: 1 });
    const datasComSaldo = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'];
    const compraIdPorData = new Map<string, string>();
    for (const dataOperacao of datasComSaldo) {
      const compraId = await criarCompraConfirmada(app, comprasCookies, base, {
        dataOperacao,
        quantidade: 10,
      });
      compraIdPorData.set(dataOperacao, compraId);
    }

    dtoBase = {
      compraProgramadaId: compraIdPorData.get('2026-08-05')!,
      clienteId: base.clienteId,
      dataOperacao: '2026-08-05',
      salvarComoRascunho: false,
      itens: [{ produtoId: base.produtoId, quantidadePedida: 2 }],
    };

    const [rota] = await db.insert(schema.rotas)
      .values({ codigo: uid('ROTA'), nome: 'Rota Norte' })
      .returning();
    const [rotaDesvio] = await db.insert(schema.rotas)
      .values({ codigo: uid('ROTAD'), nome: 'Entrega direta' })
      .returning();
    const [representante] = await db.insert(schema.representantes)
      .values({ codigo: uid('REP'), nome: 'Representante Sul' })
      .returning();
    if (!rota || !rotaDesvio || !representante) throw new Error('Falha ao criar rota/representante do teste');

    const [clienteComRota] = await db.insert(schema.clientes).values({
      codigo: uid('CLIHER'),
      razaoSocial: 'Cliente Com Rota',
      documentoFiscal: uid('DOCHER'),
      rotaId: rota.id,
      representanteId: representante.id,
    }).returning();
    const [clienteSemRota] = await db.insert(schema.clientes).values({
      codigo: uid('CLISEM'),
      razaoSocial: 'Cliente Sem Rota',
      documentoFiscal: uid('DOCSEM'),
    }).returning();
    if (!clienteComRota || !clienteSemRota) throw new Error('Falha ao criar clientes do teste');

    ctx = {
      clienteComRotaId: clienteComRota.id,
      clienteSemRotaId: clienteSemRota.id,
      representanteId: representante.id,
      nomeRepresentante: representante.nome,
      nomeRotaDoCliente: rota.nome,
      rotaDesvioId: rotaDesvio.id,
    };
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('recusa segundo pedido aberto do mesmo cliente item e operacao com 409 PEDIDO_ABERTO_EXISTENTE',
    async () => {
      await service.criar(dtoBase, usuarioId);
      await expect(service.criar(dtoBase, usuarioId)).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: 'PEDIDO_ABERTO_EXISTENTE' }),
      });
    });

  it('permite pedidos abertos do mesmo cliente e item em operacoes diferentes', async () => {
    await service.criar({ ...dtoBase, dataOperacao: '2026-08-01' }, usuarioId);
    await expect(service.criar({ ...dtoBase, dataOperacao: '2026-08-02' }, usuarioId))
      .resolves.toMatchObject({ status: 'em_elaboracao_reserva_ativa' });
  });

  it('criar em data sem operacao nao checa AD-03 e cria a operacao do dia', async () => {
    // Data virgem: não há operação nem disponibilidade — o próprio déficit é overbooking,
    // por isso a criação exige a confirmação explícita (AD-05); o ponto testado aqui é que
    // a ausência de operação NÃO impede a criação nem aciona a checagem AD-03 (ramo nulo).
    const pedido = await service.criar({ ...dtoBase, dataOperacao: '2026-08-09' }, usuarioId, true);
    expect(pedido.operacaoId).toEqual(expect.any(String));
    await expect(service.buscarAberto({
      clienteId: dtoBase.clienteId,
      produtoId: dtoBase.itens[0]!.produtoId,
      dataOperacao: '2026-08-10',
    }, usuarioId)).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ code: 'OPERACAO_NAO_ENCONTRADA' }),
    });
  });

  it('pedido herda rota do cliente e expoe o representante do cadastro', async () => {
    const comHeranca = await service.criar(
      { ...dtoBase, clienteId: ctx.clienteComRotaId }, usuarioId,
    );
    expect(comHeranca.rotaPrevista).toBe(ctx.nomeRotaDoCliente);
    const detalhe = await service.detalhar(comHeranca.id, usuarioId);
    expect(detalhe.heranca).toMatchObject({
      representanteId: ctx.representanteId,
      representanteNome: ctx.nomeRepresentante,
      rotaNome: ctx.nomeRotaDoCliente,
    });

    const comDesvio = await service.criar(
      { ...dtoBase, clienteId: ctx.clienteComRotaId, dataOperacao: '2026-08-03',
        rotaId: ctx.rotaDesvioId }, usuarioId,
    );
    expect(comDesvio.rotaPrevista).toBe('Entrega direta');

    const semRota = await service.criar(
      { ...dtoBase, clienteId: ctx.clienteSemRotaId, dataOperacao: '2026-08-04' }, usuarioId,
    );
    expect(semRota.rotaPrevista).toBeNull();
  });
});

/**
 * Task 8 — AD-06: liberação administrativa de reserva e rascunho explícito.
 */
describe('pedidos-onda4 (AD-06 liberar reserva administrativa)', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let comprasCookies: string;
  let comercialCookies: string;
  let gestorCookies: string;
  let base: Awaited<ReturnType<typeof seedComercialBase>>;

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);

    const drizzle = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    db = drizzle.db;
    base = await seedComercialBase(app, { fator: 1 });
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function criarPedidoHttp(
    dataOperacao: string, opts: { salvarComoRascunho?: boolean } = {},
  ): Promise<{ id: string; status: string }> {
    const { default: request } = await import('supertest');
    const compraProgramadaId = await criarCompraConfirmada(app, comprasCookies, base, {
      dataOperacao, quantidade: 10,
    });
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId,
        clienteId: base.clienteId,
        dataOperacao,
        salvarComoRascunho: opts.salvarComoRascunho,
        itens: [{ produtoId: base.produtoId, quantidadePedida: 2 }],
      });
    if (res.status !== 201) throw new Error(`Falha ao criar pedido: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body as { id: string; status: string };
  }

  async function itemIdDoPedido(pedidoId: string): Promise<string> {
    const { default: request } = await import('supertest');
    const det = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${pedidoId}`)
      .set('Cookie', comercialCookies);
    const itemId = (det.body.itens as Array<{ id: string }>)[0]?.id;
    if (!itemId) throw new Error('Pedido sem itens');
    return itemId;
  }

  it('salvarComoRascunho cria pedido em rascunho com reserva ativa', async () => {
    const pedido = await criarPedidoHttp('2026-08-20', { salvarComoRascunho: true });
    expect(pedido.status).toBe('rascunho');

    const itemId = await itemIdDoPedido(pedido.id);
    const reservas = await db.select().from(schema.reservasDisponibilidade)
      .where(eq(schema.reservasDisponibilidade.pedidoVendaItemId, itemId));
    expect(reservas.length).toBeGreaterThan(0);
    expect(reservas.every((r) => r.status === 'ativa')).toBe(true);
  });

  it('liberar reserva exige justificativa libera reservas e registra auditoria', async () => {
    const { default: request } = await import('supertest');
    const pedido = await criarPedidoHttp('2026-08-21', { salvarComoRascunho: true });
    const itemId = await itemIdDoPedido(pedido.id);

    const semJustificativa = await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedido.id}/liberar-reserva`)
      .set('Cookie', gestorCookies)
      .send({ justificativa: 'curta' });
    expect(semJustificativa.status).toBe(400);

    const liberado = await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedido.id}/liberar-reserva`)
      .set('Cookie', gestorCookies)
      .send({ justificativa: 'Cliente desistiu da compra hoje pelo telefone' });
    expect(liberado.status).toBe(200);
    expect(liberado.body).toMatchObject({ id: pedido.id, status: 'cancelado' });

    const reservas = await db.select().from(schema.reservasDisponibilidade)
      .where(eq(schema.reservasDisponibilidade.pedidoVendaItemId, itemId));
    expect(reservas.length).toBeGreaterThan(0);
    expect(reservas.every((r) => r.status === 'liberada')).toBe(true);

    const auditorias = await db.select().from(schema.auditoria)
      .where(and(
        eq(schema.auditoria.tabela, 'pedidos_venda'),
        eq(schema.auditoria.registroId, pedido.id),
        eq(schema.auditoria.operacao, 'UPDATE'),
      ));
    expect(auditorias.some((a) => a.justificativa?.includes('Cliente desistiu'))).toBe(true);
  });

  it('liberar reserva sem permissao retorna 403', async () => {
    const { default: request } = await import('supertest');
    const pedido = await criarPedidoHttp('2026-08-22', { salvarComoRascunho: true });

    const res = await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedido.id}/liberar-reserva`)
      .set('Cookie', comercialCookies)
      .send({ justificativa: 'Cliente desistiu da compra hoje pelo telefone' });
    expect(res.status).toBe(403);
  });
});
