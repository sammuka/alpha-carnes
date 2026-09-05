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

function somarDiasIso(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Datas sequenciais longe das suítes que fixam 2026/2027 — o banco de teste é compartilhado. */
let proximaDataSeq = 0;

function ehConflitoDeCompraNoDia(erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : String(erro);
  return msg.includes('409') && msg.includes('Já existe compra programada');
}

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
  const maxTentativas = 60;
  let compraId: string | undefined;
  let ultimoErro = '';
  for (let i = 0; i < maxTentativas; i++) {
    proximaDataSeq += 1;
    const dataOperacao = somarDiasIso('2028-06-01', proximaDataSeq);
    try {
      compraId = await criarCompraConfirmada(app, comprasCookies, base, {
        dataOperacao,
        quantidade: 10,
      });
      break;
    } catch (erro) {
      ultimoErro = erro instanceof Error ? erro.message : String(erro);
      if (!ehConflitoDeCompraNoDia(erro)) throw erro;
    }
  }
  if (!compraId) {
    throw new Error(`Falha ao criar compra após ${maxTentativas} datas: ${ultimoErro}`);
  }
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
      itens: [{ produtoId: base.produtoId, quantidadeDeclarada: 10 }],
    })
    .expect(201);

  await request(srv)
    .post(`/operacao/recebimentos/${recebimentoId}/itens`)
    .set('Cookie', recebimentoCookies)
    .send({ produtoId: base.produtoId, quantidadeRecebida: 10 })
    .expect(201);

  const { db } = app.get<{ db: Db }>(DRIZZLE);
  await db.update(schema.recebimentosItens)
    .set({ requerBalanca: false, statusApuracao: 'entrada_direta' })
    .where(and(
      eq(schema.recebimentosItens.recebimentoId, recebimentoId),
      eq(schema.recebimentosItens.produtoId, base.produtoId),
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
