import type { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import {
  criarCompraConfirmada,
  criarPedidoFornecedorEnviado,
  iniciarRecebimentoViaPf,
  seedComercialBase,
} from './comercial-fixtures';
import { createTestUser, loginCookies } from './test-app';

type Db = NodePgDatabase<typeof schema>;

/**
 * Monta operação → fornecedor → pedido ao fornecedor → recebimento → NF → pesagem → conclusão
 * usando os serviços reais (nunca INSERT cru).
 */
export async function criarConclusaoConferencia(
  app: INestApplication,
): Promise<{ conclusaoId: string; recebimentoId: string }> {
  const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
  const compras = await createTestUser(app, { perfil: 'compras' });
  const recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
  const comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);

  const base = await seedComercialBase(app, { fator: 1 });
  const dataOperacao = `2026-${String(Math.floor(Math.random() * 11) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 27) + 1).padStart(2, '0')}`;
  const compraId = await criarCompraConfirmada(app, comprasCookies, base, {
    dataOperacao,
    quantidade: 10,
  });
  const pfId = await criarPedidoFornecedorEnviado(app, comprasCookies, compraId);
  const { recebimentoId } = await iniciarRecebimentoViaPf(app, recebimentoCookies, pfId);

  const { default: request } = await import('supertest');
  const srv = app.getHttpServer();

  await request(srv)
    .patch(`/operacao/recebimentos/${recebimentoId}/nfe`)
    .set('Cookie', recebimentoCookies)
    .send({ nfeNumero: '900301', nfeSerie: '1' })
    .expect(200);

  await request(srv)
    .post(`/operacao/pedidos-fornecedor/${pfId}/nf`)
    .set('Cookie', recebimentoCookies)
    .send({
      numero: '900301',
      recebimentoId,
      itens: [{ itemComercialId: base.itemComercialId, quantidadeDeclarada: 10 }],
    })
    .expect(201);

  await request(srv)
    .post(`/operacao/recebimentos/${recebimentoId}/itens`)
    .set('Cookie', recebimentoCookies)
    .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10 })
    .expect(201);

  const { db } = app.get<{ db: Db }>(DRIZZLE);
  await db.update(schema.recebimentosItens)
    .set({ requerBalanca: false, statusApuracao: 'entrada_direta' })
    .where(and(
      eq(schema.recebimentosItens.recebimentoId, recebimentoId),
      eq(schema.recebimentosItens.itemComercialId, base.itemComercialId),
    ));

  await request(srv)
    .post(`/operacao/recebimentos/${recebimentoId}/concluir`)
    .set('Cookie', recebimentoCookies)
    .send()
    .expect(201);

  const conf = await request(srv)
    .post(`/operacao/recebimentos/${recebimentoId}/conferencia/concluir`)
    .set('Cookie', recebimentoCookies)
    .send({ resultado: 'sem_divergencia' });
  if (conf.status !== 201) {
    throw new Error(`Falha ao concluir conferência: ${conf.status} ${JSON.stringify(conf.body)}`);
  }

  const conclusoes = await db
    .select({ id: schema.conclusoesConferencia.id })
    .from(schema.conclusoesConferencia)
    .where(eq(schema.conclusoesConferencia.recebimentoId, recebimentoId));
  const conclusao = conclusoes[0];
  if (!conclusao) {
    throw new Error('Conclusão de conferência não encontrada após fluxo completo');
  }

  return { conclusaoId: conclusao.id, recebimentoId };
}
