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
import { criarCompraConfirmada } from './comercial-fixtures';

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
  const { default: request } = await import('supertest');
  const srv = app.getHttpServer();

  const compraId = await criarCompraConfirmada(app, cookies.compras, base, opts);

  const receb = await request(srv)
    .post('/operacao/recebimentos')
    .set('Cookie', cookies.recebimento)
    .send({ compraProgramadaId: compraId, nfeNumero: '128934' });
  if (receb.status !== 201 || !receb.body?.recebimento?.id) {
    throw new Error(`Falha ao iniciar recebimento: ${receb.status} ${JSON.stringify(receb.body)}`);
  }
  const recebimentoId = receb.body.recebimento.id as string;

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
