import { INestApplication } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import {
  seedComercialBase,
  criarCompraConfirmada,
  criarPedidoFornecedorEnviado,
  lerDisponibilidade,
} from '../helpers/comercial-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { DisponibilidadeService } from '../../src/modules/comercial/disponibilidade/disponibilidade.service';

type Db = NodePgDatabase<typeof schema>;

describe('Recebimento e2e (vínculo, conferência, divergência, conclusão, impacto)', () => {
  let app: INestApplication;
  let recebimentoCookies: string; // perfil recebimento_pesagem (gerencia recebimento)
  let comprasCookies: string; // cria/confirma compra; gerencia divergência/ocorrência
  let comercialCookies: string; // cria pedidos (reserva)

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

  const divergenciaFalta = {
    tipo: 'falta',
    descricao: 'Chegou menos que o esperado',
    acaoImediata: 'Replanejar atendimento',
  };

  async function iniciarViaCompra(compraId: string, extra: Record<string, unknown> = {}) {
    const pfId = await criarPedidoFornecedorEnviado(app, comprasCookies, compraId);
    return request(srv())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: pfId, ...extra });
  }

  it('PF sobre compra em rascunho → 409', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const criar = await request(srv())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({ dataOperacao: '2026-11-01', fornecedorId: base.fornecedorId, itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 10 }] });
    const compraId = criar.body.id as string; // rascunho (não confirmada)

    const res = await request(srv())
      .post('/operacao/pedidos-fornecedor')
      .set('Cookie', comprasCookies)
      .send({ compraProgramadaId: compraId });
    expect(res.status).toBe(409);
  });

  it('iniciar sobre compra confirmada → 201; itens esperados derivados da disponibilidade', async () => {
    const base = await seedComercialBase(app, { fator: 4 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-02', quantidade: 10 });

    const res = await iniciarViaCompra(compraId);
    expect(res.status).toBe(201);
    expect(res.body.recebimento.status).toBe('pesagem_em_andamento');
    expect(res.body.jaIniciado).toBe(false);

    const detalhe = await request(srv())
      .get(`/operacao/recebimentos/${res.body.recebimento.id}`)
      .set('Cookie', recebimentoCookies);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.itens).toHaveLength(1);
    // esperado = fator(4) × comprado(10) = 40, derivado da disponibilidade
    expect(Number(detalhe.body.itens[0].quantidadeEsperada)).toBe(40);
    expect(detalhe.body.itens[0].itemComercialId).toBe(base.itemComercialId);
  });

  it('permite N recebimentos do mesmo Pedido ao Fornecedor', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-03', quantidade: 10 });
    const pfId = await criarPedidoFornecedorEnviado(app, comprasCookies, compraId);

    const r1 = await request(srv())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: pfId });
    const r2 = await request(srv())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: pfId });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r2.body.recebimento.id).not.toBe(r1.body.recebimento.id);
  });

  it('registrar item conforme (recebido == esperado) → conforme; impacto na disponibilidade', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-04', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    const res = await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10 });
    expect(res.status).toBe(201);

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeRecebida)).toBe(10);
    expect(Number(disp!.quantidadeComDivergencia)).toBe(0);
  });

  it('diferença esperado×recebido SEM divergência → 409 (ajuste sem ocorrência rejeitado)', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-05', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    const res = await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 7 }); // esperado 10
    expect(res.status).toBe(409);
  });

  it('diferença COM divergência formal → 201; disponibilidade reflete recebido/divergente', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-06', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    const res = await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 6, divergencia: divergenciaFalta });
    expect(res.status).toBe(201);

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeRecebida)).toBe(6);
    expect(Number(disp!.quantidadeComDivergencia)).toBe(4); // |10 - 6|
  });

  it('item excedente (não esperado) exige produto_nao_previsto e não quebra (sem disponibilidade)', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-07', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    // Cria um item comercial novo que NÃO faz parte do desdobramento (sem disponibilidade).
    const baseExtra = await seedComercialBase(app, { fator: 1 });

    const semDiverg = await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: baseExtra.itemComercialId, quantidadeRecebida: 3 });
    expect(semDiverg.status).toBe(409); // excedente exige divergência

    const comDiverg = await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({
        itemComercialId: baseExtra.itemComercialId,
        quantidadeRecebida: 3,
        divergencia: { tipo: 'produto_nao_previsto', descricao: 'Item não previsto', acaoImediata: 'Enviar a estoque' },
      });
    expect(comDiverg.status).toBe(201);
  });

  it('concluir com divergência aberta → 409; após tratativa (PATCH) → permitido', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-08', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 6, divergencia: divergenciaFalta });

    const bloqueado = await request(srv()).post(`/operacao/recebimentos/${recId}/concluir`).set('Cookie', recebimentoCookies).send();
    expect(bloqueado.status).toBe(409);

    // Localiza a divergência e move para em_analise (tratativa).
    const detalhe = await request(srv()).get(`/operacao/recebimentos/${recId}`).set('Cookie', recebimentoCookies);
    const divergenciaId = detalhe.body.divergencias[0].id as string;
    const tratada = await request(srv())
      .patch(`/operacao/divergencias-recebimento/${divergenciaId}`)
      .set('Cookie', comprasCookies)
      .send({ status: 'em_analise' });
    expect(tratada.status).toBe(200);
    expect(tratada.body.status).toBe('em_analise');

    const permitido = await request(srv()).post(`/operacao/recebimentos/${recId}/concluir`).set('Cookie', recebimentoCookies).send();
    expect(permitido.status).toBe(201);
    expect(permitido.body.recebimento.status).toBe('aguardando_conferencia_final');
    expect(permitido.body.jaConcluido).toBe(false);
  });

  it('imutabilidade pós-conclusão: registrar item em recebimento concluído → 409', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-09', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10 });
    await request(srv()).post(`/operacao/recebimentos/${recId}/concluir`).set('Cookie', recebimentoCookies).send();

    const res = await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 8, divergencia: divergenciaFalta });
    expect(res.status).toBe(409);
  });

  it('concluir 2× é idempotente (segundo → jaConcluido=true)', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-10', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;
    await request(srv()).post(`/operacao/recebimentos/${recId}/itens`).set('Cookie', recebimentoCookies).send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10 });

    const c1 = await request(srv()).post(`/operacao/recebimentos/${recId}/concluir`).set('Cookie', recebimentoCookies).send();
    const c2 = await request(srv()).post(`/operacao/recebimentos/${recId}/concluir`).set('Cookie', recebimentoCookies).send();
    expect(c1.body.jaConcluido).toBe(false);
    expect(c2.body.jaConcluido).toBe(true);
  });

  it('pedido em risco: recebido < reservado, conclusão lista pedidos impactados', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-11', quantidade: 10 });
    // Reserva 8 de 10 num pedido.
    const pedido = await request(srv())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({ compraProgramadaId: compraId, clienteId: base.clienteId, dataOperacao: '2026-11-11', itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 8 }] });
    expect(pedido.status).toBe(201);

    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;
    // Recebe só 5 (< 8 reservado) com divergência.
    const reg = await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 5, divergencia: divergenciaFalta });
    expect(reg.status).toBe(201);

    // Trata a divergência e conclui.
    const detalhe = await request(srv()).get(`/operacao/recebimentos/${recId}`).set('Cookie', recebimentoCookies);
    const divergenciaId = detalhe.body.divergencias[0].id as string;
    await request(srv()).patch(`/operacao/divergencias-recebimento/${divergenciaId}`).set('Cookie', comprasCookies).send({ status: 'em_analise' });

    const concl = await request(srv()).post(`/operacao/recebimentos/${recId}/concluir`).set('Cookie', recebimentoCookies).send();
    expect(concl.status).toBe(201);

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeRecebida)).toBe(5);
  });

  it('déficit COLETIVO: 2 pedidos × 6, recebido 10 → ambos em risco (Σ reservas > recebido)', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-17', quantidade: 12 });
    // 2 pedidos de 6 (Σ reservado = 12). Nenhum pedido isolado excede o recebido (10).
    for (let i = 0; i < 2; i++) {
      const p = await request(srv())
        .post('/comercial/pedidos')
        .set('Cookie', comercialCookies)
        .send({ compraProgramadaId: compraId, clienteId: base.clienteId, dataOperacao: '2026-11-17', itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 6 }] });
      expect(p.status).toBe(201);
    }

    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;
    // Recebe 10 < 12 reservado → divergência. Nenhum pedido individual > 10.
    await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10, divergencia: divergenciaFalta });

    // A query é a fonte de verdade do alerta: deve listar AMBOS os pedidos.
    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const disponibilidade = app.get(DisponibilidadeService);
    const risco = await disponibilidade.listarPedidosEmRisco(db, compraId, base.itemComercialId);
    expect(risco).toHaveLength(2);
    expect(risco.every((r) => Number(r.quantidadeRecebida) === 10)).toBe(true);
  });

  it('sem déficit coletivo: Σ reservas <= recebido → ninguém em risco', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-18', quantidade: 12 });
    const p = await request(srv())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({ compraProgramadaId: compraId, clienteId: base.clienteId, dataOperacao: '2026-11-18', itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 6 }] });
    expect(p.status).toBe(201);

    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;
    await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10, divergencia: divergenciaFalta });

    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const disponibilidade = app.get(DisponibilidadeService);
    const risco = await disponibilidade.listarPedidosEmRisco(db, compraId, base.itemComercialId);
    expect(risco).toHaveLength(0); // reservado 6 <= recebido 10
  });

  // Helper: cria recebimento com uma divergência aberta; retorna ids úteis.
  async function recebimentoComDivergencia(dataOperacao: string) {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao, quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;
    await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 6, divergencia: divergenciaFalta });
    const detalhe = await request(srv()).get(`/operacao/recebimentos/${recId}`).set('Cookie', recebimentoCookies);
    return { base, compraId, recId, divergenciaId: detalhe.body.divergencias[0].id as string };
  }

  it('PATCH divergência para aguardando_fornecedor abre e vincula ocorrência', async () => {
    const { divergenciaId } = await recebimentoComDivergencia('2026-11-13');
    const res = await request(srv())
      .patch(`/operacao/divergencias-recebimento/${divergenciaId}`)
      .set('Cookie', comprasCookies)
      .send({ status: 'aguardando_fornecedor', impactoOperacional: 'Pode faltar para 1 pedido' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('aguardando_fornecedor');

    // Uma ocorrência vinculada à divergência deve ter sido criada.
    const ocorrencias = await request(srv()).get('/operacao/ocorrencias-fornecedor').set('Cookie', comprasCookies);
    const vinculada = ocorrencias.body.data.find((o: { divergenciaId: string }) => o.divergenciaId === divergenciaId);
    expect(vinculada).toBeDefined();
  });

  it('PATCH divergência 2× para aguardando_fornecedor não duplica ocorrência', async () => {
    const { divergenciaId } = await recebimentoComDivergencia('2026-11-14');
    await request(srv()).patch(`/operacao/divergencias-recebimento/${divergenciaId}`).set('Cookie', comprasCookies).send({ status: 'aguardando_fornecedor' });
    await request(srv()).patch(`/operacao/divergencias-recebimento/${divergenciaId}`).set('Cookie', comprasCookies).send({ status: 'aguardando_fornecedor' });

    const ocorrencias = await request(srv()).get('/operacao/ocorrencias-fornecedor').set('Cookie', comprasCookies);
    const vinculadas = ocorrencias.body.data.filter((o: { divergenciaId: string }) => o.divergenciaId === divergenciaId);
    expect(vinculadas).toHaveLength(1);
  });

  it('PATCH divergência direto para resolvida (sem abrir ocorrência)', async () => {
    const { divergenciaId } = await recebimentoComDivergencia('2026-11-15');
    const res = await request(srv())
      .patch(`/operacao/divergencias-recebimento/${divergenciaId}`)
      .set('Cookie', comprasCookies)
      .send({ status: 'resolvida' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolvida');
  });

  it('atualizar divergência já resolvida → 409', async () => {
    const { divergenciaId } = await recebimentoComDivergencia('2026-11-16');
    await request(srv()).patch(`/operacao/divergencias-recebimento/${divergenciaId}`).set('Cookie', comprasCookies).send({ status: 'resolvida' });
    const res = await request(srv()).patch(`/operacao/divergencias-recebimento/${divergenciaId}`).set('Cookie', comprasCookies).send({ status: 'em_analise' });
    expect(res.status).toBe(409);
  });

  it('atualizar divergência inexistente → 404', async () => {
    const res = await request(srv())
      .patch('/operacao/divergencias-recebimento/019ea000-0000-7000-8000-000000000999')
      .set('Cookie', comprasCookies)
      .send({ status: 'em_analise' });
    expect(res.status).toBe(404);
  });

  it('detalhar/iniciar recebimento inexistente → 404', async () => {
    const detalhe = await request(srv()).get('/operacao/recebimentos/019ea000-0000-7000-8000-000000000998').set('Cookie', recebimentoCookies);
    expect(detalhe.status).toBe(404);
    const ini = await request(srv())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: '019ea000-0000-7000-8000-000000000997' });
    expect(ini.status).toBe(404);
  });

  it('RBAC: perfil sem RECEBIMENTO_GERENCIAR (comercial) recebe 403 ao iniciar', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-12', quantidade: 10 });
    const pfId = await criarPedidoFornecedorEnviado(app, comprasCookies, compraId);
    const res = await request(srv())
      .post('/operacao/recebimentos')
      .set('Cookie', comercialCookies)
      .send({ pedidoFornecedorId: pfId });
    expect(res.status).toBe(403);
  });

  it('RBAC: comercial tem RECEBIMENTO_LER (consulta) → 200 ao listar', async () => {
    const res = await request(srv()).get('/operacao/recebimentos').set('Cookie', comercialCookies);
    expect(res.status).toBe(200);
  });

  it('GET previsao da compra confirmada retorna itens operacionais readonly', async () => {
    const base = await seedComercialBase(app, { fator: 4 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-21', quantidade: 10 });

    const res = await request(srv())
      .get(`/operacao/recebimentos/previsao/${compraId}`)
      .set('Cookie', recebimentoCookies);
    expect(res.status).toBe(200);
    expect(res.body.itensOperacionais).toHaveLength(1);
    expect(Number(res.body.itensOperacionais[0].quantidadePrevista)).toBe(40);
    expect(res.body.jaPossuiRecebimento).toBe(false);
  });

  it('iniciar via Pedido ao Fornecedor → status pesagem_em_andamento', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-22', quantidade: 10 });
    const res = await iniciarViaCompra(compraId);
    expect(res.status).toBe(201);
    expect(res.body.recebimento.status).toBe('pesagem_em_andamento');
  });

  it('cancelar lote sem pesagem → cancelado', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-23', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    const res = await request(srv()).post(`/operacao/recebimentos/${recId}/cancelar`).set('Cookie', recebimentoCookies);
    expect(res.status).toBe(201);
    expect(res.body.recebimento.status).toBe('cancelado');
  });

  it('iniciar sem pedidoFornecedorId → 400', async () => {
    const res = await request(srv())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ nfeNumero: '128934' });
    expect(res.status).toBe(400);
  });

  it('GET previsao compra rascunho → 409', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const criar = await request(srv())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({ dataOperacao: '2026-11-25', fornecedorId: base.fornecedorId, itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 10 }] });
    const res = await request(srv())
      .get(`/operacao/recebimentos/previsao/${criar.body.id}`)
      .set('Cookie', recebimentoCookies);
    expect(res.status).toBe(409);
  });

  it('PATCH nfe em lote aberto → 200 e reflete no detalhe', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-26', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    const patch = await request(srv())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({ nfeNumero: '998877', romaneio: 'ROM-PATCH', nfePesoBruto: 1500.5 });
    expect(patch.status).toBe(200);
    expect(patch.body.recebimento.notaFiscalFornecedor).toBe('998877');
    expect(patch.body.recebimento.romaneio).toBe('ROM-PATCH');

    const detalhe = await request(srv()).get(`/operacao/recebimentos/${recId}`).set('Cookie', recebimentoCookies);
    expect(detalhe.body.nfeNumero).toBe('998877');
    expect(detalhe.body.notaFiscalFornecedor).toBe('998877');
  });

  it('PATCH nfe com serie/chave persiste cabeçalho sem itens inferidos', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-30', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;
    const chaveNfe = '35250612345678901234567890123456789012345678';

    const patch = await request(srv())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({
        nfeNumero: '123456',
        nfeSerie: '3',
        nfeChave: chaveNfe,
        nfeDataEmissao: '2026-07-01',
        nfePesoBruto: 2500,
      });
    expect(patch.status).toBe(200);

    const detalhe = await request(srv()).get(`/operacao/recebimentos/${recId}`).set('Cookie', recebimentoCookies);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.nfeSerie).toBe('3');
    expect(detalhe.body.nfeChave).toBe(chaveNfe);
    expect(Number(detalhe.body.nfePesoBruto)).toBe(2500);

    const { db } = app.get(DRIZZLE);
    const nfs = await db
      .select()
      .from(schema.notasFiscaisFornecedor)
      .where(eq(schema.notasFiscaisFornecedor.recebimentoId, recId));
    expect(nfs).toHaveLength(1);
    expect(nfs[0]?.serie).toBe('3');
    expect(nfs[0]?.payloadJson).toMatchObject({
      cabecalho_sem_itens: true,
    });
    expect(nfs[0]?.payloadJson).not.toHaveProperty('migracao');

    const itensNf = await db
      .select()
      .from(schema.notasFiscaisFornecedorItens)
      .where(eq(schema.notasFiscaisFornecedorItens.nfId, nfs[0]!.id));
    expect(itensNf).toHaveLength(0);
  });

  it('PATCH nfe expõe nfePesoLiquido via payload sem mintar como bruto', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-12-01', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    const patch = await request(srv())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({
        nfeNumero: '777888',
        nfePesoLiquido: 1800.5,
      });
    expect(patch.status).toBe(200);

    const detalhe = await request(srv()).get(`/operacao/recebimentos/${recId}`).set('Cookie', recebimentoCookies);
    expect(detalhe.status).toBe(200);
    expect(Number(detalhe.body.nfePesoLiquido)).toBe(1800.5);
    expect(detalhe.body.nfePesoBruto).toBeNull();

    const { db } = app.get(DRIZZLE);
    const nfs = await db
      .select()
      .from(schema.notasFiscaisFornecedor)
      .where(eq(schema.notasFiscaisFornecedor.recebimentoId, recId));
    expect(nfs[0]?.pesoTotalDeclarado).toBeNull();
    expect(nfs[0]?.payloadJson).toMatchObject({ pesoLiquido: 1800.5 });
  });

  it('cabecalho via PATCH + registrarNf com itens completa NF e permite conferência', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-12-03', quantidade: 10 });
    const pfId = await criarPedidoFornecedorEnviado(app, comprasCookies, compraId);
    const ini = await request(srv())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: pfId });
    expect(ini.status).toBe(201);
    const recId = ini.body.recebimento.id as string;

    await request(srv())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({ nfeNumero: '900100', nfeSerie: '1' })
      .expect(200);

    await request(srv())
      .post(`/operacao/pedidos-fornecedor/${pfId}/nf`)
      .set('Cookie', recebimentoCookies)
      .send({
        numero: '900100',
        recebimentoId: recId,
        itens: [{ itemComercialId: base.itemComercialId, quantidadeDeclarada: 10 }],
      })
      .expect(201);

    const { db } = app.get(DRIZZLE);
    const nfs = await db
      .select()
      .from(schema.notasFiscaisFornecedor)
      .where(eq(schema.notasFiscaisFornecedor.recebimentoId, recId));
    expect(nfs.filter((nf: { deletedAt: Date | null }) => nf.deletedAt === null)).toHaveLength(1);
    const itensNf = await db
      .select()
      .from(schema.notasFiscaisFornecedorItens)
      .where(eq(schema.notasFiscaisFornecedorItens.nfId, nfs[0]!.id));
    expect(itensNf).toHaveLength(1);
    expect(nfs[0]?.payloadJson).not.toHaveProperty('cabecalho_sem_itens');

    await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10 })
      .expect(201);

    await db.update(schema.recebimentosItens)
      .set({ requerBalanca: false, statusApuracao: 'entrada_direta' })
      .where(and(
        eq(schema.recebimentosItens.recebimentoId, recId),
        eq(schema.recebimentosItens.itemComercialId, base.itemComercialId),
      ));

    await request(srv())
      .post(`/operacao/recebimentos/${recId}/concluir`)
      .set('Cookie', recebimentoCookies)
      .send()
      .expect(201);

    const conf = await request(srv())
      .post(`/operacao/recebimentos/${recId}/conferencia/concluir`)
      .set('Cookie', recebimentoCookies)
      .send({ resultado: 'sem_divergencia' });
    expect(conf.status).toBe(201);
  });

  it('PATCH nfe corrige numero sem criar NF fantasma', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-12-04', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    await request(srv())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({ nfeNumero: '900201', nfeSerie: '1' })
      .expect(200);

    await request(srv())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({ nfeNumero: '900202', nfeSerie: '2' })
      .expect(200);

    const { db } = app.get(DRIZZLE);
    const nfs = await db
      .select()
      .from(schema.notasFiscaisFornecedor)
      .where(eq(schema.notasFiscaisFornecedor.recebimentoId, recId));
    const ativas = nfs.filter((nf: { deletedAt: Date | null }) => nf.deletedAt === null);
    expect(ativas).toHaveLength(1);
    expect(ativas[0]?.numero).toBe('900202');
    expect(ativas[0]?.serie).toBe('2');

    const detalhe = await request(srv()).get(`/operacao/recebimentos/${recId}`).set('Cookie', recebimentoCookies);
    expect(detalhe.body.nfeNumero).toBe('900202');
    expect(detalhe.body.nfeSerie).toBe('2');
  });

  it('PATCH nfe corrige numero depois dos itens sem NF fantasma', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-12-06', quantidade: 10 });
    const pfId = await criarPedidoFornecedorEnviado(app, comprasCookies, compraId);
    const ini = await request(srv())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: pfId });
    expect(ini.status).toBe(201);
    const recId = ini.body.recebimento.id as string;

    await request(srv())
      .post(`/operacao/pedidos-fornecedor/${pfId}/nf`)
      .set('Cookie', recebimentoCookies)
      .send({
        numero: '910100',
        recebimentoId: recId,
        itens: [{ itemComercialId: base.itemComercialId, quantidadeDeclarada: 10 }],
      })
      .expect(201);

    await request(srv())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({ nfeNumero: '910101' })
      .expect(200);

    const { db } = app.get(DRIZZLE);
    const nfs = await db
      .select()
      .from(schema.notasFiscaisFornecedor)
      .where(eq(schema.notasFiscaisFornecedor.recebimentoId, recId));
    const ativas = nfs.filter((nf: { deletedAt: Date | null }) => nf.deletedAt === null);
    expect(ativas).toHaveLength(1);
    expect(ativas[0]?.numero).toBe('910101');

    const itensNf = await db
      .select()
      .from(schema.notasFiscaisFornecedorItens)
      .where(and(
        eq(schema.notasFiscaisFornecedorItens.nfId, ativas[0]!.id),
        isNull(schema.notasFiscaisFornecedorItens.deletedAt),
      ));
    expect(itensNf).toHaveLength(1);

    await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10 })
      .expect(201);

    await db.update(schema.recebimentosItens)
      .set({ requerBalanca: false, statusApuracao: 'entrada_direta' })
      .where(and(
        eq(schema.recebimentosItens.recebimentoId, recId),
        eq(schema.recebimentosItens.itemComercialId, base.itemComercialId),
      ));

    await request(srv())
      .post(`/operacao/recebimentos/${recId}/concluir`)
      .set('Cookie', recebimentoCookies)
      .send()
      .expect(201);

    const conf = await request(srv())
      .post(`/operacao/recebimentos/${recId}/conferencia/concluir`)
      .set('Cookie', recebimentoCookies)
      .send({ resultado: 'sem_divergencia' });
    expect(conf.status).toBe(201);
  });

  it('PATCH nfe parcial preserva pesos e volumes já informados', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-12-05', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    await request(srv())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({
        nfeNumero: '800100',
        nfeSerie: '1',
        nfePesoBruto: 3200,
        nfePesoLiquido: 3000,
        nfeVolumes: 45,
      })
      .expect(200);

    await request(srv())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({ nfeNumero: '800101', nfeSerie: '2' })
      .expect(200);

    const detalhe = await request(srv()).get(`/operacao/recebimentos/${recId}`).set('Cookie', recebimentoCookies);
    expect(detalhe.body.nfeNumero).toBe('800101');
    expect(detalhe.body.nfeSerie).toBe('2');
    expect(Number(detalhe.body.nfePesoBruto)).toBe(3200);
    expect(Number(detalhe.body.nfePesoLiquido)).toBe(3000);
    expect(Number(detalhe.body.nfeVolumes)).toBe(45);

    const { db } = app.get(DRIZZLE);
    const nfs = await db
      .select()
      .from(schema.notasFiscaisFornecedor)
      .where(eq(schema.notasFiscaisFornecedor.recebimentoId, recId));
    expect(nfs).toHaveLength(1);
    expect(Number(nfs[0]?.pesoTotalDeclarado)).toBe(3200);
    expect(nfs[0]?.payloadJson).toMatchObject({ pesoLiquido: 3000, volumes: 45 });
  });

  it('conferência com NF só-cabeçalho → 409 NF_ITENS_OBRIGATORIOS', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-12-02', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;

    await request(srv())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({ nfeNumero: '555666', nfeSerie: '1' })
      .expect(200);

    await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10 })
      .expect(201);

    await request(srv())
      .post(`/operacao/recebimentos/${recId}/concluir`)
      .set('Cookie', recebimentoCookies)
      .send()
      .expect(201);

    const res = await request(srv())
      .post(`/operacao/recebimentos/${recId}/conferencia/concluir`)
      .set('Cookie', recebimentoCookies)
      .send({ resultado: 'sem_divergencia' });
    expect(res.status).toBe(409);
    expect(res.body.message?.code ?? res.body.code).toBe('NF_ITENS_OBRIGATORIOS');
  });

  it('PATCH nfe em lote após conclusão de pesagem → 409', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-27', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;
    await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10 });
    await request(srv()).post(`/operacao/recebimentos/${recId}/concluir`).set('Cookie', recebimentoCookies).send();

    const res = await request(srv())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({ nfeNumero: '000111' });
    expect(res.status).toBe(409);
  });

  it('cancelar lote após conclusão de pesagem → 409', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-28', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId);
    const recId = ini.body.recebimento.id as string;
    await request(srv())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10 });
    await request(srv()).post(`/operacao/recebimentos/${recId}/concluir`).set('Cookie', recebimentoCookies).send();

    const res = await request(srv()).post(`/operacao/recebimentos/${recId}/cancelar`).set('Cookie', recebimentoCookies);
    expect(res.status).toBe(409);
  });

  it('listar retorna resumo enriquecido com romaneio e progresso', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-29', quantidade: 10 });
    const ini = await iniciarViaCompra(compraId, { romaneio: 'ROM-LISTA', nfeNumero: '555444' });
    expect(ini.status).toBe(201);

    const lista = await request(srv()).get('/operacao/recebimentos?pageSize=50').set('Cookie', recebimentoCookies);
    expect(lista.status).toBe(200);
    const row = lista.body.data.find((r: { id: string }) => r.id === ini.body.recebimento.id);
    expect(row).toBeDefined();
    expect(row.romaneio).toBe('ROM-LISTA');
    expect(row.codigoLote).toBe(ini.body.recebimento.id.slice(0, 8).toUpperCase());
    expect(typeof row.progressoBalanca).toBe('number');
  });
});
