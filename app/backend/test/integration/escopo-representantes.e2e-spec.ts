import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada } from '../helpers/comercial-fixtures';

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

describe('escopo-representantes e2e (E5.1 Task 20)', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let adminCookies: string;
  let comercialA: string;
  let comercialB: string;
  let repA: string;
  let repB: string;
  let clienteA: string;
  let clienteB: string;
  // Fixture de pedidos/adendos (criterios 6.15, 6.16, 6.17) — dois pedidos do cliente A
  // (totais distintos de B) e um item real para exercitar mutacoes/adendo dentro e fora do escopo.
  let produtoId: string;
  let pedidoA1Id: string;
  let pedidoA2Id: string;
  let pedidoBId: string;
  let itemPedidoA1Id: string;
  let itemPedidoA2Id: string;
  let itemPedidoBId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);

    // Concede CLIENTES_GERENCIAR ao perfil comercial para exercer mutações no escopo
    // (o bootstrap padrão só dá CLIENTES_LER — 403 mascararia o 404 de fora do escopo).
    const permsRes = await request(app.getHttpServer())
      .put('/perfis/comercial/permissoes')
      .set('Cookie', adminCookies)
      .send({
        // Bootstrap do perfil comercial + CLIENTES_GERENCIAR para testar mutações no escopo.
        permissoes: [
          'CLIENTES_LER', 'CLIENTES_GERENCIAR',
          'FORNECEDORES_LER', 'ITENS_COMPRA_LER', 'ITENS_COMERCIAIS_LER',
          'PRODUTOS_LER', 'REPRESENTANTES_LER', 'ROTAS_LER',
          'REGRAS_DESDOBRAMENTO_LER', 'PARAMETROS_LER',
          'COMPRAS_PROGRAMADAS_LER', 'DISPONIBILIDADE_LER',
          'PEDIDOS_LER', 'PEDIDOS_GERENCIAR',
          'RECEBIMENTO_LER', 'PESAGEM_LER',
        ],
      });
    if (permsRes.status !== 200) {
      throw new Error(`Falha ao conceder CLIENTES_GERENCIAR: ${permsRes.status}`);
    }

    const userA = await createTestUser(app, { perfil: 'comercial' });
    const userB = await createTestUser(app, { perfil: 'comercial' });
    // Login DEPOIS da concessão — permissões viajam no JWT.
    comercialA = await loginCookies(app, userA.adminEmail, userA.adminPassword);
    comercialB = await loginCookies(app, userB.adminEmail, userB.adminPassword);

    const [rA] = await db.insert(schema.representantes)
      .values({ codigo: uid('RA'), nome: 'Rep A' }).returning();
    const [rB] = await db.insert(schema.representantes)
      .values({ codigo: uid('RB'), nome: 'Rep B' }).returning();
    if (!rA || !rB) throw new Error('reps');
    repA = rA.id;
    repB = rB.id;

    const [cA] = await db.insert(schema.clientes).values({
      codigo: uid('CA'), razaoSocial: 'Cliente A', documentoFiscal: uid('DA'), representanteId: repA,
    }).returning();
    // Segundo cliente do Rep A → totais distintos (2 vs 1) entre usuários A e B.
    const [cA2] = await db.insert(schema.clientes).values({
      codigo: uid('CA2'), razaoSocial: 'Cliente A2', documentoFiscal: uid('DA2'), representanteId: repA,
    }).returning();
    const [cB] = await db.insert(schema.clientes).values({
      codigo: uid('CB'), razaoSocial: 'Cliente B', documentoFiscal: uid('DB'), representanteId: repB,
    }).returning();
    if (!cA || !cA2 || !cB) throw new Error('clientes');
    clienteA = cA.id;
    clienteB = cB.id;

    const [uA] = await db.select().from(schema.usuarios).where(sql`${schema.usuarios.email} = ${userA.adminEmail}`);
    const [uB] = await db.select().from(schema.usuarios).where(sql`${schema.usuarios.email} = ${userB.adminEmail}`);
    if (!uA || !uB) throw new Error('users');

    await db.insert(schema.usuariosRepresentantes).values({ usuarioId: uA.id, representanteId: repA });
    await db.insert(schema.usuariosRepresentantes).values({ usuarioId: uB.id, representanteId: repB });

    // Fixture de pedidos: dois pedidos do cliente A (operações distintas, mesmo item comercial)
    // e um pedido do cliente B, todos com reserva real (sem overbooking) via API pública,
    // para exercitar escopo em listar/detalhar/mutações de Pedido e no ciclo de Adendo (6.15-6.17).
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const base = await seedComercialBase(app, { fator: 1 });
    produtoId = base.produtoId;

    const compraA1 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2027-02-01', quantidade: 10 });
    const pedidoA1 = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialA)
      .send({
        compraProgramadaId: compraA1,
        clienteId: clienteA,
        dataOperacao: '2027-02-01',
        itens: [{ produtoId, quantidadePedida: 2 }],
      });
    if (pedidoA1.status !== 201) {
      throw new Error(`Falha ao criar pedidoA1: ${pedidoA1.status} ${JSON.stringify(pedidoA1.body)}`);
    }
    pedidoA1Id = pedidoA1.body.id;

    const compraA2 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2027-02-02', quantidade: 10 });
    const pedidoA2 = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialA)
      .send({
        compraProgramadaId: compraA2,
        clienteId: clienteA,
        dataOperacao: '2027-02-02',
        itens: [{ produtoId, quantidadePedida: 1 }],
      });
    if (pedidoA2.status !== 201) {
      throw new Error(`Falha ao criar pedidoA2: ${pedidoA2.status} ${JSON.stringify(pedidoA2.body)}`);
    }
    pedidoA2Id = pedidoA2.body.id;

    const compraB = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2027-02-03', quantidade: 10 });
    const pedidoB = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialB)
      .send({
        compraProgramadaId: compraB,
        clienteId: clienteB,
        dataOperacao: '2027-02-03',
        itens: [{ produtoId, quantidadePedida: 3 }],
      });
    if (pedidoB.status !== 201) {
      throw new Error(`Falha ao criar pedidoB: ${pedidoB.status} ${JSON.stringify(pedidoB.body)}`);
    }
    pedidoBId = pedidoB.body.id;

    const [itemA1] = await db.select().from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.pedidoVendaId, pedidoA1Id));
    const [itemA2] = await db.select().from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.pedidoVendaId, pedidoA2Id));
    const [itemB] = await db.select().from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.pedidoVendaId, pedidoBId));
    if (!itemA1 || !itemA2 || !itemB) throw new Error('itens de pedido');
    itemPedidoA1Id = itemA1.id;
    itemPedidoA2Id = itemA2.id;
    itemPedidoBId = itemB.id;
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('inativação não amplia autorização', async () => {
    await db.update(schema.representantes)
      .set({ status: 'inativo' })
      .where(sql`${schema.representantes.id} = ${repA}`);

    const res = await request(app.getHttpServer())
      .get('/clientes')
      .set('Cookie', comercialA)
      .expect(200);
    expect(res.body.data.some((c: { id: string }) => c.id === clienteA)).toBe(true);

    await db.update(schema.representantes)
      .set({ status: 'ativo' })
      .where(sql`${schema.representantes.id} = ${repA}`);
  });

  it('dois usuários obtêm linhas e totais distintos de clientes', async () => {
    const resA = await request(app.getHttpServer()).get('/clientes').set('Cookie', comercialA).expect(200);
    const resB = await request(app.getHttpServer()).get('/clientes').set('Cookie', comercialB).expect(200);
    expect(resA.body.data.some((c: { id: string }) => c.id === clienteA)).toBe(true);
    expect(resA.body.data.some((c: { id: string }) => c.id === clienteB)).toBe(false);
    expect(resB.body.data.some((c: { id: string }) => c.id === clienteB)).toBe(true);
    expect(resA.body.total).not.toBe(resB.body.total);
  });

  it('oculta e protege todas as mutações de cliente fora do escopo', async () => {
    await request(app.getHttpServer())
      .get(`/clientes/${clienteB}`)
      .set('Cookie', comercialA)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/clientes/${clienteB}`)
      .set('Cookie', comercialA)
      .send({ razaoSocial: 'Hack' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/clientes/${clienteB}`)
      .set('Cookie', comercialA)
      .expect(404);
  });

  it('não cria nem transfere cliente para representante proibido', async () => {
    await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', comercialA)
      .send({
        codigo: uid('NEW'),
        razaoSocial: 'Novo',
        // CNPJ válido (dígito verificador) — senão o Zod responde 400 antes do escopo.
        documentoFiscal: '11222333000181',
        representanteId: repB,
      })
      .expect(404);

    // 6.14 (parcial do veredito) — PATCH transferindo um cliente já no escopo
    // (clienteA, representanteId = repA) para o representante proibido (repB)
    // deve ser barrado pelo mesmo exigirRepresentanteNoEscopo, não só o POST.
    await request(app.getHttpServer())
      .patch(`/clientes/${clienteA}`)
      .set('Cookie', comercialA)
      .send({ representanteId: repB })
      .expect(404);
  });

  it('restauração de cliente fora do escopo devolve 404 (6.13)', async () => {
    // Cliente do próprio escopo (repA): remover e restaurar funciona.
    const outroCodigo = uid('REST');
    const criado = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', comercialA)
      .send({
        codigo: outroCodigo,
        razaoSocial: 'Restaurável A',
        documentoFiscal: '11444777000161',
        representanteId: repA,
      })
      .expect(201);
    const clienteRestauravelId = criado.body.id as string;
    await request(app.getHttpServer())
      .delete(`/clientes/${clienteRestauravelId}`)
      .set('Cookie', comercialA)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/clientes/${clienteRestauravelId}/restaurar`)
      .set('Cookie', comercialA)
      .expect(201);

    // Fora do escopo: comercialB não pode restaurar o cliente do representante A,
    // mesmo sabendo o id (o registro fica oculto, não só a mutação normal).
    await request(app.getHttpServer())
      .delete(`/clientes/${clienteRestauravelId}`)
      .set('Cookie', comercialA)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/clientes/${clienteRestauravelId}/restaurar`)
      .set('Cookie', comercialB)
      .expect(404);
  });

  it('dois usuários obtêm pedidos com linhas e totais distintos (6.15)', async () => {
    const resA = await request(app.getHttpServer())
      .get('/comercial/pedidos')
      .set('Cookie', comercialA)
      .expect(200);
    const resB = await request(app.getHttpServer())
      .get('/comercial/pedidos')
      .set('Cookie', comercialB)
      .expect(200);
    expect(resA.body.data.some((p: { id: string }) => p.id === pedidoA1Id)).toBe(true);
    expect(resA.body.data.some((p: { id: string }) => p.id === pedidoA2Id)).toBe(true);
    expect(resA.body.data.some((p: { id: string }) => p.id === pedidoBId)).toBe(false);
    expect(resB.body.data.some((p: { id: string }) => p.id === pedidoBId)).toBe(true);
    expect(resB.body.data.some((p: { id: string }) => p.id === pedidoA1Id)).toBe(false);
    expect(resA.body.total).not.toBe(resB.body.total);
  });

  it('protege leituras e mutações de pedido fora do escopo (6.16)', async () => {
    await request(app.getHttpServer())
      .get(`/comercial/pedidos/${pedidoBId}`)
      .set('Cookie', comercialA)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedidoBId}/itens`)
      .set('Cookie', comercialA)
      .send({ produtoId, quantidade: 1 })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedidoBId}/itens/${itemPedidoBId}`)
      .set('Cookie', comercialA)
      .send({ novaQuantidade: 1, motivo: 'tentativa fora do escopo' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/comercial/pedidos/${pedidoBId}/itens/${itemPedidoBId}`)
      .set('Cookie', comercialA)
      .send({ motivo: 'tentativa fora do escopo' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/comercial/pedidos/${pedidoBId}`)
      .set('Cookie', comercialA)
      .send({ motivo: 'tentativa fora do escopo' })
      .expect(404);

    // Controle positivo: a mesma mutação (reduzir item) no pedido do próprio escopo (A)
    // não é bloqueada — provando que os 404 acima são de escopo, não de RBAC/payload.
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedidoA2Id}/itens/${itemPedidoA2Id}`)
      .set('Cookie', comercialA)
      .send({ novaQuantidade: 0.5, motivo: 'reducao dentro do escopo' })
      .expect(200);
  });

  it('protege ciclo completo de adendo pelo cliente do pedido (6.17)', async () => {
    // Controle positivo: adendo funciona no pedido do próprio escopo (A).
    const registrarNoEscopo = await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedidoA1Id}/adendos`)
      .set('Cookie', comercialA)
      .send({ produtoId, quantidadeAdicionada: 1, motivo: 'ajuste dentro do escopo' })
      .expect(201);
    expect(registrarNoEscopo.body.item.quantidadePedida).toBe('3.000');

    const listarNoEscopo = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${pedidoA1Id}/adendos`)
      .set('Cookie', comercialA)
      .expect(200);
    expect(Array.isArray(listarNoEscopo.body)).toBe(true);
    expect(listarNoEscopo.body.length).toBeGreaterThan(0);

    // Fora do escopo (pedido do cliente B): registrar e listar adendo devem ocultar
    // o recurso com 404, exatamente como o restante do ciclo de Pedido.
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedidoBId}/adendos`)
      .set('Cookie', comercialA)
      .send({ produtoId, quantidadeAdicionada: 1, motivo: 'tentativa fora do escopo' })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/comercial/pedidos/${pedidoBId}/adendos`)
      .set('Cookie', comercialA)
      .expect(404);
  });

  it('deriva representante somente de clientes.representante_id', async () => {
    const cols = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'pedidos_venda' AND column_name LIKE '%representante%'
    `);
    expect(cols.rows).toHaveLength(0);
  });
});
