import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import {
  montarCenarioPesagem,
  criarPedido,
  pecaAssociadaComEtiqueta,
  fakes,
  type CenarioPesagem,
} from '../helpers/pesagem-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';

describe('Estorno de associação e2e (D6.3 / D6.18 / D6.19)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;
  let gestorCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

  async function cenario(dataOperacao: string): Promise<CenarioPesagem & { pedidoId: string; pedidoItemId: string; pecaId: string }> {
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao, quantidade: 10 },
    );
    const { pedidoId, pedidoItemId } = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });
    const pecaId = await pecaAssociadaComEtiqueta(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId,
      itemComercialBaseId: c.itemComercialId,
      pedidoVendaItemId: pedidoItemId,
    });
    return { ...c, pedidoId, pedidoItemId, pecaId };
  }

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.500');
    fakes(app).impressora.definirStatus('disponivel');
  });

  it('devolve quantidade_atendida e retorna a peça para em_sobra', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-11');
    const itemAntes = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, c.pedidoItemId))
      .then((r) => r[0]!);
    expect(Number(itemAntes.quantidadeAtendida)).toBeGreaterThan(0);

    const res = await request(srv())
      .post(`/operacao/pesagem/pecas/${c.pecaId}/estornar`)
      .set('Cookie', gestorCookies)
      .send({ motivo: 'pedido_incorreto' });
    expect(res.status).toBe(201);
    expect(res.body.statusPeca).toBe('em_sobra');
    expect(res.body.pedidoVendaItemId).toBeNull();

    const itemDepois = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, c.pedidoItemId))
      .then((r) => r[0]!);
    expect(Number(itemDepois.quantidadeAtendida)).toBe(Number(itemAntes.quantidadeAtendida) - 1);
  });

  it('cancela a etiqueta vigente com motivo do estorno', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-12');
    const etiquetaAntes = await db()
      .select()
      .from(schema.etiquetasImpressoes)
      .where(eq(schema.etiquetasImpressoes.pecaId, c.pecaId))
      .then((r) => r[0]!);

    const res = await request(srv())
      .post(`/operacao/pesagem/pecas/${c.pecaId}/estornar`)
      .set('Cookie', gestorCookies)
      .send({ motivo: 'etiqueta_incorreta' });
    expect(res.status).toBe(201);

    const etiqueta = await db()
      .select()
      .from(schema.etiquetasImpressoes)
      .where(eq(schema.etiquetasImpressoes.id, etiquetaAntes.id))
      .then((r) => r[0]!);
    expect(etiqueta.estado).toBe('cancelada');
    expect(etiqueta.motivoCancelamento).toBe('etiqueta_incorreta');
  });

  it('403 para perfil com ASSOCIACAO_GERENCIAR mas sem ASSOCIACAO_ESTORNAR', async () => {
    const { default: request } = await import('supertest');
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: '2026-09-13', quantidade: 10 },
    );
    const { pedidoItemId } = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });
    const pecaId = await import('../helpers/pesagem-fixtures').then((m) =>
      m.pesarPeca(app, recebimentoCookies, {
        recebimentoId: c.recebimentoId,
        itemComercialBaseId: c.itemComercialId,
      }),
    );

    const confirmar = await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: pedidoItemId });
    expect([200, 201]).toContain(confirmar.status);

    const estornar = await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/estornar`)
      .set('Cookie', recebimentoCookies)
      .send({ motivo: 'peso_incorreto' });
    expect(estornar.status).toBe(403);
  });

  it('409 quando a peça está em carga fechada', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-09-14');
    const recebimento = await db()
      .select()
      .from(schema.recebimentos)
      .where(eq(schema.recebimentos.id, c.recebimentoId))
      .then((r) => r[0]!);
    const [caminhao] = await db()
      .insert(schema.caminhoes)
      .values({
        placa: `FCH${Date.now().toString().slice(-4)}`,
        motorista: 'Motorista Fechado',
        operacaoId: recebimento.operacaoId,
        statusCaminhao: 'fechado',
      })
      .returning();
    await db().insert(schema.cargaItens).values({
      caminhaoId: caminhao!.id,
      tipoOrigem: 'peca',
      pecaId: c.pecaId,
      pedidoVendaId: c.pedidoId,
      pedidoVendaItemId: c.pedidoItemId,
      statusCargaItem: 'conferido',
      conferido: true,
    });

    const res = await request(srv())
      .post(`/operacao/pesagem/pecas/${c.pecaId}/estornar`)
      .set('Cookie', gestorCookies)
      .send({ motivo: 'destino_incorreto' });
    expect(res.status).toBe(409);
  });
});
