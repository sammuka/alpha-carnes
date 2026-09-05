// app/backend/test/helpers/corte-fixtures.ts
import type { INestApplication } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { seedRegrasTransformacaoTz } from '../../src/database/seed-regras-transformacao-tz';

type Db = NodePgDatabase<typeof schema>;

function dbOf(app: INestApplication): Db {
  return app.get<{ db: Db }>(DRIZZLE).db;
}

/**
 * Emenda 7 — seed Task 2 (catálogo MVP + regras TZ A/B) e devolve
 * id do produto CB (saída canônica Alternativa A).
 */
export async function itemSaidaCanonicoCb(app: INestApplication): Promise<string> {
  const db = dbOf(app);
  await seedCatalogoMvp(db);
  await seedRegrasTransformacaoTz(db);
  const [saidaCb] = await db
    .select({ produtoId: schema.produtos.id })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.codigo, 'CB'), isNull(schema.produtos.deletedAt)))
    .limit(1);
  if (!saidaCb?.produtoId) {
    throw new Error('Produto CB seed ausente (catálogo MVP / Task 2)');
  }
  return saidaCb.produtoId;
}

/**
 * Emenda 7 — seed + bind TZ_A na transformação; devolve ids de saída CB/JAC.
 * Idempotente: re-bind da mesma TZ_A com subitens já existentes é permitido pelo tip.
 */
export async function prepararTransformacaoComRegraTzA(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
): Promise<{ regraId: string; itemSaidaCbId: string; itemSaidaJacId: string }> {
  const { default: request } = await import('supertest');
  const db = dbOf(app);
  await seedCatalogoMvp(db);
  await seedRegrasTransformacaoTz(db);

  const [regraA] = await db
    .select({ id: schema.regrasTransformacao.id })
    .from(schema.regrasTransformacao)
    .where(
      and(
        eq(schema.regrasTransformacao.codigo, 'TZ_A'),
        isNull(schema.regrasTransformacao.deletedAt),
      ),
    )
    .limit(1);
  if (!regraA) {
    throw new Error('Regra seed TZ_A ausente — rode seedRegrasTransformacaoTz (Task 2)');
  }

  const bind = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/regra`)
    .set('Cookie', cookies)
    .send({ regraTransformacaoId: regraA.id });
  if (bind.status !== 200 && bind.status !== 201) {
    throw new Error(
      `Falha ao vincular TZ_A na transformação: ${bind.status} ${JSON.stringify(bind.body)}`,
    );
  }

  const [saidaCb] = await db
    .select({ produtoId: schema.produtos.id })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.codigo, 'CB'), isNull(schema.produtos.deletedAt)))
    .limit(1);
  const [saidaJac] = await db
    .select({ produtoId: schema.produtos.id })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.codigo, 'JAC'), isNull(schema.produtos.deletedAt)))
    .limit(1);
  if (!saidaCb?.produtoId || !saidaJac?.produtoId) {
    throw new Error('Produtos CB/JAC seed ausentes (catálogo MVP / Task 2)');
  }
  return {
    regraId: regraA.id,
    itemSaidaCbId: saidaCb.produtoId,
    itemSaidaJacId: saidaJac.produtoId,
  };
}

/** Se item informado já é saída da regra, mantém; senão CB (Emenda 6/7). */
export function resolverItemSaidaRegra(
  produtoId: string,
  saidas: { itemSaidaCbId: string; itemSaidaJacId: string },
): string {
  if (
    produtoId === saidas.itemSaidaCbId ||
    produtoId === saidas.itemSaidaJacId
  ) {
    return produtoId;
  }
  return saidas.itemSaidaCbId;
}

/**
 * Emenda 7 — alinha `pedidos_venda_itens.produto_id` à saída efetiva
 * para `associar` não falhar com "Item de pedido incompatível".
 */
export async function alinharPedidoItemComSaidaCorte(
  app: INestApplication,
  pedidoVendaItemId: string,
  itemSaidaId: string,
): Promise<void> {
  const db = dbOf(app);
  const [item] = await db
    .select({
      id: schema.pedidosVendaItens.id,
      produtoId: schema.pedidosVendaItens.produtoId,
    })
    .from(schema.pedidosVendaItens)
    .where(eq(schema.pedidosVendaItens.id, pedidoVendaItemId))
    .limit(1);
  if (!item) {
    throw new Error(`Pedido item ${pedidoVendaItemId} ausente para alinhar saída O7`);
  }
  if (item.produtoId === itemSaidaId) return;
  await db
    .update(schema.pedidosVendaItens)
    .set({ produtoId: itemSaidaId, updatedAt: new Date() })
    .where(eq(schema.pedidosVendaItens.id, pedidoVendaItemId));
}

/**
 * Emenda 7 / DoD 7.9 — se checklist divergente sem divergência aberta,
 * abre `subpeca_faltante` (TZ_A incompleta é o caso legado típico).
 */
export async function fecharChecklistSeDivergente(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
): Promise<void> {
  const { default: request } = await import('supertest');
  const chk = await request(app.getHttpServer())
    .get(`/operacao/corte/${transformacaoId}/checklist`)
    .set('Cookie', cookies);
  if (chk.status !== 200) {
    throw new Error(
      `Falha ao obter checklist: ${chk.status} ${JSON.stringify(chk.body)}`,
    );
  }
  if (chk.body.divergente && !chk.body.divergenciaAbertaId) {
    const div = await request(app.getHttpServer())
      .post(`/operacao/corte/${transformacaoId}/divergencia`)
      .set('Cookie', cookies)
      .send({
        tipo: 'subpeca_faltante',
        detalhe: { origem: 'fixture-legado-onda7' },
        observacao: 'Fixture legada: checklist incompleto vs regra TZ_A',
      });
    if (div.status !== 200 && div.status !== 201) {
      throw new Error(
        `Falha ao abrir divergência de transformação: ${div.status} ${JSON.stringify(div.body)}`,
      );
    }
  }
}

/** Conclui corte fechando checklist (DoD 7.9) quando necessário. */
export async function concluirCorteOnda7(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
  body: Record<string, unknown> = {},
) {
  const { default: request } = await import('supertest');
  await fecharChecklistSeDivergente(app, cookies, transformacaoId);
  return request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/concluir`)
    .set('Cookie', cookies)
    .send(body);
}

/** Inicia um corte sobre uma peça e retorna o id da transformação. */
export async function iniciarCorte(
  app: INestApplication,
  cookies: string,
  pecaId: string,
  body: Partial<{ tipoTransformacao: string; motivo: string; motivoDetalhe: string }> = {},
): Promise<string> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/corte/pecas/${pecaId}/iniciar`)
    .set('Cookie', cookies)
    .send({
      tipoTransformacao: body.tipoTransformacao ?? 'subdivisao',
      motivo: body.motivo ?? 'necessidade_operacional',
      motivoDetalhe: body.motivoDetalhe,
    });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Falha ao iniciar corte: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  if (!res.body?.id) {
    throw new Error(`iniciarCorte sem id: ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
}

/**
 * Gera um subitem na transformação; retorna o id.
 * Emenda 7: bind TZ_A + remapeia item fora das saídas → CB.
 */
export async function adicionarSubitem(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
  produtoId: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const saidas = await prepararTransformacaoComRegraTzA(app, cookies, transformacaoId);
  const itemEfetivo = resolverItemSaidaRegra(produtoId, saidas);
  const res = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/subitens`)
    .set('Cookie', cookies)
    .send({ produtoId: itemEfetivo });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Falha ao adicionar subitem: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  if (!res.body?.id) {
    throw new Error(`adicionarSubitem sem id: ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
}

/** Pesa um subitem (automático por padrão). Retorna a resposta completa. */
export async function pesarSubitem(
  app: INestApplication,
  cookies: string,
  subitemId: string,
  body: Record<string, unknown> = { modoCaptura: 'automatico' },
) {
  const { default: request } = await import('supertest');
  return request(app.getHttpServer())
    .post(`/operacao/corte/subitens/${subitemId}/pesar`)
    .set('Cookie', cookies)
    .send(body);
}

/**
 * Leva um subitem até 'associado' + etiqueta emitida — destino completo para concluir.
 * Emenda 7: bind+saída+alinha pedidoVendaItemId à saída efetiva (DoD 7.6/7.7).
 */
export async function subitemCompleto(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
  produtoId: string,
  pedidoVendaItemId: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const saidas = await prepararTransformacaoComRegraTzA(app, cookies, transformacaoId);
  const itemEfetivo = resolverItemSaidaRegra(produtoId, saidas);
  await alinharPedidoItemComSaidaCorte(app, pedidoVendaItemId, itemEfetivo);

  const resAdd = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/subitens`)
    .set('Cookie', cookies)
    .send({ produtoId: itemEfetivo });
  if (resAdd.status !== 200 && resAdd.status !== 201) {
    throw new Error(
      `Falha ao adicionar subitem (completo): ${resAdd.status} ${JSON.stringify(resAdd.body)}`,
    );
  }
  const subitemId = resAdd.body.id as string;
  if (!subitemId) {
    throw new Error(`subitemCompleto sem id: ${JSON.stringify(resAdd.body)}`);
  }

  await pesarSubitem(app, cookies, subitemId);
  const assoc = await request(app.getHttpServer())
    .post(`/operacao/corte/subitens/${subitemId}/associar`)
    .set('Cookie', cookies)
    .send({ pedidoVendaItemId });
  if (assoc.status !== 200 && assoc.status !== 201) {
    throw new Error(
      `Falha ao associar subitem: ${assoc.status} ${JSON.stringify(assoc.body)}`,
    );
  }
  const etiq = await request(app.getHttpServer())
    .post(`/operacao/corte/subitens/${subitemId}/etiqueta`)
    .set('Cookie', cookies)
    .send();
  if (etiq.status !== 200 && etiq.status !== 201) {
    throw new Error(
      `Falha ao emitir etiqueta de subitem: ${etiq.status} ${JSON.stringify(etiq.body)}`,
    );
  }
  return subitemId;
}
