import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cargaItens, pecas, recebimentos, subitens } from '../../src/database/schema';
import { criarCompraConfirmada, criarPedidoFornecedorEnviado, iniciarRecebimentoViaPf, seedComercialBase } from './comercial-fixtures';
import { criarOutroCliente, criarPedido, pesarPeca } from './pesagem-fixtures';
import { iniciarCorte } from './corte-fixtures';

type Db = NodePgDatabase<typeof schema>;

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

export interface CtxFixtureMapa {
  operacaoId: string;
  produtoId: string;
  compraProgramadaId: string;
  recebimentoId: string;
  dataOperacao: string;
  pedidoId: string;
  pedidoItemId: string;
  pesoPecaConferida: string;
  pesoSubitemEmCarga: string;
  caminhaoFechadoId: string;
  pecaConferidaId: string;
  subitemEmCargaId: string;
  pecaRemovidaId: string;
}

/**
 * Monta o cenário completo de D17 sobre um único item comercial: pelo menos uma
 * linha em cada um dos 8 estados (F, V, R, C, D, O, E, !). Onde existe fluxo real
 * (F3/F4a/F4b/F4c), a fixture usa os caminhos HTTP já testados nas ondas anteriores;
 * onde não existe writer no domínio (estado `!`) ou o objetivo é só compor linhas de
 * `carga_itens` (estado E), a fixture grava direto no banco — mesmo padrão usado por
 * `criarOutroCliente` (pesagem-fixtures.ts).
 */
export async function montarCenarioMapa(
  app: INestApplication,
  cookies: string,
  opts: { dataOperacao: string },
): Promise<CtxFixtureMapa> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const { dataOperacao } = opts;

  const base = await seedComercialBase(app, { fator: 1 });
  const compraProgramadaId = await criarCompraConfirmada(
    app, cookies, { fornecedorId: base.fornecedorId, produtoCompraId: base.produtoCompraId },
    { dataOperacao, quantidade: 100 },
  );
  const pedidoFornecedorId = await criarPedidoFornecedorEnviado(app, cookies, compraProgramadaId);
  const { recebimentoId } = await iniciarRecebimentoViaPf(app, cookies, pedidoFornecedorId);

  const [recebimento] = await db.select({ operacaoId: recebimentos.operacaoId })
    .from(recebimentos).where(eq(recebimentos.id, recebimentoId));
  if (!recebimento) throw new Error('Recebimento da fixture do mapa não encontrado');
  const operacaoId = recebimento.operacaoId;

  // F — peça pesada, livre.
  await pesarPeca(app, cookies, {
    recebimentoId, produtoBaseId: base.produtoId, peso: '15.000',
  });

  // D — peça pesada enviada ao corte (iniciar move para 'em_transformacao').
  const pecaCorteId = await pesarPeca(app, cookies, {
    recebimentoId, produtoBaseId: base.produtoId, peso: '8.000',
  });
  const transformacaoId = await iniciarCorte(app, cookies, pecaCorteId);

  // ! — peça divergente na destinação. Não há writer no domínio (D17); a fixture
  // grava o estado diretamente, como o CHECK de `pecas.status_peca` já admite.
  const [pecaDivergente] = await db.insert(pecas).values({
    compraProgramadaId, recebimentoId, produtoBaseId: base.produtoId,
    pesoOriginal: '5.000', modoCapturaPeso: 'automatico', statusPeca: 'divergente',
  }).returning();
  if (!pecaDivergente) throw new Error('Falha ao semear peça divergente da fixture do mapa');

  // R — pedido em elaboração com reserva ativa (cliente 1).
  const { pedidoId, pedidoItemId } = await criarPedido(app, cookies, {
    compraId: compraProgramadaId, clienteId: base.clienteId, produtoId: base.produtoId,
    dataOperacao, quantidade: 50,
  });

  // C — mesma mecânica de reserva, pedido finalizado comercialmente (cliente 2).
  const clienteFinalizado = await criarOutroCliente(app);
  const { pedidoId: pedidoIdFinalizado } = await criarPedido(app, cookies, {
    compraId: compraProgramadaId, clienteId: clienteFinalizado, produtoId: base.produtoId,
    dataOperacao, quantidade: 50,
  });
  const { default: request } = await import('supertest');
  const finalizar = await request(app.getHttpServer())
    .post(`/comercial/pedidos/${pedidoIdFinalizado}/finalizar`)
    .set('Cookie', cookies)
    .send();
  if (finalizar.status !== 200) {
    throw new Error(`Falha ao finalizar pedido da fixture do mapa: ${finalizar.status} ${JSON.stringify(finalizar.body)}`);
  }

  // O — reserva sem lastro (saldo virtual já exaurido por R + C = 100 = total da compra).
  const clienteOverbooking = await criarOutroCliente(app);
  await criarPedido(app, cookies, {
    compraId: compraProgramadaId, clienteId: clienteOverbooking, produtoId: base.produtoId,
    dataOperacao, quantidade: 40,
  });

  // E — carga fechada: dois itens vivos (peça conferida + subitem em carga) e um
  // removido, no mesmo caminhão. A carga é semeada direto no banco (nota de D17): o
  // objetivo é só compor `carga_itens`, não reexercitar o fechamento de F5.
  const pesoPecaConferida = '20.000';
  const pesoSubitemEmCarga = '3.500';
  const [caminhaoFechado] = await db.insert(schema.caminhoes).values({
    placa: uid('MAPA'), motorista: 'Motorista Fixture Mapa', operacaoId, statusCaminhao: 'fechado',
  }).returning();
  if (!caminhaoFechado) throw new Error('Falha ao semear caminhão fechado da fixture do mapa');

  const [pecaConferida] = await db.insert(pecas).values({
    compraProgramadaId, recebimentoId, produtoBaseId: base.produtoId,
    pesoOriginal: pesoPecaConferida, modoCapturaPeso: 'automatico', statusPeca: 'associada',
    pedidoVendaId: pedidoId, pedidoVendaItemId: pedidoItemId,
  }).returning();
  const [pecaRemovida] = await db.insert(pecas).values({
    compraProgramadaId, recebimentoId, produtoBaseId: base.produtoId,
    pesoOriginal: '9.000', modoCapturaPeso: 'automatico', statusPeca: 'associada',
    pedidoVendaId: pedidoId, pedidoVendaItemId: pedidoItemId,
  }).returning();
  const [subitemEmCarga] = await db.insert(subitens).values({
    transformacaoId, pecaOrigemId: pecaCorteId, produtoId: base.produtoId,
    peso: pesoSubitemEmCarga, statusSubitem: 'associado',
    pedidoVendaId: pedidoId, pedidoVendaItemId: pedidoItemId,
  }).returning();
  if (!pecaConferida || !pecaRemovida || !subitemEmCarga) {
    throw new Error('Falha ao semear peças/subitem da carga fechada da fixture do mapa');
  }

  await db.insert(cargaItens).values([
    {
      caminhaoId: caminhaoFechado.id, tipoOrigem: 'peca', pecaId: pecaConferida.id,
      pedidoVendaId: pedidoId, pedidoVendaItemId: pedidoItemId,
      statusCargaItem: 'conferido', conferido: true,
    },
    {
      caminhaoId: caminhaoFechado.id, tipoOrigem: 'subitem', subitemId: subitemEmCarga.id,
      pedidoVendaId: pedidoId, pedidoVendaItemId: pedidoItemId,
      statusCargaItem: 'em_carga', conferido: false,
    },
    {
      caminhaoId: caminhaoFechado.id, tipoOrigem: 'peca', pecaId: pecaRemovida.id,
      pedidoVendaId: pedidoId, pedidoVendaItemId: pedidoItemId,
      statusCargaItem: 'removido', conferido: false, observacoes: 'trocada antes do fechamento',
    },
  ]);

  return {
    operacaoId, produtoId: base.produtoId, compraProgramadaId, recebimentoId, dataOperacao,
    pedidoId, pedidoItemId, pesoPecaConferida, pesoSubitemEmCarga,
    caminhaoFechadoId: caminhaoFechado.id, pecaConferidaId: pecaConferida.id,
    subitemEmCargaId: subitemEmCarga.id, pecaRemovidaId: pecaRemovida.id,
  };
}
