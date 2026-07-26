import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, lerDisponibilidade } from '../helpers/comercial-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { PedidosService } from '../../src/modules/comercial/pedidos/pedidos.service';
import { OverbookingChallengeException } from '../../src/modules/comercial/pedidos/overbooking-challenge.exception';
import request from 'supertest';

/**
 * AD-05: challenge 409 sem mutação. Sob concorrência, pedidos que cabem no saldo
 * são criados; o excedente recebe OVERBOOKING_CONFIRMACAO_NECESSARIA sem escrita.
 */
describe('Pedidos — concorrência anti-overbooking (AD-05)', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let usuarioId: string;
  let service: PedidosService;

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    service = app.get(PedidosService);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const u = await db.select().from(schema.usuarios).limit(1);
    usuarioId = u[0]!.id;
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function cenarioComSaldo(dataOperacao: string, total: number) {
    const base = await seedComercialBase(app, { fator: 1 });
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao,
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: total }],
      });
    const compraId = criar.body.id as string;
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();
    return { base, compraId };
  }

  /** Onda 4 / AD-03: pedido aberto é único por (cliente, item, operação); a concorrência
   * anti-overbooking deste teste é sobre o saldo compartilhado do item, não sobre o
   * cliente — por isso cada tentativa concorrente usa um cliente independente. */
  async function criarClientesExtras(quantidade: number): Promise<string[]> {
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const ids: string[] = [];
    for (let i = 0; i < quantidade; i += 1) {
      const sufixo = `${Math.round(performance.now() * 1000)}-${i}-${Math.floor(Math.random() * 1e6)}`;
      const [cliente] = await db.insert(schema.clientes).values({
        codigo: `CLICC-${sufixo}`,
        razaoSocial: `Cliente Concorrência ${i}`,
        documentoFiscal: `DOCCC-${sufixo}`,
      }).returning();
      if (!cliente) throw new Error('Falha ao criar cliente extra do teste');
      ids.push(cliente.id);
    }
    return ids;
  }

  async function somaReservasAtivas(disponibilidadeId: string): Promise<number> {
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const rows = await db
      .select({ total: sql<string>`coalesce(sum(${schema.reservasDisponibilidade.quantidadeReservada}), 0)` })
      .from(schema.reservasDisponibilidade)
      .where(eq(schema.reservasDisponibilidade.disponibilidadeVirtualId, disponibilidadeId));
    return Number(rows[0]?.total ?? 0);
  }

  async function criarSafe(
    dto: {
      compraProgramadaId: string;
      clienteId: string;
      dataOperacao: string;
      itens: Array<{ itemComercialId: string; quantidadePedida: number }>;
    },
  ): Promise<'ok' | 'challenge' | 'error'> {
    try {
      await service.criar(dto as never, usuarioId, false);
      return 'ok';
    } catch (e) {
      if (e instanceof OverbookingChallengeException) return 'challenge';
      return 'error';
    }
  }

  it('caminho feliz: T=10, N=20 reservas de 1 — 10 ok + 10 challenge; sem mutação no challenge', async () => {
    const T = 10;
    const N = 20;
    const { base, compraId } = await cenarioComSaldo('2026-11-01', T);
    const clientes = await criarClientesExtras(N);

    const resultados = await Promise.all(
      clientes.map((clienteId) =>
        criarSafe({
          compraProgramadaId: compraId,
          clienteId,
          dataOperacao: '2026-11-01',
          itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 1 }],
        }),
      ),
    );

    expect(resultados.filter((r) => r === 'ok')).toHaveLength(T);
    expect(resultados.filter((r) => r === 'challenge')).toHaveLength(N - T);
    expect(resultados.filter((r) => r === 'error')).toHaveLength(0);

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(0);
    expect(Number(disp!.quantidadeReservada)).toBe(T);
    expect(await somaReservasAtivas(disp!.id)).toBe(T);
    expect(disp!.status).toBe('esgotada');
  }, 60000);

  it('B2 — T=10, N=20 de 3: só cabem reservas totais sem challenge; restante 409', async () => {
    const T = 10;
    const N = 20;
    const r = 3;
    const { base, compraId } = await cenarioComSaldo('2026-11-02', T);
    const clientes = await criarClientesExtras(N);

    const resultados = await Promise.all(
      clientes.map((clienteId) =>
        criarSafe({
          compraProgramadaId: compraId,
          clienteId,
          dataOperacao: '2026-11-02',
          itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: r }],
        }),
      ),
    );

    const ok = resultados.filter((x) => x === 'ok').length;
    const challenge = resultados.filter((x) => x === 'challenge').length;
    expect(ok + challenge).toBe(N);
    expect(resultados.filter((x) => x === 'error')).toHaveLength(0);
    // Cada sucesso consome 3; cabem floor(10/3)=3 sucessos se todos pedem 3.
    expect(ok).toBeLessThanOrEqual(Math.floor(T / r));

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeDisponivel)).toBeGreaterThanOrEqual(0);
    expect(Number(disp!.quantidadeReservada)).toBe(ok * r);
    expect(await somaReservasAtivas(disp!.id)).toBe(ok * r);
  }, 60000);

  it('fronteira: T=10, 3 chamadas de 4 → 2 ok (8) + 1 challenge; saldo restante 2', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-11-03', 10);
    const clientes = await criarClientesExtras(3);

    const resultados = await Promise.all(
      clientes.map((clienteId) =>
        criarSafe({
          compraProgramadaId: compraId,
          clienteId,
          dataOperacao: '2026-11-03',
          itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 4 }],
        }),
      ),
    );
    expect(resultados.filter((r) => r === 'ok')).toHaveLength(2);
    expect(resultados.filter((r) => r === 'challenge')).toHaveLength(1);

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(2);
    expect(Number(disp!.quantidadeReservada)).toBe(8);
  }, 60000);
});
