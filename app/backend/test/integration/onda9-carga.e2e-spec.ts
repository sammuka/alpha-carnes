import type { INestApplication } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes, type CenarioPesagem } from '../helpers/pesagem-fixtures';
import {
  criarCaminhao, abrirCarga, vincularPedido, adicionarPecaNaCarga,
  iniciarConferencia, concluirConferencia, fecharCaminhao,
} from '../helpers/expedicao-fixtures';
import { iniciarCorte, subitemCompleto } from '../helpers/corte-fixtures';
import { ConferenciaService } from '../../src/modules/operacao/expedicao/conferencia.service';
import { EVENTOS } from '../../src/realtime/events/eventos';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { frotaCaminhoes } from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Onda 9 — Carga e2e (DoD 9.1–9.10)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;
  let corteCookies: string;
  let expedicaoCookies: string;
  let comercialPerfilCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    const expedicao = await createTestUser(app, { perfil: 'expedicao' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    corteCookies = await loginCookies(app, corte.adminEmail, corte.adminPassword);
    expedicaoCookies = await loginCookies(app, expedicao.adminEmail, expedicao.adminPassword);
    comercialPerfilCookies = comercialCookies;
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

  /** Cria uma peça 'associada' + com etiqueta (elegível para carga). */
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

  /** Cria um subitem 'associado' + com etiqueta (elegível para carga). */
  async function subitemElegivel(c: CenarioPesagem, pecaId: string, pedidoItemId: string): Promise<string> {
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    fakes(app).balanca.definirPeso('6.000');
    return subitemCompleto(app, corteCookies, transfId, c.itemComercialId, pedidoItemId);
  }

  /** Insere caminhão de frota diretamente via Drizzle (fixture — padrão do repo). */
  async function criarFrota(placa: string, capacidadeKg: number): Promise<string> {
    const [frota] = await db()
      .insert(frotaCaminhoes)
      .values({ placa, capacidadeKg, status: 'ativo' })
      .returning();
    if (!frota) throw new Error('Falha ao criar frota fixture');
    return frota.id;
  }

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.500');
    fakes(app).impressora.definirStatus('disponivel');
    fakes(app).leitor.definirStatus('disponivel');
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('DoD 9.1 caminhão vinculado à frota herda placa e capacidade', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2027-01-01');
    const frotaId = await criarFrota('FRT-0001', 5000);

    const comFrota = await request(srv())
      .post('/operacao/expedicao/caminhoes')
      .set('Cookie', expedicaoCookies)
      .send({ frotaCaminhaoId: frotaId, motorista: 'Motorista Frota', dataOperacao: c.dataOperacao });
    expect(comFrota.status).toBe(201);
    expect(comFrota.body.placa).toBe('FRT-0001');
    expect(comFrota.body.frotaCaminhaoId).toBe(frotaId);

    const listaComFrota = await request(srv())
      .get(`/operacao/expedicao/caminhoes?dataOperacao=${c.dataOperacao}`)
      .set('Cookie', expedicaoCookies);
    const itemComFrota = (listaComFrota.body as Array<{ id: string; capacidadeKg: number | null }>).find(
      (x) => x.id === comFrota.body.id,
    );
    expect(itemComFrota?.capacidadeKg).toBe(5000);

    const semFrota = await request(srv())
      .post('/operacao/expedicao/caminhoes')
      .set('Cookie', expedicaoCookies)
      .send({ placa: 'AVU-9999', motorista: 'Motorista Avulso', dataOperacao: c.dataOperacao });
    expect(semFrota.status).toBe(201);

    const listaSemFrota = await request(srv())
      .get(`/operacao/expedicao/caminhoes?dataOperacao=${c.dataOperacao}`)
      .set('Cookie', expedicaoCookies);
    const itemSemFrota = (listaSemFrota.body as Array<{ id: string; capacidadeKg: number | null }>).find(
      (x) => x.id === semFrota.body.id,
    );
    expect(itemSemFrota?.capacidadeKg).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('DoD 9.2 leitura de cargas respeita EXPEDICAO_LER', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2027-01-02');
    const conferente = await createTestUser(app, { perfil: 'conferente' });
    const conferenteCookies = await loginCookies(app, conferente.adminEmail, conferente.adminPassword);

    const okConferente = await request(srv())
      .get(`/operacao/expedicao/caminhoes?dataOperacao=${c.dataOperacao}`)
      .set('Cookie', conferenteCookies);
    expect(okConferente.status).toBe(200);

    const negadoComercial = await request(srv())
      .get(`/operacao/expedicao/caminhoes?dataOperacao=${c.dataOperacao}`)
      .set('Cookie', comercialPerfilCookies);
    expect(negadoComercial.status).toBe(403);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('DoD 9.3 marcar divergência em item pendente e rejeitar em conferido', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2027-01-03');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const peca1 = await pecaElegivel(c, p.pedidoItemId);
    const peca2 = await pecaElegivel(c, p.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${peca2}`);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const item1Id = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, peca1);
    const item2Id = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, peca2);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);

    // Marca item1 como divergente (ainda em_carga)
    const divergenciaRes = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/divergencia`)
      .set('Cookie', expedicaoCookies)
      .send({ cargaItemId: item1Id, motivo: 'peca_ausente', observacao: 'não encontrada no caminhão' });
    expect(divergenciaRes.status).toBe(201);
    expect(divergenciaRes.body.statusCargaItem).toBe('divergente');
    expect(divergenciaRes.body.divergenciaMotivo).toBe('peca_ausente');

    // Confere item2 via QR
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });

    // Tentar marcar divergência em item já conferido -> 409 ITEM_NAO_PENDENTE, sem efeito
    const jaConferidoAntes = await db()
      .select()
      .from(schema.cargaItens)
      .where(eq(schema.cargaItens.id, item2Id))
      .then((r) => r[0]!);
    expect(jaConferidoAntes.statusCargaItem).toBe('conferido');

    const rejeitado = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/divergencia`)
      .set('Cookie', expedicaoCookies)
      .send({ cargaItemId: item2Id, motivo: 'peca_errada' });
    expect(rejeitado.status).toBe(409);
    expect(rejeitado.body.message?.codigo ?? rejeitado.body.codigo).toBe('ITEM_NAO_PENDENTE');

    const jaConferidoDepois = await db()
      .select()
      .from(schema.cargaItens)
      .where(eq(schema.cargaItens.id, item2Id))
      .then((r) => r[0]!);
    expect(jaConferidoDepois.statusCargaItem).toBe('conferido'); // sem efeito
    expect(jaConferidoDepois.divergenciaMotivo).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('DoD 9.4 conferência conclui com divergentes registrados em pendencias', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2027-01-04');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const peca1 = await pecaElegivel(c, p.pedidoItemId);
    const peca2 = await pecaElegivel(c, p.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${peca2}`);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const item1Id = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, peca1);
    await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, peca2);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);

    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/divergencia`)
      .set('Cookie', expedicaoCookies)
      .send({ cargaItemId: item1Id, motivo: 'avaria' });
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });

    const concluir = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/concluir`)
      .set('Cookie', expedicaoCookies)
      .send();
    expect(concluir.status).toBe(201);
    expect(concluir.body.pendencias.totalFaltas).toBe(0);
    expect(concluir.body.pendencias.totalDivergentes).toBe(1);
    expect(concluir.body.pendencias.divergentes[0].cargaItemId).toBe(item1Id);
    expect(concluir.body.pendencias.divergentes[0].motivo).toBe('avaria');
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('DoD 9.5 faltas continuam registradas ao concluir', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2027-01-05');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const peca1 = await pecaElegivel(c, p.pedidoItemId);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const item1Id = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, peca1);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);
    // Não confere nem marca divergência — item permanece em_carga

    const concluir = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/concluir`)
      .set('Cookie', expedicaoCookies)
      .send();
    expect(concluir.status).toBe(201);
    expect(concluir.body.pendencias.totalFaltas).toBe(1);
    expect(concluir.body.pendencias.faltas[0].cargaItemId).toBe(item1Id);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('DoD 9.6 fechamento congela bipagem e divergência', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2027-01-06');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const peca1 = await pecaElegivel(c, p.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${peca1}`);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    const item1Id = await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, peca1);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
    await concluirConferencia(app, expedicaoCookies, caminhaoId);
    await fecharCaminhao(app, expedicaoCookies, caminhaoId);

    const registrarPosFechamento = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
    expect(registrarPosFechamento.status).toBe(409);

    const divergenciaPosFechamento = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/divergencia`)
      .set('Cookie', expedicaoCookies)
      .send({ cargaItemId: item1Id, motivo: 'outro' });
    expect(divergenciaPosFechamento.status).toBe(409);

    const peca2 = await pecaElegivel(c, p.pedidoItemId);
    const adicionarItemPosFechamento = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', id: peca2 });
    expect(adicionarItemPosFechamento.status).toBe(409);
  }, 60000);

  // ──────────────────────────────────────────────────────────────────────────
  it('DoD 9.7 enviar para faturamento aceita expedição e rejeita sem permissão', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2027-01-07');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pecaElegivel(c, p.pedidoItemId);
    fakes(app).leitor.definirCodigo(`QR-${pecaId}`);

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
    await concluirConferencia(app, expedicaoCookies, caminhaoId);
    await fecharCaminhao(app, expedicaoCookies, caminhaoId);

    const negado = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/liberar-faturamento`)
      .set('Cookie', comercialPerfilCookies)
      .send();
    expect(negado.status).toBe(403);

    const antes = await db()
      .select()
      .from(schema.caminhoes)
      .where(eq(schema.caminhoes.id, caminhaoId))
      .then((r) => r[0]!);
    expect(antes.horaLiberacao).toBeNull();

    const liberado = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/liberar-faturamento`)
      .set('Cookie', expedicaoCookies)
      .send();
    expect(liberado.status).toBe(201);
    expect(liberado.body.statusCaminhao).toBe('liberado_faturamento');

    const depois = await db()
      .select()
      .from(schema.caminhoes)
      .where(eq(schema.caminhoes.id, caminhaoId))
      .then((r) => r[0]!);
    expect(depois.horaLiberacao).not.toBeNull();
  }, 60000);

  // ──────────────────────────────────────────────────────────────────────────
  it('DoD 9.8 listagem de envio agrega pesos por tipo de origem', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2027-01-08');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 5,
    });
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId, peso: '20.000',
    });
    await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: p.pedidoItemId });
    await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`)
      .set('Cookie', recebimentoCookies)
      .send();

    // 2ª peça, usada como origem do subitem (mantém a 1ª como item de carga tipo 'peca')
    const pecaOrigemSub = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId, peso: '15.000',
    });
    await request(srv())
      .post(`/operacao/pesagem/pecas/${pecaOrigemSub}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: p.pedidoItemId });
    const subId = await subitemElegivel(c, pecaOrigemSub, p.pedidoItemId);
    const subitemPeso = await db()
      .select({ peso: schema.subitens.peso })
      .from(schema.subitens)
      .where(eq(schema.subitens.id, subId))
      .then((r) => Number(r[0]!.peso));

    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    await adicionarPecaNaCarga(app, expedicaoCookies, caminhaoId, pecaId);
    await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'subitem', id: subId });
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);

    const listagem = await request(srv())
      .get(`/operacao/expedicao/envio-faturamento?dataOperacao=${c.dataOperacao}`)
      .set('Cookie', expedicaoCookies);
    expect(listagem.status).toBe(200);
    const carga = (listagem.body as Array<{ id: string; pesoTotal: string; totalPecas: number }>).find(
      (x) => x.id === caminhaoId,
    );
    expect(carga).toBeDefined();
    expect(carga!.totalPecas).toBe(2);
    const pesoEsperado = (20 + subitemPeso).toFixed(3);
    expect(Number(carga!.pesoTotal)).toBeCloseTo(Number(pesoEsperado), 3);
  }, 60000);

  // ──────────────────────────────────────────────────────────────────────────
  it('DoD 9.9 divergência emite evento só após commit', async () => {
    const events = new EventEmitter2();
    const spy = jest.spyOn(events, 'emit').mockImplementation(((..._args: unknown[]) => true) as never);

    const caminhaoServiceStub = {
      caminhaoAtivo: jest.fn(async () => ({ id: 'cam1', statusCaminhao: 'em_conferencia', operacaoId: 'op1' })),
      dataOperacaoDoCaminhao: jest.fn(async () => '2027-01-09'),
    };

    const conferenciaCarga = { id: 'conf1', statusConferencia: 'aberta' };
    const itemCarga = { id: 'item1', statusCargaItem: 'em_carga', caminhaoId: 'cam1' };

    function montarSelectChain(resultado: unknown) {
      return {
        from: () => ({
          where: () => ({
            then: (cb: (r: unknown[]) => unknown) => Promise.resolve(cb(resultado ? [resultado] : [])),
          }),
        }),
      };
    }

    const dbMockRollback = {
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        let chamada = 0;
        const tx = {
          select: () => {
            chamada += 1;
            if (chamada === 1) return montarSelectChain(conferenciaCarga);
            return montarSelectChain(itemCarga);
          },
          update: () => ({
            set: () => ({
              where: () => ({
                returning: async () => [{ ...itemCarga, statusCargaItem: 'divergente' }],
              }),
            }),
          }),
        };
        return fn(tx);
      },
    };

    const auditoriaLanca = { registrar: jest.fn(async () => { throw new ConflictException('auditoria falhou'); }) };

    const serviceRollback = new ConferenciaService(
      { db: dbMockRollback } as never,
      auditoriaLanca as never,
      events,
      caminhaoServiceStub as never,
      {} as never,
    );

    await expect(
      serviceRollback.divergencia('cam1', { cargaItemId: 'item1', motivo: 'outro' } as never, { sub: 'u1' } as never),
    ).rejects.toBeTruthy();
    expect(spy.mock.calls.filter((call) => call[0] === EVENTOS.CARGA_ITEM_DIVERGENTE)).toHaveLength(0);

    // Commit: auditoria não lança -> emite exatamente 1 vez.
    const auditoriaOk = { registrar: jest.fn(async () => undefined) };
    const dbMockCommit = {
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        let chamada = 0;
        const tx = {
          select: () => {
            chamada += 1;
            if (chamada === 1) return montarSelectChain(conferenciaCarga);
            return montarSelectChain(itemCarga);
          },
          update: () => ({
            set: () => ({
              where: () => ({
                returning: async () => [{ ...itemCarga, statusCargaItem: 'divergente', divergenciaMotivo: 'outro' }],
              }),
            }),
          }),
        };
        return fn(tx);
      },
    };
    const serviceCommit = new ConferenciaService(
      { db: dbMockCommit } as never,
      auditoriaOk as never,
      events,
      caminhaoServiceStub as never,
      {} as never,
    );
    await serviceCommit.divergencia('cam1', { cargaItemId: 'item1', motivo: 'outro' } as never, { sub: 'u1' } as never);
    expect(spy.mock.calls.filter((call) => call[0] === EVENTOS.CARGA_ITEM_DIVERGENTE)).toHaveLength(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  it('DoD 9.10 conferência manual exige LEITURA_MANUAL', async () => {
    // Redação da Emenda 1 (Task 9 Step 2): todos os perfis canônicos com
    // EXPEDICAO_GERENCIAR também têm LEITURA_MANUAL (permissoes.ts) — logo o 403
    // por falta de LEITURA_MANUAL é intestável por perfil canônico. O `it` prova
    // o contrato ADR-009 pelo caminho Zod: manual_assistido sem codigo/motivo
    // deve retornar 400 com as duas issues.
    const { default: request } = await import('supertest');
    const c = await cenario('2027-01-10');
    const caminhaoId = await criarCaminhao(app, expedicaoCookies, { dataOperacao: c.dataOperacao });
    await abrirCarga(app, expedicaoCookies, caminhaoId);
    await iniciarConferencia(app, expedicaoCookies, caminhaoId);

    const res = await request(srv())
      .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
      .set('Cookie', expedicaoCookies)
      .send({ tipoOrigem: 'peca', modoCaptura: 'manual_assistido' });
    expect(res.status).toBe(400);
    const issues = res.body.message?.errors ?? [];
    const paths = (issues as Array<{ path: string[] }>).map((i) => i.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['codigo', 'motivo']));
  });
});
