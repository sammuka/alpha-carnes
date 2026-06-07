import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, lerDisponibilidade } from '../helpers/comercial-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { PedidosService } from '../../src/modules/comercial/pedidos/pedidos.service';
import request from 'supertest';

// TESTE MAIS IMPORTANTE DA FASE (anti-overbooking sob concorrência).
// Dispara N reservas em paralelo (Promise.all) cujo total excede o saldo e prova:
// (a) quantidade_disponivel nunca fica negativa, (b) Σ reservas == total gerado,
// (c) o excedente vira quantidadePendente (nunca perdido), (d) consistência
// Σ reservas_disponibilidade.quantidade == disponibilidades_virtuais.reservada.
describe('Pedidos — concorrência anti-overbooking', () => {
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

  async function somaReservasAtivas(disponibilidadeId: string): Promise<number> {
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const rows = await db
      .select({ total: sql<string>`coalesce(sum(${schema.reservasDisponibilidade.quantidadeReservada}), 0)` })
      .from(schema.reservasDisponibilidade)
      .where(eq(schema.reservasDisponibilidade.disponibilidadeVirtualId, disponibilidadeId));
    return Number(rows[0]?.total ?? 0);
  }

  async function somaPendentePorItem(itemComercialId: string): Promise<number> {
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const rows = await db
      .select({ total: sql<string>`coalesce(sum(${schema.pedidosVendaItens.quantidadePendente}), 0)` })
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.itemComercialId, itemComercialId));
    return Number(rows[0]?.total ?? 0);
  }

  it('caminho feliz: T=10, N=20 reservas de 1 em paralelo — sem overbooking', async () => {
    const T = 10;
    const N = 20;
    const { base, compraId } = await cenarioComSaldo('2026-11-01', T);

    const chamadas = Array.from({ length: N }, () =>
      service.criar(
        {
          compraProgramadaId: compraId,
          clienteId: base.clienteId,
          dataOperacao: '2026-11-01',
          itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 1 }],
        } as never,
        usuarioId,
      ),
    );
    await Promise.all(chamadas);

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(0); // nunca negativo
    expect(Number(disp!.quantidadeReservada)).toBe(T); // == total gerado
    expect(await somaReservasAtivas(disp!.id)).toBe(T); // consistência
    expect(await somaPendentePorItem(base.itemComercialId)).toBe(N - T); // excedente: 20-10
    expect(disp!.status).toBe('esgotada');
  }, 60000);

  it('B2 — caminho PARCIAL sob concorrência: T=10, N=20 reservas de 3', async () => {
    const T = 10;
    const N = 20;
    const r = 3;
    const { base, compraId } = await cenarioComSaldo('2026-11-02', T);

    const chamadas = Array.from({ length: N }, () =>
      service.criar(
        {
          compraProgramadaId: compraId,
          clienteId: base.clienteId,
          dataOperacao: '2026-11-02',
          itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: r }],
        } as never,
        usuarioId,
      ),
    );
    await Promise.all(chamadas);

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    // (a) nunca negativo
    expect(Number(disp!.quantidadeDisponivel)).toBe(0);
    // (b) Σ reservadoEfetivo == total gerado
    expect(Number(disp!.quantidadeReservada)).toBe(T);
    // (c) excedente vira pendente, nunca perdido: 20×3 − 10 = 50
    expect(await somaPendentePorItem(base.itemComercialId)).toBe(N * r - T);
    // (d) consistência: Σ reservas == reservada da disponibilidade
    expect(await somaReservasAtivas(disp!.id)).toBe(T);
  }, 60000);

  it('fronteira: T=10, 3 chamadas de 4 → reservados 4+4+2, último pendente 2', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-11-03', 10);

    const resultados = await Promise.all(
      [4, 4, 4].map(() =>
        service.criar(
          {
            compraProgramadaId: compraId,
            clienteId: base.clienteId,
            dataOperacao: '2026-11-03',
            itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 4 }],
          } as never,
          usuarioId,
        ),
      ),
    );
    expect(resultados).toHaveLength(3);

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(0);
    expect(Number(disp!.quantidadeReservada)).toBe(10); // 4+4+2
    expect(await somaPendentePorItem(base.itemComercialId)).toBe(2); // 12 pedidas − 10 saldo
  }, 60000);
});
