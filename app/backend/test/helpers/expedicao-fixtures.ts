import type { INestApplication } from '@nestjs/common';

/** Cria um caminhao planejado e retorna o id. */
export async function criarCaminhao(
  app: INestApplication,
  cookies: string,
  opts: { dataOperacao: string; placa?: string },
): Promise<string> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post('/operacao/expedicao/caminhoes')
    .set('Cookie', cookies)
    .send({
      placa: opts.placa ?? `ABC-${Date.now().toString().slice(-4)}`,
      motorista: 'Motorista Teste',
      dataOperacao: opts.dataOperacao,
    });
  if (res.status !== 201) throw new Error(`Falha ao criar caminhao: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

/** Abre a carga do caminhao (planejado -> em_carga). */
export async function abrirCarga(
  app: INestApplication,
  cookies: string,
  caminhaoId: string,
): Promise<void> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/expedicao/caminhoes/${caminhaoId}/abrir-carga`)
    .set('Cookie', cookies)
    .send();
  if (res.status !== 201) throw new Error(`Falha ao abrir carga: ${JSON.stringify(res.body)}`);
}

/** Vincula pedido ao caminhao. */
export async function vincularPedido(
  app: INestApplication,
  cookies: string,
  caminhaoId: string,
  pedidoVendaId: string,
): Promise<void> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/expedicao/caminhoes/${caminhaoId}/pedidos`)
    .set('Cookie', cookies)
    .send({ pedidoVendaId });
  if (res.status !== 201) throw new Error(`Falha ao vincular pedido: ${JSON.stringify(res.body)}`);
}

/** Adiciona peca a carga. Retorna o id do carga_item. */
export async function adicionarPecaNaCarga(
  app: INestApplication,
  cookies: string,
  caminhaoId: string,
  pecaId: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
    .set('Cookie', cookies)
    .send({ tipoOrigem: 'peca', id: pecaId });
  if (res.status !== 201) throw new Error(`Falha ao adicionar peca: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

/** Adiciona subitem a carga. Retorna o id do carga_item. */
export async function adicionarSubitemNaCarga(
  app: INestApplication,
  cookies: string,
  caminhaoId: string,
  subitemId: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/expedicao/caminhoes/${caminhaoId}/itens`)
    .set('Cookie', cookies)
    .send({ tipoOrigem: 'subitem', id: subitemId });
  if (res.status !== 201) throw new Error(`Falha ao adicionar subitem: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

/** Inicia conferencia (em_carga -> em_conferencia). */
export async function iniciarConferencia(
  app: INestApplication,
  cookies: string,
  caminhaoId: string,
): Promise<void> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/iniciar`)
    .set('Cookie', cookies)
    .send();
  if (res.status !== 201) throw new Error(`Falha ao iniciar conferencia: ${JSON.stringify(res.body)}`);
}

/** Conclui a conferencia. */
export async function concluirConferencia(
  app: INestApplication,
  cookies: string,
  caminhaoId: string,
): Promise<void> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/concluir`)
    .set('Cookie', cookies)
    .send();
  if (res.status !== 201) throw new Error(`Falha ao concluir conferencia: ${JSON.stringify(res.body)}`);
}

/** Fecha o caminhao (em_conferencia -> fechado). */
export async function fecharCaminhao(
  app: INestApplication,
  cookies: string,
  caminhaoId: string,
  opts: { forcado?: boolean; justificativa?: string } = {},
): Promise<void> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer())
    .post(`/operacao/expedicao/caminhoes/${caminhaoId}/fechar`)
    .set('Cookie', cookies)
    .send({ forcado: opts.forcado, justificativa: opts.justificativa });
  if (res.status !== 201) throw new Error(`Falha ao fechar caminhao: ${JSON.stringify(res.body)}`);
}

/**
 * Leva um caminhao do estado 'planejado' ate 'fechado'.
 * Precisa: cookie com EXPEDICAO_GERENCIAR, pelo menos uma peca elegivel vinculada.
 */
export async function fecharCaminhaoCompleto(
  app: INestApplication,
  cookies: string,
  caminhaoId: string,
  pecaId: string,
): Promise<void> {
  await abrirCarga(app, cookies, caminhaoId);
  await adicionarPecaNaCarga(app, cookies, caminhaoId, pecaId);
  await iniciarConferencia(app, cookies, caminhaoId);

  // Conferir a peca via QR automatico (leitor deve estar configurado)
  const { default: request } = await import('supertest');
  await request(app.getHttpServer())
    .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
    .set('Cookie', cookies)
    .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });

  await concluirConferencia(app, cookies, caminhaoId);
  await fecharCaminhao(app, cookies, caminhaoId);
}
