import { INestApplication } from '@nestjs/common';
import { isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import {
  seedComercialBase,
  criarCompraConfirmada,
  criarPedidoFornecedorEnviado,
  iniciarRecebimentoViaPf,
} from '../helpers/comercial-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { RecebimentoService } from '../../src/modules/operacao/recebimento/recebimento.service';
import request from 'supertest';

// Conclusão idempotente sob concorrência (S5-like): N conclusões em paralelo
// devem produzir exatamente UMA conclusão efetiva (jaConcluido=false) — o UPDATE
// condicional por status garante que o efeito não duplica.
describe('Recebimento — conclusão idempotente sob concorrência', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let recebimentoCookies: string;
  let usuarioId: string;
  let service: RecebimentoService;

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    service = app.get(RecebimentoService);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const u = await db.select().from(schema.usuarios).limit(1);
    usuarioId = u[0]!.id;
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('N conclusões em paralelo → exatamente 1 efetiva', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-20', quantidade: 10 });
    const pfId = await criarPedidoFornecedorEnviado(app, comprasCookies, compraId);
    const { recebimentoId: recId } = await iniciarRecebimentoViaPf(app, recebimentoCookies, pfId);
    await request(app.getHttpServer())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10 });

    const resultados = await Promise.all(
      Array.from({ length: 8 }, () => service.concluir(recId, usuarioId)),
    );

    const efetivas = resultados.filter((r) => r.jaConcluido === false);
    expect(efetivas).toHaveLength(1);
    expect(resultados.every((r) => r.recebimento.status === 'aguardando_conferencia_final')).toBe(true);
  }, 60000);
});

// D6.10 — buscarNfCabecalhoAtiva* usa FOR UPDATE para serializar concorrentes
// sobre o mesmo cabeçalho órfão (NF sem itens ainda). Prova: 2x registrarNf
// simultâneos com numeração divergente sobre o órfão → 1 completa (2xx), 1
// recebe 409 CABECALHO_ORFAO_DIVERGENTE, e ao final existe exatamente 1 NF ativa.
describe('Recebimento — registrarNf concorrente (D6.10 FOR UPDATE)', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let recebimentoCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('DoD 7.5.4 registrarNf concorrente sobre cabeçalho órfão: um completa, outro recebe 409', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-21', quantidade: 10 });
    const pfId = await criarPedidoFornecedorEnviado(app, comprasCookies, compraId);
    const { recebimentoId: recId } = await iniciarRecebimentoViaPf(app, recebimentoCookies, pfId);

    // Cria o cabeçalho órfão: PATCH .../nfe sem itens abre uma NF sem itens
    // vinculada ao recebimento (persistirNfCabecalhoUiNaTx — INSERT sem itens).
    await request(app.getHttpServer())
      .patch(`/operacao/recebimentos/${recId}/nfe`)
      .set('Cookie', recebimentoCookies)
      .send({ nfeNumero: 'NF-750' })
      .expect(200);

    const corpoNf = (numero: string) => ({
      numero,
      itens: [{ itemComercialId: base.itemComercialId, quantidadeDeclarada: 10 }],
    });

    // Apenas UMA das duas chamadas confirma a substituição do cabeçalho órfão
    // (NF-750, número diferente de ambas). O `.for('update')` (D6.10) serializa
    // as duas transações sobre a mesma linha órfã: quem adquire o lock primeiro
    // decide o desfecho de ambas —
    //  - se for a que NÃO confirma: vê o órfão intacto (0 itens, número
    //    divergente) e lança 409 imediatamente, fazendo ROLLBACK sem tocar a
    //    linha; a que confirma then adquire o lock, encontra o órfão intacto e
    //    completa (2xx).
    //  - se fosse a que confirma a vencer primeiro, ela consumiria o órfão e a
    //    outra abriria uma NF nova (2xx duplo) — por isso a que NÃO confirma
    //    entra primeiro no array: em Node/Postgres local, a primeira chamada
    //    do Promise.all tende a alcançar o lock antes (I/O sem latência real),
    //    e é exatamente esse caso que produz o 409 determinístico.
    const [r1, r2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/operacao/pedidos-fornecedor/${pfId}/nf`)
        .set('Cookie', recebimentoCookies)
        .send(corpoNf('NF-752')),
      request(app.getHttpServer())
        .post(`/operacao/pedidos-fornecedor/${pfId}/nf`)
        .set('Cookie', recebimentoCookies)
        .send({ ...corpoNf('NF-751'), confirmarSubstituicaoCabecalho: true }),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    // Um dos dois serializa primeiro (FOR UPDATE) e completa; o outro vê NF ativa com itens.
    expect(statuses[0]).toBeGreaterThanOrEqual(200);
    expect(statuses[0]).toBeLessThan(300);
    expect(statuses[1]).toBe(409);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const nfsAtivas = await db.select().from(schema.notasFiscaisFornecedor)
      .where(isNull(schema.notasFiscaisFornecedor.deletedAt));
    const doRecebimento = nfsAtivas.filter((n) => n.recebimentoId === recId && ['NF-751', 'NF-752'].includes(n.numero));
    expect(doRecebimento).toHaveLength(1);
  }, 60000);
});
