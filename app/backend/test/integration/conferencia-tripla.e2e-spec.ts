import { INestApplication } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import {
  cleanupDb,
  createTestApp,
  createTestUser,
  loginCookies,
} from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';

describe('conferencia-tripla', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let recebimentoCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { db } = app.get(DRIZZLE);
    await db.execute(sql`DROP INDEX IF EXISTS uq_recebimentos_compra`);
    const compras = await createTestUser(app, { perfil: 'compras' });
    const recebimento = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    recebimentoCookies = await loginCookies(app, recebimento.adminEmail, recebimento.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function montarRecebimento(data: string) {
    const base = await seedComercialBase(app, { fator: 1 });
    const { db } = app.get(DRIZZLE);

    // Caixaria (sem balança)
    const [caixa] = await db.insert(schema.produtos).values({
      codigo: `CX-${Date.now()}`,
      nome: 'Caixa de Rabo',
      unidadePedido: 'kg',
      unidadePreco: 'kg',
      ativoCompra: true,
      ativoVenda: true,
      passaBalanca: false,
    }).returning();

    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: data,
        fornecedorId: base.fornecedorId,
        itens: [{ produtoId: base.produtoCompraId, quantidadeComprada: 5 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${criar.body.id}/confirmar`)
      .set('Cookie', comprasCookies)
      .send()
      .expect(201);

    const pedido = await request(app.getHttpServer())
      .post('/operacao/pedidos-fornecedor')
      .set('Cookie', comprasCookies)
      .send({ compraProgramadaId: criar.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/operacao/pedidos-fornecedor/${pedido.body.id}/enviar`)
      .set('Cookie', comprasCookies)
      .send()
      .expect(200);

    // Inclui caixaria no pedido ao fornecedor
    await db.insert(schema.pedidosFornecedorItens).values({
      pedidoFornecedorId: pedido.body.id,
      produtoId: caixa!.id,
      quantidadePrevista: '10.000',
    });

    const iniciado = await request(app.getHttpServer())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: pedido.body.id })
      .expect(201);
    const recebimentoId = iniciado.body.recebimento.id as string;

    // Caixaria sem balança: materialização usa passaBalanca do produto (entrada direta).
    const [caixaMaterializada] = await db.select()
      .from(schema.recebimentosItens)
      .where(and(
        eq(schema.recebimentosItens.recebimentoId, recebimentoId),
        eq(schema.recebimentosItens.produtoId, caixa!.id),
      ))
      .limit(1);
    expect(caixaMaterializada).toMatchObject({
      quantidadeEsperada: '10.000',
      quantidadeRecebida: '10.000',
      requerBalanca: false,
      statusApuracao: 'entrada_direta',
    });

    // Garante item pesável com requerBalanca
    await db.update(schema.recebimentosItens)
      .set({ requerBalanca: true })
      .where(eq(schema.recebimentosItens.produtoId, base.produtoId));

    return {
      base,
      caixaId: caixa!.id,
      compraId: criar.body.id as string,
      pedidoId: pedido.body.id as string,
      recebimentoId,
    };
  }

  it('compras sem CONFERENCIA_CONCLUIR recebe 403', async () => {
    const { recebimentoId } = await montarRecebimento('2026-08-22');
    const res = await request(app.getHttpServer())
      .post(`/operacao/recebimentos/${recebimentoId}/conferencia/concluir`)
      .set('Cookie', comprasCookies)
      .send({ resultado: 'com_divergencia', observacao: 'sem permissão' });
    expect(res.status).toBe(403);
  });

  it('quadro: conforme / excesso / peso / caixaria / não previsto', async () => {
    const { base, caixaId, compraId, pedidoId, recebimentoId } = await montarRecebimento('2026-08-20');
    const { db } = app.get(DRIZZLE);

    // NF: TZ qtd 2 peso 20; caixa qtd 10
    await request(app.getHttpServer())
      .post(`/operacao/pedidos-fornecedor/${pedidoId}/nf`)
      .set('Cookie', recebimentoCookies)
      .send({
        numero: 'NF-CONF-1',
        recebimentoId,
        itens: [
          { produtoId: base.produtoId, quantidadeDeclarada: 2, pesoDeclarado: 20 },
          { produtoId: caixaId, quantidadeDeclarada: 10 },
        ],
      })
      .expect(201);

    // 2 peças = 10kg cada → conforme
    await db.insert(schema.pecas).values([
      {
        compraProgramadaId: compraId,
        recebimentoId,
        produtoBaseId: base.produtoId,
        pesoOriginal: '10.000',
        modoCapturaPeso: 'manual_assistido',
      },
      {
        compraProgramadaId: compraId,
        recebimentoId,
        produtoBaseId: base.produtoId,
        pesoOriginal: '10.000',
        modoCapturaPeso: 'manual_assistido',
      },
    ]);

    let quadro = await request(app.getHttpServer())
      .get(`/operacao/recebimentos/${recebimentoId}/conferencia`)
      .set('Cookie', recebimentoCookies)
      .expect(200);
    const tz = quadro.body.find((q: { produtoId: string }) => q.produtoId === base.produtoId);
    const cx = quadro.body.find((q: { produtoId: string }) => q.produtoId === caixaId);
    expect(tz.situacao).toBe('conforme');
    expect(Number(tz.qtdNf)).toBe(2);
    expect(Number(tz.qtdApurada)).toBe(2);
    expect(cx.situacao).toBe('conforme');
    expect(Number(cx.qtdNf)).toBe(10);
    expect(Number(cx.qtdApurada)).toBe(10);
    expect(cx.pesoApurado).toBeNull();

    // peça a mais → excesso
    await db.insert(schema.pecas).values({
      compraProgramadaId: compraId,
      recebimentoId,
      produtoBaseId: base.produtoId,
      pesoOriginal: '10.000',
      modoCapturaPeso: 'manual_assistido',
    });
    quadro = await request(app.getHttpServer())
      .get(`/operacao/recebimentos/${recebimentoId}/conferencia`)
      .set('Cookie', recebimentoCookies)
      .expect(200);
    const tzExcesso = quadro.body.find((q: { produtoId: string }) => q.produtoId === base.produtoId);
    expect(tzExcesso.situacao).toBe('divergente');
    expect(Number(tzExcesso.qtdApurada)).toBe(3);

    // item só na pesagem
    const [extra] = await db.insert(schema.produtos).values({
      codigo: `EXT-${Date.now()}`,
      nome: 'Não previsto',
      unidadePedido: 'kg',
      unidadePreco: 'kg',
      passaBalanca: true,
      ativoCompra: true,
      ativoVenda: true,
    }).returning();
    await db.insert(schema.pecas).values({
      compraProgramadaId: compraId,
      recebimentoId,
      produtoBaseId: extra!.id,
      pesoOriginal: '5.000',
      modoCapturaPeso: 'manual_assistido',
    });
    quadro = await request(app.getHttpServer())
      .get(`/operacao/recebimentos/${recebimentoId}/conferencia`)
      .set('Cookie', recebimentoCookies)
      .expect(200);
    const naoPrev = quadro.body.find((q: { produtoId: string }) => q.produtoId === extra!.id);
    expect(naoPrev).toMatchObject({
      previstoNoPedido: false,
      situacao: 'divergente',
      recebimentoItemId: null,
    });
  });

  it('concluir: vínculo NF, ocorrência por divergência, segunda conclusão 409', async () => {
    const { base, pedidoId, recebimentoId, compraId } = await montarRecebimento('2026-08-21');
    const { db } = app.get(DRIZZLE);

    await request(app.getHttpServer())
      .post(`/operacao/pedidos-fornecedor/${pedidoId}/nf`)
      .set('Cookie', recebimentoCookies)
      .send({
        numero: 'NF-CONF-2',
        recebimentoId,
        itens: [
          { produtoId: base.produtoId, quantidadeDeclarada: 1, pesoDeclarado: 10 },
        ],
      })
      .expect(201);

    // 0 peças → falta
    const falso = await request(app.getHttpServer())
      .post(`/operacao/recebimentos/${recebimentoId}/conferencia/concluir`)
      .set('Cookie', recebimentoCookies)
      .send({ resultado: 'sem_divergencia' });
    expect(falso.status).toBe(409);

    const ok = await request(app.getHttpServer())
      .post(`/operacao/recebimentos/${recebimentoId}/conferencia/concluir`)
      .set('Cookie', recebimentoCookies)
      .send({ resultado: 'com_divergencia', observacao: 'falta peça' })
      .expect(201);

    expect(ok.body.ocorrencias).toBeGreaterThanOrEqual(1);

    const ocorrencias = await db.select().from(schema.ocorrenciasFornecedor)
      .where(eq(schema.ocorrenciasFornecedor.compraProgramadaId, compraId));
    expect(ocorrencias.length).toBeGreaterThanOrEqual(1);
    expect(ocorrencias[0]!.divergenciaId).toBeTruthy();

    const vinculos = await db.select().from(schema.conclusoesConferenciaNfs)
      .where(eq(schema.conclusoesConferenciaNfs.conclusaoId, ok.body.conclusao.id));
    expect(vinculos.length).toBe(1);

    await request(app.getHttpServer())
      .post(`/operacao/recebimentos/${recebimentoId}/conferencia/concluir`)
      .set('Cookie', recebimentoCookies)
      .send({ resultado: 'com_divergencia' })
      .expect(409);
  });
});
