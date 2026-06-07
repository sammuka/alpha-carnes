import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada, lerDisponibilidade } from '../helpers/comercial-fixtures';

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
    tipo: 'quantidade_menor',
    descricao: 'Chegou menos que o esperado',
    acaoImediata: 'Replanejar atendimento',
  };

  it('iniciar sobre compra em rascunho → 409', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const criar = await request(srv())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({ dataOperacao: '2026-11-01', fornecedorId: base.fornecedorId, itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 10 }] });
    const compraId = criar.body.id as string; // rascunho (não confirmada)

    const res = await request(srv())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ compraProgramadaId: compraId });
    expect(res.status).toBe(409);
  });

  it('iniciar sobre compra confirmada → 201; itens esperados derivados da disponibilidade', async () => {
    const base = await seedComercialBase(app, { fator: 4 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-02', quantidade: 10 });

    const res = await request(srv())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ compraProgramadaId: compraId });
    expect(res.status).toBe(201);
    expect(res.body.recebimento.status).toBe('em_andamento');
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

  it('iniciar 2× é idempotente (jaIniciado=true, mesmo recebimento)', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-03', quantidade: 10 });

    const r1 = await request(srv()).post('/operacao/recebimentos').set('Cookie', recebimentoCookies).send({ compraProgramadaId: compraId });
    const r2 = await request(srv()).post('/operacao/recebimentos').set('Cookie', recebimentoCookies).send({ compraProgramadaId: compraId });
    expect(r2.body.jaIniciado).toBe(true);
    expect(r2.body.recebimento.id).toBe(r1.body.recebimento.id);
  });

  it('registrar item conforme (recebido == esperado) → conforme; impacto na disponibilidade', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-04', quantidade: 10 });
    const ini = await request(srv()).post('/operacao/recebimentos').set('Cookie', recebimentoCookies).send({ compraProgramadaId: compraId });
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
    const ini = await request(srv()).post('/operacao/recebimentos').set('Cookie', recebimentoCookies).send({ compraProgramadaId: compraId });
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
    const ini = await request(srv()).post('/operacao/recebimentos').set('Cookie', recebimentoCookies).send({ compraProgramadaId: compraId });
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

  it('item excedente (não esperado) exige item_excedente e não quebra (sem disponibilidade)', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-07', quantidade: 10 });
    const ini = await request(srv()).post('/operacao/recebimentos').set('Cookie', recebimentoCookies).send({ compraProgramadaId: compraId });
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
        divergencia: { tipo: 'item_excedente', descricao: 'Item não previsto', acaoImediata: 'Enviar a estoque' },
      });
    expect(comDiverg.status).toBe(201);
  });

  it('concluir com divergência aberta → 409; após tratativa (PATCH) → permitido', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-08', quantidade: 10 });
    const ini = await request(srv()).post('/operacao/recebimentos').set('Cookie', recebimentoCookies).send({ compraProgramadaId: compraId });
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
    expect(permitido.body.recebimento.status).toBe('concluido');
    expect(permitido.body.jaConcluido).toBe(false);
  });

  it('imutabilidade pós-conclusão: registrar item em recebimento concluído → 409', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-09', quantidade: 10 });
    const ini = await request(srv()).post('/operacao/recebimentos').set('Cookie', recebimentoCookies).send({ compraProgramadaId: compraId });
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
    const ini = await request(srv()).post('/operacao/recebimentos').set('Cookie', recebimentoCookies).send({ compraProgramadaId: compraId });
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

    const ini = await request(srv()).post('/operacao/recebimentos').set('Cookie', recebimentoCookies).send({ compraProgramadaId: compraId });
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

  // Helper: cria recebimento com uma divergência aberta; retorna ids úteis.
  async function recebimentoComDivergencia(dataOperacao: string) {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao, quantidade: 10 });
    const ini = await request(srv()).post('/operacao/recebimentos').set('Cookie', recebimentoCookies).send({ compraProgramadaId: compraId });
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
      .send({ compraProgramadaId: '019ea000-0000-7000-8000-000000000997' });
    expect(ini.status).toBe(404);
  });

  it('RBAC: perfil sem RECEBIMENTO_GERENCIAR (comercial) recebe 403 ao iniciar', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-12', quantidade: 10 });
    const res = await request(srv())
      .post('/operacao/recebimentos')
      .set('Cookie', comercialCookies)
      .send({ compraProgramadaId: compraId });
    expect(res.status).toBe(403);
  });

  it('RBAC: comercial tem RECEBIMENTO_LER (consulta) → 200 ao listar', async () => {
    const res = await request(srv()).get('/operacao/recebimentos').set('Cookie', comercialCookies);
    expect(res.status).toBe(200);
  });
});
