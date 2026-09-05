import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, criarOutroCliente, pesarPeca, fakes } from '../helpers/pesagem-fixtures';
import { criarCaminhao, abrirCarga, vincularPedido, adicionarPecaNaCarga } from '../helpers/expedicao-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Expedicao — concorrencia de transferencia (F5)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;
  let expedicaoCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const expedicao = await createTestUser(app, { perfil: 'expedicao' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    expedicaoCookies = await loginCookies(app, expedicao.adminEmail, expedicao.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

  it('N pecas disputando transferencia para pedido com saldo limitado: atendida nunca excede pedida', async () => {
    const { default: request } = await import('supertest');
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: '2026-12-30', quantidade: 20 },
    );
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.500');
    fakes(app).impressora.definirStatus('disponivel');

    // Pedido origem com muitas pecas
    const pOrigem = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, produtoId: c.produtoId,
      dataOperacao: c.dataOperacao, quantidade: 10,
    });

    // Pedido destino com saldo = 3
    const saldo = 3;
    const pDestino = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: await criarOutroCliente(app), produtoId: c.produtoId,
      dataOperacao: c.dataOperacao, quantidade: saldo,
    });

    // Criar 6 pecas elegiveis associadas ao pedido origem
    const total = 6;
    const pecaIds: string[] = [];
    for (let i = 0; i < total; i++) {
      const pecaId = await pesarPeca(app, recebimentoCookies, {
        recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId,
      });
      await request(srv())
        .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
        .set('Cookie', recebimentoCookies)
        .send({ pedidoVendaItemId: pOrigem.pedidoItemId });
      await request(srv())
        .post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`)
        .set('Cookie', recebimentoCookies)
        .send();
      pecaIds.push(pecaId);
    }

    // Caminhao em_carga com todas as pecas
    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await vincularPedido(app, expedicaoCookies, caminhaoId, pOrigem.pedidoId);
    await vincularPedido(app, expedicaoCookies, caminhaoId, pDestino.pedidoId);
    await abrirCarga(app, expedicaoCookies, caminhaoId);

    const cargaItemIds: string[] = [];
    for (const pecaId of pecaIds) {
      const cargaItemId = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);
      cargaItemIds.push(cargaItemId);
    }

    // Transferir todos em paralelo — concorrencia real
    const resultados = await Promise.all(
      cargaItemIds.map((cargaItemId) =>
        request(srv())
          .post(`/operacao/expedicao/itens/${cargaItemId}/transferir`)
          .set('Cookie', expedicaoCookies)
          .send({ pedidoVendaItemDestinoId: pDestino.pedidoItemId, motivo: 'redistribuicao' }),
      ),
    );

    const sucessos = resultados.filter((r) => r.status === 201).length;
    const conflitos = resultados.filter((r) => r.status === 409).length;
    expect(sucessos).toBe(saldo);
    expect(conflitos).toBe(total - saldo);

    // Verificar que atendida nunca excede pedida
    const itemDestino = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, pDestino.pedidoItemId))
      .then((r) => r[0]!);
    expect(itemDestino.quantidadeAtendida).toBe('3.000'); // nunca excede pedida
  }, 60000);
});
