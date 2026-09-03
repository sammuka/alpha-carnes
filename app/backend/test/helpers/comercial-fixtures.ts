import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';

type Db = NodePgDatabase<typeof schema>;

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

/** Cria um conjunto mínimo de cadastros para exercitar F3. */
export async function seedComercialBase(
  app: INestApplication,
  opts: { fator?: number } = {},
): Promise<{
  fornecedorId: string;
  itemCompraId: string;
  itemComercialId: string;
  clienteId: string;
  fator: number;
}> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const fator = opts.fator ?? 1;

  const [fornecedor] = await db
    .insert(schema.fornecedores)
    .values({ codigo: uid('FORN'), razaoSocial: 'Fornecedor F3', documentoFiscal: uid('DOC') })
    .returning();
  const [itemCompra] = await db
    .insert(schema.itensCompra)
    .values({ codigo: uid('ICOMP'), descricao: 'Boi', unidadeCompra: 'unidade' })
    .returning();
  const [itemComercial] = await db
    .insert(schema.itensComerciais)
    .values({ codigo: uid('ICOM'), descricao: 'Dianteiro', unidadeComercial: 'kg' })
    .returning();
  const [cliente] = await db
    .insert(schema.clientes)
    .values({ codigo: uid('CLI'), razaoSocial: 'Cliente F3', documentoFiscal: uid('DOCC') })
    .returning();

  if (!fornecedor || !itemCompra || !itemComercial || !cliente) {
    throw new Error('Falha ao criar cadastros base de F3');
  }

  await db.insert(schema.regrasDesdobramentoComercial).values({
    itemCompraId: itemCompra.id,
    itemComercialId: itemComercial.id,
    fatorQuantidade: String(fator),
    status: 'ativo',
    vigenciaInicio: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });

  return {
    fornecedorId: fornecedor.id,
    itemCompraId: itemCompra.id,
    itemComercialId: itemComercial.id,
    clienteId: cliente.id,
    fator,
  };
}

/** Lê a disponibilidade gerada para um item comercial (estado atual de saldo). */
export async function lerDisponibilidade(
  app: INestApplication,
  itemComercialId: string,
): Promise<{
  id: string;
  quantidadeTotalGerada: string;
  quantidadeReservada: string;
  quantidadeDisponivel: string;
  quantidadeRecebida: string;
  quantidadeComDivergencia: string;
  status: string;
} | null> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const rows = await db
    .select()
    .from(schema.disponibilidadesVirtuais)
    .where(eq(schema.disponibilidadesVirtuais.itemComercialId, itemComercialId));
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    quantidadeTotalGerada: row.quantidadeTotalGerada,
    quantidadeReservada: row.quantidadeReservada,
    quantidadeDisponivel: row.quantidadeDisponivel,
    quantidadeRecebida: row.quantidadeRecebida,
    quantidadeComDivergencia: row.quantidadeComDivergencia,
    status: row.status,
  };
}

/**
 * Cria uma compra programada confirmada (gera a disponibilidade do dia) via API.
 * Reusa o caminho real de F3, retornando os ids para montar pedidos/recebimentos.
 */
export async function criarCompraConfirmada(
  app: INestApplication,
  comprasCookies: string,
  base: { fornecedorId: string; itemCompraId: string },
  opts: { dataOperacao: string; quantidade: number },
): Promise<string> {
  const { default: request } = await import('supertest');
  const criar = await request(app.getHttpServer())
    .post('/comercial/compras-programadas')
    .set('Cookie', comprasCookies)
    .send({
      dataOperacao: opts.dataOperacao,
      fornecedorId: base.fornecedorId,
      itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: opts.quantidade }],
    });
  if (criar.status !== 201 || !criar.body?.id) {
    throw new Error(`Falha ao criar compra: ${criar.status} ${JSON.stringify(criar.body)}`);
  }
  const compraId = criar.body.id as string;
  const confirmar = await request(app.getHttpServer())
    .post(`/comercial/compras-programadas/${compraId}/confirmar`)
    .set('Cookie', comprasCookies)
    .send();
  if (confirmar.status !== 201 && confirmar.status !== 200) {
    throw new Error(`Falha ao confirmar compra: ${confirmar.status} ${JSON.stringify(confirmar.body)}`);
  }
  return compraId;
}


/** Cria Pedido ao Fornecedor a partir de compra confirmada e envia (status aguardando_recebimento). */
export async function criarPedidoFornecedorEnviado(
  app: INestApplication,
  comprasCookies: string,
  compraProgramadaId: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const pedido = await request(app.getHttpServer())
    .post('/operacao/pedidos-fornecedor')
    .set('Cookie', comprasCookies)
    .send({ compraProgramadaId });
  if (pedido.status !== 201 || !pedido.body?.id) {
    throw new Error(`Falha ao criar PF: ${pedido.status} ${JSON.stringify(pedido.body)}`);
  }
  const enviado = await request(app.getHttpServer())
    .post(`/operacao/pedidos-fornecedor/${pedido.body.id}/enviar`)
    .set('Cookie', comprasCookies)
    .send();
  if (enviado.status !== 200 && enviado.status !== 201) {
    throw new Error(`Falha ao enviar PF: ${enviado.status} ${JSON.stringify(enviado.body)}`);
  }
  return pedido.body.id as string;
}

/** Inicia recebimento a partir do Pedido ao Fornecedor enviado. */
export async function iniciarRecebimentoViaPf(
  app: INestApplication,
  recebimentoCookies: string,
  pedidoFornecedorId: string,
): Promise<{ recebimentoId: string; body: unknown }> {
  const { default: request } = await import('supertest');
  const receb = await request(app.getHttpServer())
    .post('/operacao/recebimentos')
    .set('Cookie', recebimentoCookies)
    .send({ pedidoFornecedorId });
  if (receb.status !== 201 || !receb.body?.recebimento?.id) {
    throw new Error(`Falha ao iniciar recebimento: ${receb.status} ${JSON.stringify(receb.body)}`);
  }
  return { recebimentoId: receb.body.recebimento.id as string, body: receb.body };
}
