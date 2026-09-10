import type { INestApplication } from '@nestjs/common';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
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
  produtoCompraId: string;
  produtoId: string;
  clienteId: string;
  fator: number;
}> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const fator = opts.fator ?? 1;

  const [fornecedor] = await db
    .insert(schema.fornecedores)
    .values({ codigo: uid('FORN'), razaoSocial: 'Fornecedor F3', documentoFiscal: uid('DOC') })
    .returning();
  const [produtoCompra] = await db
    .insert(schema.produtos)
    .values({
      codigo: uid('ICOMP'),
      nome: 'Boi',
      unidadePedido: 'unidade',
      unidadePreco: 'kg',
      tipoOperacional: 'compra_base',
      ativoCompra: true,
      ativoVenda: false,
    })
    .returning();
  const [produtoVenda] = await db
    .insert(schema.produtos)
    .values({
      codigo: uid('ICOM'),
      nome: 'Dianteiro',
      unidadePedido: 'kg',
      unidadePreco: 'kg',
      passaBalanca: true,
      ativoCompra: true,
      ativoVenda: true,
    })
    .returning();
  const [cliente] = await db
    .insert(schema.clientes)
    .values({ codigo: uid('CLI'), razaoSocial: 'Cliente F3', documentoFiscal: uid('DOCC'), faixaPreco: 'A' })
    .returning();

  if (!fornecedor || !produtoCompra || !produtoVenda || !cliente) {
    throw new Error('Falha ao criar cadastros base de F3');
  }

  await db.insert(schema.regrasDesdobramentoComercial).values({
    produtoOrigemId: produtoCompra.id,
    produtoDestinoId: produtoVenda.id,
    fatorQuantidade: String(fator),
    status: 'ativo',
    vigenciaInicio: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });

  return {
    fornecedorId: fornecedor.id,
    produtoCompraId: produtoCompra.id,
    produtoId: produtoVenda.id,
    clienteId: cliente.id,
    fator,
  };
}

/** Lê a disponibilidade gerada para um produto (estado atual de saldo). */
export async function lerDisponibilidade(
  app: INestApplication,
  produtoId: string,
  compraProgramadaId?: string,
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
    .where(
      compraProgramadaId
        ? and(
          eq(schema.disponibilidadesVirtuais.produtoId, produtoId),
          eq(schema.disponibilidadesVirtuais.compraProgramadaId, compraProgramadaId),
        )
        : eq(schema.disponibilidadesVirtuais.produtoId, produtoId),
    );
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
  base: { fornecedorId: string; produtoCompraId: string },
  opts: { dataOperacao: string; quantidade: number; publicarTabela?: boolean },
): Promise<string> {
  const { default: request } = await import('supertest');
  const criar = await request(app.getHttpServer())
    .post('/comercial/compras-programadas')
    .set('Cookie', comprasCookies)
    .send({
      dataOperacao: opts.dataOperacao,
      fornecedorId: base.fornecedorId,
      itens: [{ produtoId: base.produtoCompraId, quantidadeComprada: opts.quantidade }],
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
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const destinos = await db
    .select({ produtoId: schema.disponibilidadesVirtuais.produtoId })
    .from(schema.disponibilidadesVirtuais)
    .where(eq(schema.disponibilidadesVirtuais.compraProgramadaId, compraId));
  if (opts.publicarTabela !== false) {
    await publicarTabelaParaData(
      app,
      opts.dataOperacao,
      [...new Set(destinos.map((d) => d.produtoId))],
    );
  }
  return compraId;
}

/**
 * Garante tabela `publicada` na data exata (AD-16), com preço > 0 em todos os
 * produtos ativos para venda (ou só os ids passados). Idempotente.
 */
export async function publicarTabelaParaData(
  app: INestApplication,
  data: string,
  produtoIds?: string[],
  preco = '18.50',
): Promise<void> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const candidatos = produtoIds && produtoIds.length > 0
    ? produtoIds
    : (await db
        .select({ id: schema.produtos.id })
        .from(schema.produtos)
        .where(and(eq(schema.produtos.ativoVenda, true), isNull(schema.produtos.deletedAt)))
      ).map((r) => r.id);
  if (candidatos.length === 0) return;

  const vivos = await db
    .select({ id: schema.produtos.id })
    .from(schema.produtos)
    .where(and(
      inArray(schema.produtos.id, candidatos),
      eq(schema.produtos.ativoVenda, true),
      isNull(schema.produtos.deletedAt),
    ));
  const ids = vivos.map((r) => r.id);
  if (ids.length === 0) return;

  const [existente] = await db
    .select()
    .from(schema.tabelasPreco)
    .where(and(eq(schema.tabelasPreco.data, data), isNull(schema.tabelasPreco.deletedAt)))
    .limit(1);
  let tabelaId: string;
  if (existente) {
    if (existente.status !== 'publicada') {
      await db
        .update(schema.tabelasPreco)
        .set({ status: 'publicada' })
        .where(eq(schema.tabelasPreco.id, existente.id));
    }
    tabelaId = existente.id;
  } else {
    const [tab] = await db
      .insert(schema.tabelasPreco)
      .values({ data, status: 'publicada' })
      .returning();
    if (!tab) throw new Error('Falha ao publicar tabela de preço de fixture');
    tabelaId = tab.id;
  }

  const ja = await db
    .select({ produtoId: schema.tabelasPrecoItens.produtoId })
    .from(schema.tabelasPrecoItens)
    .where(eq(schema.tabelasPrecoItens.tabelaPrecoId, tabelaId));
  const jaSet = new Set(ja.map((j) => j.produtoId));
  const novos = ids.filter((id) => !jaSet.has(id));
  if (novos.length === 0) return;
  await db.insert(schema.tabelasPrecoItens).values(
    novos.map((produtoId) => ({
      tabelaPrecoId: tabelaId,
      produtoId,
      precoA: preco,
      precoB: preco,
      precoC: preco,
      precoD: preco,
    })),
  ).onConflictDoNothing({
    target: [schema.tabelasPrecoItens.tabelaPrecoId, schema.tabelasPrecoItens.produtoId],
  });
}

/** Reusa o Pedido ao Fornecedor gerado na confirmação; fallback cria/envia se ainda não existir. */
export async function criarPedidoFornecedorEnviado(
  app: INestApplication,
  comprasCookies: string,
  compraProgramadaId: string,
): Promise<string> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const [existente] = await db.select().from(schema.pedidosFornecedor).where(and(
    eq(schema.pedidosFornecedor.compraProgramadaId, compraProgramadaId),
    isNull(schema.pedidosFornecedor.deletedAt),
    ne(schema.pedidosFornecedor.status, 'cancelado'),
  ));
  if (existente) {
    if (existente.status === 'rascunho' || existente.status === 'enviado') {
      const { default: request } = await import('supertest');
      const enviado = await request(app.getHttpServer())
        .post(`/operacao/pedidos-fornecedor/${existente.id}/enviar`)
        .set('Cookie', comprasCookies)
        .send();
      if (enviado.status !== 200 && enviado.status !== 201) {
        throw new Error(`Falha ao enviar PF: ${enviado.status} ${JSON.stringify(enviado.body)}`);
      }
    }
    return existente.id;
  }

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
