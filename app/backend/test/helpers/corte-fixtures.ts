import type { INestApplication } from '@nestjs/common';

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
  return res.body.id as string;
}

/** Gera um subitem na transformação; retorna o id. */
export async function adicionarSubitem(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
  itemComercialId: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/subitens`)
    .set('Cookie', cookies)
    .send({ itemComercialId });
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
 * Retorna o id do subitem.
 */
export async function subitemCompleto(
  app: INestApplication,
  cookies: string,
  transformacaoId: string,
  itemComercialId: string,
  pedidoVendaItemId: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const subitemId = await adicionarSubitem(app, cookies, transformacaoId, itemComercialId);
  await pesarSubitem(app, cookies, subitemId);
  await request(app.getHttpServer())
    .post(`/operacao/corte/subitens/${subitemId}/associar`)
    .set('Cookie', cookies)
    .send({ pedidoVendaItemId });
  await request(app.getHttpServer())
    .post(`/operacao/corte/subitens/${subitemId}/etiqueta`)
    .set('Cookie', cookies)
    .send();
  return subitemId;
}
