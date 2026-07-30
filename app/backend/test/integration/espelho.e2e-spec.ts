import { INestApplication } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { representantes, rotas } from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada } from '../helpers/comercial-fixtures';
import { criarPedido } from '../helpers/pesagem-fixtures';

type Db = NodePgDatabase<typeof schema>;

interface EspelhoItemResp {
  cliente: string;
  rota: string | null;
  representante: string | null;
  quantidadePedida: string;
  quantidadeAtendida: string;
  pesoAtendido: string;
  status: string;
}
interface EspelhoGrupoResp {
  chave: string;
  itens: EspelhoItemResp[];
  subtotal: { quantidadePedida: string; quantidadeAtendida: string; pesoAtendido: string };
}
interface EspelhoRespostaBody {
  totalGeral: { quantidadePedida: string; quantidadeAtendida: string; pesoAtendido: string };
  grupos: EspelhoGrupoResp[];
}

describe('espelho comercial — Onda 4 (D19/D20)', () => {
  let app: INestApplication;
  let db: Db;
  let adminCookies: string;
  let comprasCookies: string;
  const dataOperacao = '2026-08-05';

  async function request() {
    return (await import('supertest')).default;
  }

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDb(app);
    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    const compras = await createTestUser(app, { perfil: 'compras' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
  }, 60000);

  async function montarCenario() {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(
      app, adminCookies, { fornecedorId: base.fornecedorId, itemCompraId: base.itemCompraId },
      { dataOperacao, quantidade: 100 },
    );

    const [rota1] = await db.insert(rotas).values({ codigo: 'ROT-1', nome: 'Rota Centro' }).returning();
    const [rota2] = await db.insert(rotas).values({ codigo: 'ROT-2', nome: 'Rota Zona Sul' }).returning();
    const [rep1] = await db.insert(representantes).values({ codigo: 'REP-1', nome: 'Sabrina' }).returning();
    const [rep2] = await db.insert(representantes).values({ codigo: 'REP-2', nome: 'Duda' }).returning();
    if (!rota1 || !rota2 || !rep1 || !rep2) throw new Error('Falha ao semear rotas/representantes');

    const [clienteA] = await db.insert(schema.clientes).values({
      codigo: 'CLI-ESP-A', razaoSocial: 'Cliente Espelho A', documentoFiscal: 'DOC-ESP-A',
      rotaId: rota1.id, representanteId: rep1.id,
    }).returning();
    const [clienteB] = await db.insert(schema.clientes).values({
      codigo: 'CLI-ESP-B', razaoSocial: 'Cliente Espelho B', documentoFiscal: 'DOC-ESP-B',
      rotaId: rota2.id, representanteId: rep2.id,
    }).returning();
    if (!clienteA || !clienteB) throw new Error('Falha ao semear clientes do espelho');

    await criarPedido(app, adminCookies, {
      compraId, clienteId: clienteA.id, itemComercialId: base.itemComercialId, dataOperacao, quantidade: 20,
    });
    await criarPedido(app, adminCookies, {
      compraId, clienteId: clienteB.id, itemComercialId: base.itemComercialId, dataOperacao, quantidade: 30,
    });

    return { clienteA, clienteB, rota1, rota2, rep1, rep2 };
  }

  it('agrupa por cliente rota e representante com totais coerentes', async () => {
    await montarCenario();
    const req = await request();

    const porCliente = await req(app.getHttpServer())
      .get('/comercial/espelho').query({ dataOperacao, agrupar: 'cliente' }).set('Cookie', adminCookies);
    const porRota = await req(app.getHttpServer())
      .get('/comercial/espelho').query({ dataOperacao, agrupar: 'rota' }).set('Cookie', adminCookies);
    const porRepresentante = await req(app.getHttpServer())
      .get('/comercial/espelho').query({ dataOperacao, agrupar: 'representante' }).set('Cookie', adminCookies);

    expect(porCliente.status).toBe(200);
    expect(porRota.status).toBe(200);
    expect(porRepresentante.status).toBe(200);

    const totalCliente = (porCliente.body as EspelhoRespostaBody).totalGeral;
    const totalRota = (porRota.body as EspelhoRespostaBody).totalGeral;
    const totalRepresentante = (porRepresentante.body as EspelhoRespostaBody).totalGeral;
    expect(totalCliente).toEqual(totalRota);
    expect(totalCliente).toEqual(totalRepresentante);
    expect(totalCliente.quantidadePedida).toBe('50.000');

    expect((porCliente.body as EspelhoRespostaBody).grupos).toHaveLength(2);
    expect((porRota.body as EspelhoRespostaBody).grupos.map((g) => g.chave).sort())
      .toEqual(['Rota Centro', 'Rota Zona Sul']);
    expect((porRepresentante.body as EspelhoRespostaBody).grupos.map((g) => g.chave).sort())
      .toEqual(['Duda', 'Sabrina']);

    for (const grupo of (porRota.body as EspelhoRespostaBody).grupos) {
      const somaItens = grupo.itens.reduce((s, i) => s + Number(i.quantidadePedida), 0);
      expect(somaItens).toBe(Number(grupo.subtotal.quantidadePedida));
    }
  });

  it('export csv respeita filtros e devolve content-type text/csv', async () => {
    const { clienteA } = await montarCenario();
    const req = await request();
    const res = await req(app.getHttpServer())
      .get('/comercial/espelho')
      .query({ dataOperacao, formato: 'csv', clienteId: clienteA.id })
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain(`espelho-comercial-${dataOperacao}.csv`);
    expect(res.text).toContain('Cliente Espelho A');
    expect(res.text).not.toContain('Cliente Espelho B');
  });

  it('espelho sem ESPELHO_COMERCIAL_LER retorna 403', async () => {
    await montarCenario();
    const req = await request();
    const res = await req(app.getHttpServer())
      .get('/comercial/espelho').query({ dataOperacao }).set('Cookie', comprasCookies);
    expect(res.status).toBe(403);
  });
});
