import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { DisponibilidadeService } from '../../src/modules/comercial/disponibilidade/disponibilidade.service';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import {
  seedComercialBase,
  criarCompraConfirmada,
  criarPedidoFornecedorEnviado,
  iniciarRecebimentoViaPf,
} from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes, criarOutroCliente } from '../helpers/pesagem-fixtures';

type Db = NodePgDatabase<typeof schema>;

describe('Onda 11 — múltiplas compras por operação', () => {
  let app: INestApplication;
  let comercialCookies: string;
  let comprasCookies: string;
  let recebimentoCookies: string;
  let gestorCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.500');
  });

  it('nenhum service muta pecas.compra_programada_id', () => {
    const src = path.resolve(__dirname, '../../src');
    const setSql = spawnSync('rg', ['-n', 'SET compra_programada_id', src], { encoding: 'utf8' });
    expect(setSql.stdout ?? '').toBe('');
    const pecasUpdate = spawnSync('rg', ['-n', '-g', '*.ts', String.raw`update\(pecas\)`, src], { encoding: 'utf8' });
    const arquivos = [...new Set(
      (pecasUpdate.stdout ?? '')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((linha) => linha.split(':')[0]!)
        .filter((p) => p.endsWith('.ts')),
    )];
    for (const arquivo of arquivos) {
      const conteudo = fs.readFileSync(arquivo, 'utf8');
      const blocos = conteudo.split(/\.update\(pecas\)/);
      for (const bloco of blocos.slice(1)) {
        const setMatch = bloco.match(/\.set\(\{[\s\S]*?\}\)/);
        expect(setMatch?.[0] ?? '').not.toMatch(/compraProgramadaId\s*:/);
      }
    }
  });

  it('confirmar carimba compra e recebimento de origem no historico', async () => {
    const c = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      await seedComercialBase(app, { fator: 1 }),
      { dataOperacao: '2026-12-30', quantidade: 6 },
    );
    const pedido = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId,
      itemComercialBaseId: c.itemComercialId,
    });
    const ok = await request(app.getHttpServer())
      .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: pedido.pedidoItemId });
    expect(ok.status).toBe(201);

    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const hist = await db.select().from(schema.associacoesPecaHistorico)
      .where(eq(schema.associacoesPecaHistorico.pecaId, pecaId));
    expect(hist.length).toBeGreaterThan(0);
    expect(hist.every((h) => h.compraProgramadaOrigemId === c.compraId)).toBe(true);
    expect(hist.every((h) => h.recebimentoOrigemId === c.recebimentoId)).toBe(true);
  });

  it('composicao-lotes agrupa 6 pecas do lote 001 e 4 do lote 002', async () => {
    const dia = '2026-12-31';
    const base = await seedComercialBase(app, { fator: 1 });
    const c1 = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: dia, quantidade: 6 },
    );
    const compra2 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 4 });
    const pf2 = await criarPedidoFornecedorEnviado(app, comprasCookies, compra2);
    const { recebimentoId: rec2 } = await iniciarRecebimentoViaPf(app, recebimentoCookies, pf2);
    const pedido = await criarPedido(app, comercialCookies, {
      compraId: c1.compraId,
      clienteId: c1.clienteId,
      itemComercialId: c1.itemComercialId,
      dataOperacao: dia,
      quantidade: 10,
    });

    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const inserir = async (n: number, compraId: string, recebimentoId: string) => {
      for (let i = 0; i < n; i += 1) {
        await db.insert(schema.pecas).values({
          compraProgramadaId: compraId,
          recebimentoId,
          itemComercialBaseId: c1.itemComercialId,
          pesoOriginal: '1.000',
          modoCapturaPeso: 'automatico',
          statusPeca: 'associada',
          pedidoVendaId: pedido.pedidoId,
          pedidoVendaItemId: pedido.pedidoItemId,
        });
      }
    };
    await inserir(6, c1.compraId, c1.recebimentoId);
    await inserir(4, compra2, rec2);

    const res = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${pedido.pedidoId}/composicao-lotes`)
      .set('Cookie', comercialCookies);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ numeroSequencial: 1, quantidadeUnidades: 6, compraProgramadaId: c1.compraId, recebimentoId: c1.recebimentoId }),
      expect.objectContaining({ numeroSequencial: 2, quantidadeUnidades: 4, compraProgramadaId: compra2, recebimentoId: rec2 }),
    ]));
    expect(res.body).toHaveLength(2);
  });

  it('composicao-lotes sem PEDIDOS_LER retorna 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/comercial/pedidos/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/composicao-lotes')
      .set('Cookie', recebimentoCookies);
    expect(res.status).toBe(403);
  });

  it('reserva FIFO 6+4 atravessa duas disponibilidades da mesma operacao', async () => {
    const dia = '2027-03-01';
    const base = await seedComercialBase(app, { fator: 1 });
    const c1 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 6 });
    const c2 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 4 });
    const pedido = await criarPedido(app, comercialCookies, {
      compraId: c1,
      clienteId: base.clienteId,
      itemComercialId: base.itemComercialId,
      dataOperacao: dia,
      quantidade: 10,
    });
    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const reservas = await db.select({
      qtd: schema.reservasDisponibilidade.quantidadeReservada,
      compraId: schema.disponibilidadesVirtuais.compraProgramadaId,
    })
      .from(schema.reservasDisponibilidade)
      .innerJoin(
        schema.disponibilidadesVirtuais,
        eq(schema.disponibilidadesVirtuais.id, schema.reservasDisponibilidade.disponibilidadeVirtualId),
      )
      .innerJoin(
        schema.pedidosVendaItens,
        eq(schema.pedidosVendaItens.id, schema.reservasDisponibilidade.pedidoVendaItemId),
      )
      .where(eq(schema.pedidosVendaItens.pedidoVendaId, pedido.pedidoId));
    expect(reservas).toHaveLength(2);
    const porCompra = new Map(reservas.map((r) => [r.compraId, Number(r.qtd)]));
    expect(porCompra.get(c1)).toBe(6);
    expect(porCompra.get(c2)).toBe(4);
  });

  it('pedido novo grava compra_programada_id NULL', async () => {
    const dia = '2027-03-02';
    const base = await seedComercialBase(app, { fator: 1 });
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 5 });
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dia,
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 2 }],
      });
    expect(res.status).toBe(201);
    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const [pv] = await db.select().from(schema.pedidosVenda).where(eq(schema.pedidosVenda.id, res.body.id));
    expect(pv?.compraProgramadaId).toBeNull();
    expect(pv?.operacaoId).toBeTruthy();
  });

  it('associação de outra operação é bloqueada', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const cA = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: '2027-03-03', quantidade: 2 },
    );
    const cB = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: '2027-03-04', quantidade: 2 },
    );
    const pedido = await criarPedido(app, comercialCookies, {
      compraId: cB.compraId,
      clienteId: cB.clienteId,
      itemComercialId: cB.itemComercialId,
      dataOperacao: cB.dataOperacao,
      quantidade: 1,
    });
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: cA.recebimentoId,
      itemComercialBaseId: cA.itemComercialId,
    });
    const res = await request(app.getHttpServer())
      .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: pedido.pedidoItemId });
    expect(res.status).toBe(409);
    const msg = typeof res.body.message === 'string' ? res.body.message : res.body.message?.message;
    expect(msg).toBe('Pedido pertence a outra operação');
  });

  it('pecas.compra_programada_id rejeita NULL e troca de UUID; UPDATE de peso passa', async () => {
    const c = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      await seedComercialBase(app, { fator: 1 }),
      { dataOperacao: '2027-03-05', quantidade: 1 },
    );
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId,
      itemComercialBaseId: c.itemComercialId,
    });
    const { db } = app.get<{ db: Db }>(DRIZZLE);
    await expect(db.execute(sql`UPDATE pecas SET compra_programada_id = NULL WHERE id = ${pecaId}::uuid`))
      .rejects.toThrow();
    const outra = await criarCompraConfirmada(app, comprasCookies, await seedComercialBase(app, { fator: 1 }), {
      dataOperacao: '2027-03-06',
      quantidade: 1,
    });
    try {
      await db.execute(sql`UPDATE pecas SET compra_programada_id = ${outra}::uuid WHERE id = ${pecaId}::uuid`);
      throw new Error('esperava rejeição do trigger de imutabilidade');
    } catch (err) {
      const cause = (err as { cause?: { message?: string } }).cause;
      expect(cause?.message ?? (err instanceof Error ? err.message : String(err)))
        .toMatch(/pecas\.compra_programada_id is immutable \(AD-14\)/);
    }
    await db.update(schema.pecas).set({ pesoOriginal: '9.000' }).where(eq(schema.pecas.id, pecaId));
    const [peca] = await db.select().from(schema.pecas).where(eq(schema.pecas.id, pecaId));
    expect(peca?.pesoOriginal).toBe('9.000');
    expect(peca?.compraProgramadaId).toBe(c.compraId);
  });

  it('AD-05 challenge 409 não muta saldo; confirmação explícita persiste', async () => {
    const dia = '2027-03-07';
    const base = await seedComercialBase(app, { fator: 1 });
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 2 });
    const challenge = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dia,
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 9 }],
      });
    expect(challenge.status).toBe(409);
    const disp = await request(app.getHttpServer())
      .get(`/comercial/disponibilidade?dataOperacao=${dia}`)
      .set('Cookie', comercialCookies);
    expect(disp.status).toBe(200);
    const linha = (disp.body as Array<{ quantidadeReservada: string }>).find(Boolean);
    expect(Number(linha?.quantidadeReservada ?? 0)).toBe(0);
    const ok = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dia,
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 9 }],
      });
    expect(ok.status).toBe(201);
  });

  it('decisão novo_pedido sem compra e com chave extra compraProgramadaId cria pedido na operação destino', async () => {
    const origemDia = '2027-03-08';
    const destDia = '2027-03-09';
    const base = await seedComercialBase(app, { fator: 1 });
    const compraOrigem = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: origemDia, quantidade: 1 });
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: destDia, quantidade: 4 });
    const over = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: await criarOutroCliente(app),
        dataOperacao: origemDia,
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 8 }],
      });
    expect(over.status).toBe(201);
    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const [pendencia] = await db.select().from(schema.pendenciasOverbooking)
      .where(eq(schema.pendenciasOverbooking.pedidoVendaId, over.body.id));
    expect(pendencia).toBeTruthy();
    const [opDest] = await db.select().from(schema.operacoes).where(eq(schema.operacoes.data, destDia));
    expect(opDest).toBeTruthy();
    const semCompra = await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendencia!.id}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'novo_pedido',
        operacaoDestinoId: opDest!.id,
        quantidade: '1.000',
      });
    expect([200, 201]).toContain(semCompra.status);
    const novoId = semCompra.body.decisaoJson?.novoPedidoId as string;
    const [novo] = await db.select().from(schema.pedidosVenda).where(eq(schema.pedidosVenda.id, novoId));
    expect(novo?.compraProgramadaId).toBeNull();
    expect(novo?.operacaoId).toBe(opDest!.id);

    const compraOrigem2 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: origemDia, quantidade: 1 });
    const over2 = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: await criarOutroCliente(app),
        dataOperacao: origemDia,
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 8 }],
      });
    const [pendencia2] = await db.select().from(schema.pendenciasOverbooking)
      .where(eq(schema.pendenciasOverbooking.pedidoVendaId, over2.body.id));
    const comExtra = await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendencia2!.id}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'novo_pedido',
        operacaoDestinoId: opDest!.id,
        quantidade: '1.000',
        compraProgramadaId: compraOrigem2,
      });
    expect([200, 201]).toContain(comExtra.status);
    const novo2Id = comExtra.body.decisaoJson?.novoPedidoId as string;
    const [novo2] = await db.select().from(schema.pedidosVenda).where(eq(schema.pedidosVenda.id, novo2Id));
    expect(novo2?.compraProgramadaId).toBeNull();
    void compraOrigem;
  });

  it('disponibilidade agregada soma lotes; detalhe por compra não mistura', async () => {
    const dia = '2027-03-10';
    const base = await seedComercialBase(app, { fator: 1 });
    const c1 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 6 });
    const c2 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 4 });
    const agregado = await request(app.getHttpServer())
      .get(`/comercial/disponibilidade?dataOperacao=${dia}`)
      .set('Cookie', comercialCookies);
    expect(agregado.status).toBe(200);
    const linha = (agregado.body as Array<{ itemComercialId: string; quantidadeDisponivel: string; modo?: string }>)
      .find((d) => d.itemComercialId === base.itemComercialId);
    expect(Number(linha?.quantidadeDisponivel)).toBe(10);
    const det1 = await request(app.getHttpServer())
      .get(`/comercial/disponibilidade?compraProgramadaId=${c1}`)
      .set('Cookie', comercialCookies);
    const det2 = await request(app.getHttpServer())
      .get(`/comercial/disponibilidade?compraProgramadaId=${c2}`)
      .set('Cookie', comercialCookies);
    expect(Number((det1.body as Array<{ quantidadeDisponivel: string }>)[0]?.quantidadeDisponivel)).toBe(6);
    expect(Number((det2.body as Array<{ quantidadeDisponivel: string }>)[0]?.quantidadeDisponivel)).toBe(4);
  });

  it('score dá bônus só à reserva coberta pelo lote de origem', async () => {
    const dia = '2027-03-11';
    const base = await seedComercialBase(app, { fator: 1 });
    const c1 = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: dia, quantidade: 6 },
    );
    const compra2 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 4 });
    const pf2 = await criarPedidoFornecedorEnviado(app, comprasCookies, compra2);
    const { recebimentoId: rec2 } = await iniciarRecebimentoViaPf(app, recebimentoCookies, pf2);
    const pedido = await criarPedido(app, comercialCookies, {
      compraId: c1.compraId,
      clienteId: c1.clienteId,
      itemComercialId: c1.itemComercialId,
      dataOperacao: dia,
      quantidade: 5,
    });
    const pecaLote1 = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c1.recebimentoId,
      itemComercialBaseId: c1.itemComercialId,
    });
    const pecaLote2 = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: rec2,
      itemComercialBaseId: c1.itemComercialId,
    });
    const sug1 = await request(app.getHttpServer())
      .get(`/operacao/pesagem/pecas/${pecaLote1}/sugestao`)
      .set('Cookie', recebimentoCookies);
    const sug2 = await request(app.getHttpServer())
      .get(`/operacao/pesagem/pecas/${pecaLote2}/sugestao`)
      .set('Cookie', recebimentoCookies);
    expect(sug1.status).toBe(200);
    expect(sug2.status).toBe(200);
    const cand1 = (sug1.body.compativeis as Array<{
      pedidoVendaItemId: string; score: number; justificativa: string;
    }>).find((c) => c.pedidoVendaItemId === pedido.pedidoItemId);
    const cand2 = (sug2.body.compativeis as Array<{
      pedidoVendaItemId: string; score: number; justificativa: string;
    }>).find((c) => c.pedidoVendaItemId === pedido.pedidoItemId);
    expect(cand1).toBeTruthy();
    expect(cand2).toBeTruthy();
    expect(cand1!.score).toBe(cand2!.score + 5);
    expect(cand1!.justificativa).toContain('reserva coberta pelo lote de origem');
    expect(cand2!.justificativa).not.toContain('reserva coberta pelo lote de origem');
  });

  it('mapa V soma disponibilidade de duas compras da mesma operacao', async () => {
    const dia = '2027-03-12';
    const base = await seedComercialBase(app, { fator: 1 });
    const c1 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 6 });
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 4 });
    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const [compra] = await db.select({ operacaoId: schema.comprasProgramadas.operacaoId })
      .from(schema.comprasProgramadas)
      .where(eq(schema.comprasProgramadas.id, c1));
    const mapa = await request(app.getHttpServer())
      .get(`/comercial/disponibilidade/mapa?operacaoId=${compra!.operacaoId}`)
      .set('Cookie', comercialCookies);
    expect(mapa.status).toBe(200);
    const linha = (mapa.body as Array<{ itemComercialId: string; estados: { V: string } }>)
      .find((l) => l.itemComercialId === base.itemComercialId);
    expect(linha?.estados.V).toBe('10.000');
  });

  it('risco no escopo da operacao: 4+6 recebido nao gera falso positivo; 9 gera risco', async () => {
    const dia = '2027-03-13';
    const base = await seedComercialBase(app, { fator: 1 });
    const c1 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 6 });
    const c2 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 4 });
    await criarPedido(app, comercialCookies, {
      compraId: c1,
      clienteId: base.clienteId,
      itemComercialId: base.itemComercialId,
      dataOperacao: dia,
      quantidade: 10,
    });
    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const [op] = await db.select().from(schema.operacoes).where(eq(schema.operacoes.data, dia));
    expect(op).toBeTruthy();
    const disp = app.get(DisponibilidadeService);
    await db.transaction(async (tx) => {
      await disp.aplicarRecebimentoDelta(tx, {
        compraProgramadaId: c1,
        itemComercialId: base.itemComercialId,
        deltaRecebido: '4',
        deltaComDivergencia: '0',
      });
      await disp.aplicarRecebimentoDelta(tx, {
        compraProgramadaId: c2,
        itemComercialId: base.itemComercialId,
        deltaRecebido: '6',
        deltaComDivergencia: '0',
      });
    });
    const semRisco = await db.transaction((tx) =>
      disp.listarPedidosEmRisco(tx, op!.id, base.itemComercialId),
    );
    expect(semRisco).toEqual([]);
    await db.transaction(async (tx) => {
      await disp.aplicarRecebimentoDelta(tx, {
        compraProgramadaId: c2,
        itemComercialId: base.itemComercialId,
        deltaRecebido: '-1',
        deltaComDivergencia: '0',
      });
    });
    const comRisco = await db.transaction((tx) =>
      disp.listarPedidosEmRisco(tx, op!.id, base.itemComercialId),
    );
    expect(comRisco.length).toBeGreaterThan(0);
  });

  it('conferencia tripla de dois lotes da mesma operacao e independente', async () => {
    const dia = '2027-03-14';
    const base = await seedComercialBase(app, { fator: 1 });
    const c1 = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: dia, quantidade: 6 },
    );
    const compra2 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 4 });
    const pf2 = await criarPedidoFornecedorEnviado(app, comprasCookies, compra2);
    const { recebimentoId: rec2 } = await iniciarRecebimentoViaPf(app, recebimentoCookies, pf2);

    const concluir = async (recebimentoId: string, pfId: string, qtd: number) => {
      const { db } = app.get<{ db: Db }>(DRIZZLE);
      await request(app.getHttpServer())
        .post(`/operacao/pedidos-fornecedor/${pfId}/nf`)
        .set('Cookie', recebimentoCookies)
        .send({
          numero: `NF-${qtd}-${recebimentoId.slice(0, 8)}`,
          recebimentoId,
          itens: [{ itemComercialId: base.itemComercialId, quantidadeDeclarada: qtd }],
        });
      await request(app.getHttpServer())
        .post(`/operacao/recebimentos/${recebimentoId}/itens`)
        .set('Cookie', recebimentoCookies)
        .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: qtd });
      await db.update(schema.recebimentosItens)
        .set({ requerBalanca: false, statusApuracao: 'entrada_direta' })
        .where(eq(schema.recebimentosItens.recebimentoId, recebimentoId));
      const conc = await request(app.getHttpServer())
        .post(`/operacao/recebimentos/${recebimentoId}/concluir`)
        .set('Cookie', recebimentoCookies)
        .send();
      expect(conc.status).toBe(201);
      const conf = await request(app.getHttpServer())
        .post(`/operacao/recebimentos/${recebimentoId}/conferencia/concluir`)
        .set('Cookie', recebimentoCookies)
        .send({ resultado: 'sem_divergencia' });
      expect(conf.status).toBe(201);
    };

    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const [rec1] = await db.select().from(schema.recebimentos).where(eq(schema.recebimentos.id, c1.recebimentoId));
    await concluir(c1.recebimentoId, rec1!.pedidoFornecedorId, 6);

    const det2Antes = await request(app.getHttpServer())
      .get(`/operacao/recebimentos/${rec2}`)
      .set('Cookie', recebimentoCookies);
    expect(det2Antes.status).toBe(200);
    expect(det2Antes.body.status).not.toMatch(/conferido/);

    const [rec2row] = await db.select().from(schema.recebimentos).where(eq(schema.recebimentos.id, rec2));
    await concluir(rec2, rec2row!.pedidoFornecedorId, 4);

    const det1 = await request(app.getHttpServer())
      .get(`/operacao/recebimentos/${c1.recebimentoId}`)
      .set('Cookie', recebimentoCookies);
    const det2 = await request(app.getHttpServer())
      .get(`/operacao/recebimentos/${rec2}`)
      .set('Cookie', recebimentoCookies);
    expect(det1.body.status).toMatch(/conferido/);
    expect(det2.body.status).toMatch(/conferido/);
    expect(det1.body.id).not.toBe(det2.body.id);
  });

});
