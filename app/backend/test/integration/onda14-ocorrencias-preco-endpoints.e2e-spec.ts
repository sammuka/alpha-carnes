import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import {
  ocorrenciasAjustePreco,
  pedidosVenda,
  pedidosVendaItens,
  tabelasPreco,
  tabelasPrecoItens,
} from '../../src/database/schema';
import { EVENTOS } from '../../src/realtime/events/eventos';
import { RealtimeGateway } from '../../src/realtime/realtime.gateway';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada } from '../helpers/comercial-fixtures';

type Db = NodePgDatabase<typeof schema>;

async function publicarTabela(
  db: Db,
  data: string,
  itens: Array<{ produtoId: string; precoA: string }>,
) {
  const [tab] = await db.insert(tabelasPreco).values({ data, status: 'publicada' }).returning();
  if (!tab) throw new Error('tabela');
  await db.insert(tabelasPrecoItens).values(itens.map((i) => ({
    tabelaPrecoId: tab.id,
    produtoId: i.produtoId,
    precoA: i.precoA,
    precoB: i.precoA,
    precoC: i.precoA,
    precoD: i.precoA,
  })));
}

describe('Onda 14 — endpoints ocorrências ajuste preço (ALP-84)', () => {
  let app: INestApplication;
  let db: Db;
  let comercialCookies: string;
  let comprasCookies: string;
  let gestorCookies: string;
  let diretoriaCookies: string;
  let base: Awaited<ReturnType<typeof seedComercialBase>>;
  let operacaoIdA: string;
  let operacaoIdB: string;
  let seqData = 0;

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
    await cleanupDb(app);

    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    const diretoria = await createTestUser(app, { perfil: 'diretoria' });
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    diretoriaCookies = await loginCookies(app, diretoria.adminEmail, diretoria.adminPassword);

    base = await seedComercialBase(app);
    for (let d = 1; d <= 20; d += 1) {
      const data = `2026-12-${String(d).padStart(2, '0')}`;
      await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: data, quantidade: 100 });
    }

    const compraA = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-12-21',
        fornecedorId: base.fornecedorId,
        itens: [{ produtoId: base.produtoCompraId, quantidadeComprada: 50 }],
      });
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraA.body.id}/confirmar`)
      .set('Cookie', comprasCookies);
    await publicarTabela(db, '2026-12-21', [{ produtoId: base.produtoId, precoA: '18.50' }]);
    operacaoIdA = compraA.body.operacaoId as string;

    const compraB = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-12-22',
        fornecedorId: base.fornecedorId,
        itens: [{ produtoId: base.produtoCompraId, quantidadeComprada: 50 }],
      });
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraB.body.id}/confirmar`)
      .set('Cookie', comprasCookies);
    await publicarTabela(db, '2026-12-22', [{ produtoId: base.produtoId, precoA: '18.50' }]);
    operacaoIdB = compraB.body.operacaoId as string;
  }, 120_000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function criarOcorrencia(opts: {
    dataOperacao: string;
    precoAplicado?: string;
    patchPreco?: string;
  }): Promise<{ ocorrenciaId: string; pedidoId: string; operacaoId: string }> {
    seqData += 1;
    const dataOp = opts.dataOperacao;
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dataOp,
        itens: [{
          produtoId: base.produtoId,
          quantidadePedida: 2,
          ...(opts.precoAplicado ? { precoAplicado: opts.precoAplicado } : {}),
        }],
      });
    if (res.status !== 201) throw new Error(`criar pedido: ${res.status}`);
    const pedidoId = res.body.id as string;
    const [pedidoRow] = await db.select({ operacaoId: pedidosVenda.operacaoId })
      .from(pedidosVenda).where(eq(pedidosVenda.id, pedidoId));
    if (opts.patchPreco) {
      const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
        .where(eq(pedidosVendaItens.pedidoVendaId, pedidoId)))[0]?.id;
      await request(app.getHttpServer())
        .patch(`/comercial/pedidos/${pedidoId}/itens/${itemId}/preco`)
        .set('Cookie', comercialCookies)
        .send({ precoAplicado: opts.patchPreco });
    }
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedidoId}/finalizar`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const [oc] = await db.select({ id: ocorrenciasAjustePreco.id })
      .from(ocorrenciasAjustePreco)
      .where(eq(ocorrenciasAjustePreco.pedidoVendaId, pedidoId));
    if (!oc) throw new Error('ocorrencia ausente');
    return { ocorrenciaId: oc.id, pedidoId, operacaoId: pedidoRow!.operacaoId };
  }

  it('403 list sem APROVACOES_LER', async () => {
    await request(app.getHttpServer())
      .get(`/ocorrencias-preco?operacaoId=${operacaoIdA}`)
      .set('Cookie', comercialCookies)
      .expect(403);
  });

  it('403 ciente sem OCORRENCIA_PRECO_CIENTE', async () => {
    const { ocorrenciaId } = await criarOcorrencia({ dataOperacao: '2026-12-01', patchPreco: '19.00' });
    await request(app.getHttpServer())
      .post(`/ocorrencias-preco/${ocorrenciaId}/ciente`)
      .set('Cookie', diretoriaCookies)
      .expect(403);
  });

  it('400 list sem operacaoId', async () => {
    await request(app.getHttpServer())
      .get('/ocorrencias-preco')
      .set('Cookie', gestorCookies)
      .expect(400);
  });

  it('list operacaoId=A não devolve ocorrência de operacaoId=B', async () => {
    const opA = await criarOcorrencia({ dataOperacao: '2026-12-21', patchPreco: '19.00' });
    const opB = await criarOcorrencia({ dataOperacao: '2026-12-22', patchPreco: '19.00' });
    const resA = await request(app.getHttpServer())
      .get(`/ocorrencias-preco?operacaoId=${opA.operacaoId}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const idsA = (resA.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(idsA).toContain(opA.ocorrenciaId);
    expect(idsA).not.toContain(opB.ocorrenciaId);
  });

  it('list não contém chave itens', async () => {
    const { ocorrenciaId, operacaoId } = await criarOcorrencia({ dataOperacao: '2026-12-02', patchPreco: '19.00' });
    const res = await request(app.getHttpServer())
      .get(`/ocorrencias-preco?operacaoId=${operacaoId}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const linha = (res.body.data as Array<Record<string, unknown>>).find((r) => r.id === ocorrenciaId);
    expect(linha).toBeDefined();
    expect(linha).not.toHaveProperty('itens');
  });

  it('GET /:id devolve OcorrenciaPrecoDetalhe com 11 chaves', async () => {
    const { ocorrenciaId, pedidoId } = await criarOcorrencia({ dataOperacao: '2026-12-03', patchPreco: '19.00' });
    const res = await request(app.getHttpServer())
      .get(`/ocorrencias-preco/${ocorrenciaId}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'clienteNomeFantasia',
      'dataHora',
      'dataHoraCiente',
      'diferencaTotal',
      'id',
      'itens',
      'pedidoNumero',
      'quantidadeItensAjustados',
      'status',
      'usuarioCienteNome',
      'usuarioFinalizacaoNome',
    ].sort());
    expect(res.body.pedidoNumero).toBe(pedidoId);
    expect(Array.isArray(res.body.itens)).toBe(true);
  });

  it('C8 detalhe diferencaPercentual === -8.1081', async () => {
    const { ocorrenciaId } = await criarOcorrencia({ dataOperacao: '2026-12-04', patchPreco: '17.00' });
    const res = await request(app.getHttpServer())
      .get(`/ocorrencias-preco/${ocorrenciaId}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(res.body.itens[0].diferencaPercentual).toBe('-8.1081');
  });

  it('C7 detalhe diferencaPercentual null quando original null', async () => {
    const dataOp = '2026-12-25';
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dataOp, quantidade: 50, publicarTabela: false });
    const resPed = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dataOp,
        itens: [{ produtoId: base.produtoId, quantidadePedida: 1, precoAplicado: '15.00' }],
      });
    const pedidoId = resPed.body.id as string;
    const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.pedidoVendaId, pedidoId)))[0]?.id;
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedidoId}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '16.00' });
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedidoId}/finalizar`)
      .set('Cookie', gestorCookies);
    const [oc] = await db.select({ id: ocorrenciasAjustePreco.id })
      .from(ocorrenciasAjustePreco).where(eq(ocorrenciasAjustePreco.pedidoVendaId, pedidoId));
    const det = await request(app.getHttpServer())
      .get(`/ocorrencias-preco/${oc!.id}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(det.body.itens[0].diferencaPercentual).toBeNull();
  });

  it('409 segunda ciência', async () => {
    const { ocorrenciaId } = await criarOcorrencia({ dataOperacao: '2026-12-05', patchPreco: '19.00' });
    await request(app.getHttpServer())
      .post(`/ocorrencias-preco/${ocorrenciaId}/ciente`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const res = await request(app.getHttpServer())
      .post(`/ocorrencias-preco/${ocorrenciaId}/ciente`)
      .set('Cookie', gestorCookies);
    expect(res.status).toBe(409);
    expect(res.body.message.code).toBe('OCORRENCIA_JA_CIENTE');
  });

  it('404 detalhe inexistente', async () => {
    await request(app.getHttpServer())
      .get('/ocorrencias-preco/00000000-0000-4000-8000-000000000001')
      .set('Cookie', gestorCookies)
      .expect(404);
  });

  it('emite OCORRENCIA_AJUSTE_PRECO_CIENTE após commit', async () => {
    const emitter = app.get(EventEmitter2);
    const emitSpy = jest.spyOn(emitter, 'emit');
    const { ocorrenciaId } = await criarOcorrencia({ dataOperacao: '2026-12-06', patchPreco: '19.00' });
    emitSpy.mockClear();
    await request(app.getHttpServer())
      .post(`/ocorrencias-preco/${ocorrenciaId}/ciente`)
      .set('Cookie', gestorCookies);
    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.OCORRENCIA_AJUSTE_PRECO_CIENTE,
      expect.objectContaining({ ocorrenciaId }),
    );
    emitSpy.mockRestore();
  });

  it('gateway broadcast CIENTE para rooms da operação', async () => {
    const gateway = app.get(RealtimeGateway);
    const hub = (gateway as unknown as { hub: { broadcast: jest.Mock } }).hub;
    const broadcastSpy = jest.spyOn(hub, 'broadcast');
    const { ocorrenciaId } = await criarOcorrencia({ dataOperacao: '2026-12-07', patchPreco: '19.00' });
    broadcastSpy.mockClear();
    await request(app.getHttpServer())
      .post(`/ocorrencias-preco/${ocorrenciaId}/ciente`)
      .set('Cookie', gestorCookies);
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.any(String),
      EVENTOS.OCORRENCIA_AJUSTE_PRECO_CIENTE,
      expect.objectContaining({ dataOperacao: '2026-12-07' }),
    );
    broadcastSpy.mockRestore();
  });

  it('filtro status=aberta', async () => {
    const { ocorrenciaId, operacaoId } = await criarOcorrencia({ dataOperacao: '2026-12-08', patchPreco: '19.00' });
    const res = await request(app.getHttpServer())
      .get(`/ocorrencias-preco?operacaoId=${operacaoId}&status=aberta`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(ocorrenciaId);
  });

  it('14.7b nenhum endpoint aprovar/rejeitar atinge a ocorrência', async () => {
    const { ocorrenciaId } = await criarOcorrencia({ dataOperacao: '2026-12-09', patchPreco: '19.25' });
    await request(app.getHttpServer())
      .post(`/ocorrencias-preco/${ocorrenciaId}/aprovar`)
      .set('Cookie', gestorCookies)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/ocorrencias-preco/${ocorrenciaId}/rejeitar`)
      .set('Cookie', gestorCookies)
      .expect(404);
  });
});
