import type { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import {
  montarCenarioPesagem,
  criarPedido,
  pesarPeca,
  associarPeca,
  pecaAssociadaComEtiqueta,
  fakes,
  type CenarioPesagem,
} from '../helpers/pesagem-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { EtiquetaService } from '../../src/modules/operacao/pesagem/etiqueta.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

describe('Troca de Peça e2e (v1.1 §6.13 + P10)', () => {
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

  async function montarPecasParaTroca(dataOperacao: string) {
    const c = await cenario(dataOperacao);
    const { pedidoId, pedidoItemId } = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });
    const pecaRetiradaId = await pecaAssociadaComEtiqueta(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId,
      itemComercialBaseId: c.itemComercialId,
      pedidoVendaItemId: pedidoItemId,
      peso: '12.500',
    });
    const pecaInseridaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId,
      itemComercialBaseId: c.itemComercialId,
      peso: '13.100',
    });
    return { c, pedidoId, pedidoItemId, pecaRetiradaId, pecaInseridaId };
  }

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.500');
    fakes(app).impressora.definirStatus('disponivel');
  });

  it('executa os 9 passos da §6.13 em uma transação', async () => {
    const { default: request } = await import('supertest');
    const { pedidoItemId, pecaRetiradaId, pecaInseridaId } = await montarPecasParaTroca('2026-09-01');

    const itemAntes = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, pedidoItemId))
      .then((r) => r[0]!);

    const res = await request(srv()).post('/operacao/pesagem/trocas').set('Cookie', recebimentoCookies).send({
      pecaRetiradaId,
      pecaInseridaId,
      pedidoVendaItemId: pedidoItemId,
      destinoRetirada: 'estoque',
      motivo: 'peca_mais_adequada',
    });
    expect(res.status).toBe(201);

    const retirada = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaRetiradaId)).then((r) => r[0]!);
    const inserida = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaInseridaId)).then((r) => r[0]!);
    expect(retirada.statusPeca).toBe('em_sobra');
    expect(retirada.pedidoVendaItemId).toBeNull();
    expect(inserida.statusPeca).toBe('associada');
    expect(inserida.pedidoVendaItemId).toBe(pedidoItemId);

    const troca = await db().select().from(schema.trocasPeca).where(eq(schema.trocasPeca.pecaRetiradaId, pecaRetiradaId)).then((r) => r[0]!);
    expect(troca).toBeDefined();
    expect(troca.pecaInseridaId).toBe(pecaInseridaId);

    const hist = await db().select().from(schema.associacoesPecaHistorico);
    expect(hist.some((h) => h.pecaId === pecaRetiradaId && h.acao === 'troca_saida')).toBe(true);
    expect(hist.some((h) => h.pecaId === pecaInseridaId && h.acao === 'troca_entrada')).toBe(true);

    const itemDepois = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, pedidoItemId))
      .then((r) => r[0]!);
    expect(itemDepois.quantidadeAtendida).toBe(itemAntes.quantidadeAtendida);
  });

  it('preserva peso_original da peça retirada e da inserida', async () => {
    const { default: request } = await import('supertest');
    const { pedidoItemId, pecaRetiradaId, pecaInseridaId } = await montarPecasParaTroca('2026-09-02');
    const pesoRet = (await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaRetiradaId)).then((r) => r[0]!)).pesoOriginal;
    const pesoIns = (await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaInseridaId)).then((r) => r[0]!)).pesoOriginal;

    const res = await request(srv()).post('/operacao/pesagem/trocas').set('Cookie', recebimentoCookies).send({
      pecaRetiradaId,
      pecaInseridaId,
      pedidoVendaItemId: pedidoItemId,
      destinoRetirada: 'desossa',
      motivo: 'qualidade',
    });
    expect(res.status).toBe(201);

    const retirada = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaRetiradaId)).then((r) => r[0]!);
    const inserida = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaInseridaId)).then((r) => r[0]!);
    expect(retirada.pesoOriginal).toBe(pesoRet);
    expect(inserida.pesoOriginal).toBe(pesoIns);
    expect(retirada.statusPeca).toBe('para_corte');
  });

  it('falha ao emitir a nova etiqueta faz rollback total (trocas_peca vazia)', async () => {
    const { default: request } = await import('supertest');
    const { pedidoItemId, pecaRetiradaId, pecaInseridaId } = await montarPecasParaTroca('2026-09-03');

    const etiquetaAntes = await db()
      .select()
      .from(schema.etiquetasImpressoes)
      .where(eq(schema.etiquetasImpressoes.pecaId, pecaRetiradaId))
      .then((r) => r[0]!);
    const retiradaAntes = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaRetiradaId)).then((r) => r[0]!);
    const inseridaAntes = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaInseridaId)).then((r) => r[0]!);

    const etiquetaService = app.get(EtiquetaService);
    const spy = jest.spyOn(etiquetaService, 'emitirNaTx').mockRejectedValueOnce(new Error('impressao falhou'));
    const emitter = app.get(EventEmitter2);
    const emitSpy = jest.spyOn(emitter, 'emit');

    const res = await request(srv()).post('/operacao/pesagem/trocas').set('Cookie', recebimentoCookies).send({
      pecaRetiradaId,
      pecaInseridaId,
      pedidoVendaItemId: pedidoItemId,
      destinoRetirada: 'estoque',
      motivo: 'erro_associacao',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);

    // Escopo às peças deste caso — testes anteriores no mesmo DB já deixam trocas legítimas.
    const trocasDestaTentativa = await db()
      .select()
      .from(schema.trocasPeca)
      .where(
        and(
          eq(schema.trocasPeca.pecaRetiradaId, pecaRetiradaId),
          eq(schema.trocasPeca.pecaInseridaId, pecaInseridaId),
        ),
      );
    expect(trocasDestaTentativa).toHaveLength(0);

    const etiquetaDepois = await db()
      .select()
      .from(schema.etiquetasImpressoes)
      .where(eq(schema.etiquetasImpressoes.id, etiquetaAntes.id))
      .then((r) => r[0]!);
    expect(etiquetaDepois.estado).toBe(etiquetaAntes.estado);
    expect(etiquetaDepois.estado).not.toBe('invalidada_por_troca');

    const retiradaDepois = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaRetiradaId)).then((r) => r[0]!);
    const inseridaDepois = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaInseridaId)).then((r) => r[0]!);
    expect(retiradaDepois.statusPeca).toBe(retiradaAntes.statusPeca);
    expect(retiradaDepois.pedidoVendaItemId).toBe(retiradaAntes.pedidoVendaItemId);
    expect(inseridaDepois.statusPeca).toBe(inseridaAntes.statusPeca);
    expect(inseridaDepois.pedidoVendaItemId).toBe(inseridaAntes.pedidoVendaItemId);

    expect(emitSpy).not.toHaveBeenCalledWith(EVENTOS.PECA_TROCADA, expect.anything());
    spy.mockRestore();
    emitSpy.mockRestore();
  });

  it('invalida a etiqueta anterior e emite a nova', async () => {
    const { default: request } = await import('supertest');
    const { pedidoItemId, pecaRetiradaId, pecaInseridaId } = await montarPecasParaTroca('2026-09-04');
    const etiquetaAnterior = await db()
      .select()
      .from(schema.etiquetasImpressoes)
      .where(eq(schema.etiquetasImpressoes.pecaId, pecaRetiradaId))
      .then((r) => r[0]!);

    const res = await request(srv()).post('/operacao/pesagem/trocas').set('Cookie', recebimentoCookies).send({
      pecaRetiradaId,
      pecaInseridaId,
      pedidoVendaItemId: pedidoItemId,
      destinoRetirada: 'estoque',
      motivo: 'peso_fora_preferencia',
    });
    expect(res.status).toBe(201);

    const invalidada = await db()
      .select()
      .from(schema.etiquetasImpressoes)
      .where(eq(schema.etiquetasImpressoes.id, etiquetaAnterior.id))
      .then((r) => r[0]!);
    expect(invalidada.estado).toBe('invalidada_por_troca');

    const nova = await db()
      .select()
      .from(schema.etiquetasImpressoes)
      .where(eq(schema.etiquetasImpressoes.pecaId, pecaInseridaId))
      .then((r) => r[0]!);
    expect(nova).toBeDefined();
    expect(['emitida', 'ativa']).toContain(nova.estado);
  });

  it('rejeita 422 sem motivo e com destino fora de estoque/desossa', async () => {
    const { default: request } = await import('supertest');
    const { pedidoItemId, pecaRetiradaId, pecaInseridaId } = await montarPecasParaTroca('2026-09-05');

    const semMotivo = await request(srv()).post('/operacao/pesagem/trocas').set('Cookie', recebimentoCookies).send({
      pecaRetiradaId,
      pecaInseridaId,
      pedidoVendaItemId: pedidoItemId,
      destinoRetirada: 'estoque',
    });
    expect(semMotivo.status).toBe(400);

    const destinoInvalido = await request(srv()).post('/operacao/pesagem/trocas').set('Cookie', recebimentoCookies).send({
      pecaRetiradaId,
      pecaInseridaId,
      pedidoVendaItemId: pedidoItemId,
      destinoRetirada: 'cliente',
      motivo: 'qualidade',
    });
    expect(destinoInvalido.status).toBe(400);
  });

  it('403 para perfil sem ASSOCIACAO_GERENCIAR', async () => {
    const { default: request } = await import('supertest');
    const { pedidoItemId, pecaRetiradaId, pecaInseridaId } = await montarPecasParaTroca('2026-09-06');

    const res = await request(srv()).post('/operacao/pesagem/trocas').set('Cookie', comprasCookies).send({
      pecaRetiradaId,
      pecaInseridaId,
      pedidoVendaItemId: pedidoItemId,
      destinoRetirada: 'estoque',
      motivo: 'qualidade',
    });
    expect(res.status).toBe(403);
  });

  it('troca com peça em carga aberta registra pendência física referenciando a troca', async () => {
    const { default: request } = await import('supertest');
    const { c, pedidoId, pedidoItemId, pecaRetiradaId, pecaInseridaId } = await montarPecasParaTroca('2026-09-07');

    const recebimento = await db()
      .select()
      .from(schema.recebimentos)
      .where(eq(schema.recebimentos.id, c.recebimentoId))
      .then((r) => r[0]!);
    const [caminhao] = await db()
      .insert(schema.caminhoes)
      .values({
        placa: `ABJ${Date.now().toString().slice(-4)}`,
        motorista: 'Motorista P10',
        operacaoId: recebimento.operacaoId,
        statusCaminhao: 'em_carga',
      })
      .returning();
    await db().insert(schema.cargaItens).values({
      caminhaoId: caminhao!.id,
      tipoOrigem: 'peca',
      pecaId: pecaRetiradaId,
      pedidoVendaId: pedidoId,
      pedidoVendaItemId: pedidoItemId,
      statusCargaItem: 'em_carga',
      conferido: false,
    });

    const res = await request(srv()).post('/operacao/pesagem/trocas').set('Cookie', recebimentoCookies).send({
      pecaRetiradaId,
      pecaInseridaId,
      pedidoVendaItemId: pedidoItemId,
      destinoRetirada: 'estoque',
      motivo: 'peca_mais_adequada',
    });
    expect(res.status).toBe(201);

    const troca = await db()
      .select()
      .from(schema.trocasPeca)
      .where(eq(schema.trocasPeca.pecaRetiradaId, pecaRetiradaId))
      .then((r) => r[0]!);
    const pendencias = await db()
      .select()
      .from(schema.aprovacoesOperacionais)
      .where(
        and(
          eq(schema.aprovacoesOperacionais.referenciaTabela, 'trocas_peca'),
          eq(schema.aprovacoesOperacionais.referenciaId, troca.id),
        ),
      );
    expect(pendencias).toHaveLength(1);
    expect(pendencias[0]!.tipo).toBe('pendencia_fisica_etiqueta');
    expect(pendencias[0]!.status).toBe('pendente');
  });

  it('troca com peça nunca carregada não cria pendência física', async () => {
    const { default: request } = await import('supertest');
    const { pedidoItemId, pecaRetiradaId, pecaInseridaId } = await montarPecasParaTroca('2026-09-08');

    const res = await request(srv()).post('/operacao/pesagem/trocas').set('Cookie', recebimentoCookies).send({
      pecaRetiradaId,
      pecaInseridaId,
      pedidoVendaItemId: pedidoItemId,
      destinoRetirada: 'estoque',
      motivo: 'peca_mais_adequada',
    });
    expect(res.status).toBe(201);

    const troca = await db()
      .select()
      .from(schema.trocasPeca)
      .where(eq(schema.trocasPeca.pecaRetiradaId, pecaRetiradaId))
      .then((r) => r[0]!);
    const pendencias = await db()
      .select()
      .from(schema.aprovacoesOperacionais)
      .where(
        and(
          eq(schema.aprovacoesOperacionais.referenciaTabela, 'trocas_peca'),
          eq(schema.aprovacoesOperacionais.referenciaId, troca.id),
        ),
      );
    expect(pendencias).toHaveLength(0);
  });
});
