import type { INestApplication } from '@nestjs/common';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  BALANCA_GATEWAY,
  IMPRESSORA_GATEWAY,
  LEITOR_GATEWAY,
} from '../../src/hardware/hardware.types';
import type { FakeBalancaGateway } from '../../src/hardware/fakes/fake-balanca.gateway';
import type { FakeLeitorGateway } from '../../src/hardware/fakes/fake-leitor.gateway';
import type { FakeImpressoraGateway } from '../../src/hardware/fakes/fake-impressora.gateway';
import {
  criarCompraConfirmada,
  criarPedidoFornecedorEnviado,
  iniciarRecebimentoViaPf,
} from './comercial-fixtures';

type Db = NodePgDatabase<typeof schema>;

/** Acesso aos gateways FAKE (HARDWARE_FAKE=1) para controlar status nos testes. */
export function fakes(app: INestApplication): {
  balanca: FakeBalancaGateway;
  leitor: FakeLeitorGateway;
  impressora: FakeImpressoraGateway;
} {
  return {
    balanca: app.get<FakeBalancaGateway>(BALANCA_GATEWAY),
    leitor: app.get<FakeLeitorGateway>(LEITOR_GATEWAY),
    impressora: app.get<FakeImpressoraGateway>(IMPRESSORA_GATEWAY),
  };
}

export interface CenarioPesagem {
  compraId: string;
  recebimentoId: string;
  itemComercialId: string;
  clienteId: string;
  dataOperacao: string;
}

/**
 * Monta o cenário base de F4b reusando os caminhos reais de F3/F4a:
 * compra confirmada → recebimento aberto (conferência na balança) →
 * pronto para pesar peças. Pedidos são criados à parte (criarPedido).
 */
export async function montarCenarioPesagem(
  app: INestApplication,
  cookies: { compras: string; recebimento: string },
  base: { fornecedorId: string; itemCompraId: string; itemComercialId: string },
  opts: { dataOperacao: string; quantidade: number },
): Promise<CenarioPesagem> {
  const compraId = await criarCompraConfirmada(app, cookies.compras, base, opts);
  const pedidoFornecedorId = await criarPedidoFornecedorEnviado(app, cookies.compras, compraId);
  const { recebimentoId } = await iniciarRecebimentoViaPf(app, cookies.recebimento, pedidoFornecedorId);

  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const [cliente] = await db.select().from(schema.clientes).limit(1);

  return {
    compraId,
    recebimentoId,
    itemComercialId: base.itemComercialId,
    clienteId: cliente?.id ?? '',
    dataOperacao: opts.dataOperacao,
  };
}

/**
 * Cria um segundo cliente para cenários que precisam de dois pedidos abertos no
 * mesmo item/operação (AD-03 permite só um pedido aberto por cliente+item+operação).
 */
export async function criarOutroCliente(app: INestApplication): Promise<string> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const sufixo = `${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
  const [cliente] = await db.insert(schema.clientes).values({
    codigo: `CLIPES-${sufixo}`,
    razaoSocial: 'Cliente Pesagem 2',
    documentoFiscal: `DOCPES-${sufixo}`,
  }).returning();
  if (!cliente) throw new Error('Falha ao criar segundo cliente do teste');
  return cliente.id;
}

/** Cria um pedido de venda sobre a compra, com um item de quantidade dada. */
export async function criarPedido(
  app: INestApplication,
  comercialCookies: string,
  params: { compraId: string; clienteId: string; itemComercialId: string; dataOperacao: string; quantidade: number; prioridade?: number },
): Promise<{ pedidoId: string; pedidoItemId: string }> {
  const { default: request } = await import('supertest');
  const body = {
    compraProgramadaId: params.compraId,
    clienteId: params.clienteId,
    dataOperacao: params.dataOperacao,
    prioridade: params.prioridade,
    itens: [{ itemComercialId: params.itemComercialId, quantidadePedida: params.quantidade }],
  };
  let res = await request(app.getHttpServer())
    .post('/comercial/pedidos')
    .set('Cookie', comercialCookies)
    .send(body);
  // Fixture de cenário: AD-05 exige confirmação explícita quando não há saldo.
  const challenge = res.body?.message;
  if (
    res.status === 409
    && typeof challenge === 'object'
    && challenge?.code === 'OVERBOOKING_CONFIRMACAO_NECESSARIA'
  ) {
    res = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send(body);
  }
  if (res.status !== 201) {
    throw new Error(`Falha ao criar pedido: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const pedidoId = res.body.id as string;
  const det = await request(app.getHttpServer()).get(`/comercial/pedidos/${pedidoId}`).set('Cookie', comercialCookies);
  const pedidoItemId = (det.body.itens as Array<{ id: string }>)[0]?.id;
  if (!pedidoItemId) throw new Error('Pedido criado sem itens');
  return { pedidoId, pedidoItemId };
}

export async function pesarPeca(
  app: INestApplication,
  recebimentoCookies: string,
  params: { recebimentoId: string; itemComercialBaseId: string; peso?: string },
): Promise<string> {
  fakes(app).balanca.definirStatus('disponivel');
  fakes(app).balanca.definirPeso(params.peso ?? '12.500');

  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post('/operacao/pesagem/pecas')
    .set('Cookie', recebimentoCookies)
    .send({
      recebimentoId: params.recebimentoId,
      itemComercialBaseId: params.itemComercialBaseId,
      modoCaptura: 'automatico',
    });
  if (res.status !== 201) {
    throw new Error(`Falha ao pesar peça: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
}

/** Associa peça pesada ao item do pedido (status → associada). */
export async function associarPeca(
  app: INestApplication,
  recebimentoCookies: string,
  pecaId: string,
  pedidoVendaItemId: string,
): Promise<void> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
    .set('Cookie', recebimentoCookies)
    .send({ pedidoVendaItemId });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Falha ao associar peça: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

/** Pesa, associa e emite etiqueta — peça elegível para carga. */
export async function pecaAssociadaComEtiqueta(
  app: INestApplication,
  recebimentoCookies: string,
  params: {
    recebimentoId: string;
    itemComercialBaseId: string;
    pedidoVendaItemId: string;
    peso?: string;
  },
): Promise<string> {
  const pecaId = await pesarPeca(app, recebimentoCookies, params);
  await associarPeca(app, recebimentoCookies, pecaId, params.pedidoVendaItemId);
  fakes(app).impressora.definirStatus('disponivel');
  const { default: request } = await import('supertest');
  const etiqueta = await request(app.getHttpServer())
    .post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`)
    .set('Cookie', recebimentoCookies)
    .send();
  if (etiqueta.status !== 201 && etiqueta.status !== 200) {
    throw new Error(`Falha ao emitir etiqueta: ${etiqueta.status} ${JSON.stringify(etiqueta.body)}`);
  }
  return pecaId;
}
