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
 * compra confirmada → recebimento iniciado e concluído (sem divergência) →
 * pronto para pesar peças. Pedidos são criados à parte (criarPedido).
 */
export async function montarCenarioPesagem(
  app: INestApplication,
  cookies: { compras: string; recebimento: string },
  base: { fornecedorId: string; itemCompraId: string; itemComercialId: string },
  opts: { dataOperacao: string; quantidade: number },
): Promise<CenarioPesagem> {
  const { default: request } = await import('supertest');
  const srv = app.getHttpServer();

  // Compra confirmada (gera disponibilidade do dia).
  const criar = await request(srv)
    .post('/comercial/compras-programadas')
    .set('Cookie', cookies.compras)
    .send({
      dataOperacao: opts.dataOperacao,
      fornecedorId: base.fornecedorId,
      itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: opts.quantidade }],
    });
  const compraId = criar.body.id as string;
  await request(srv).post(`/comercial/compras-programadas/${compraId}/confirmar`).set('Cookie', cookies.compras).send();

  // Recebimento iniciado.
  const receb = await request(srv)
    .post('/operacao/recebimentos')
    .set('Cookie', cookies.recebimento)
    .send({ compraProgramadaId: compraId });
  const recebimentoId = receb.body.recebimento.id as string;

  // Conferência conforme (recebido == esperado) e conclusão (sem divergência).
  const detalhe = await request(srv).get(`/operacao/recebimentos/${recebimentoId}`).set('Cookie', cookies.recebimento);
  const itens = detalhe.body.itens as Array<{ itemComercialId: string; quantidadeEsperada: string }>;
  for (const it of itens) {
    await request(srv)
      .post(`/operacao/recebimentos/${recebimentoId}/itens`)
      .set('Cookie', cookies.recebimento)
      .send({ itemComercialId: it.itemComercialId, quantidadeRecebida: Number(it.quantidadeEsperada) });
  }
  await request(srv).post(`/operacao/recebimentos/${recebimentoId}/concluir`).set('Cookie', cookies.recebimento).send();

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

/** Cria um pedido de venda sobre a compra, com um item de quantidade dada. */
export async function criarPedido(
  app: INestApplication,
  comercialCookies: string,
  params: { compraId: string; clienteId: string; itemComercialId: string; dataOperacao: string; quantidade: number; prioridade?: number },
): Promise<{ pedidoId: string; pedidoItemId: string }> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post('/comercial/pedidos')
    .set('Cookie', comercialCookies)
    .send({
      compraProgramadaId: params.compraId,
      clienteId: params.clienteId,
      dataOperacao: params.dataOperacao,
      prioridade: params.prioridade,
      itens: [{ itemComercialId: params.itemComercialId, quantidadePedida: params.quantidade }],
    });
  const pedidoId = res.body.id as string;
  const detalhe = await request(app.getHttpServer()).get(`/comercial/pedidos/${pedidoId}`).set('Cookie', comercialCookies);
  const pedidoItemId = (detalhe.body.itens as Array<{ id: string }>)[0]!.id;
  return { pedidoId, pedidoItemId };
}

/** Pesa uma peça via API (modo automático por padrão). Retorna o id da peça. */
export async function pesarPeca(
  app: INestApplication,
  cookies: string,
  params: { recebimentoId: string; itemComercialBaseId: string },
): Promise<string> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post('/operacao/pesagem/pecas')
    .set('Cookie', cookies)
    .send({ recebimentoId: params.recebimentoId, itemComercialBaseId: params.itemComercialBaseId, modoCaptura: 'automatico' });
  return res.body.id as string;
}
