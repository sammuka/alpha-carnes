import { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada } from '../helpers/comercial-fixtures';
import { PedidosService } from '../../src/modules/comercial/pedidos/pedidos.service';
import { AdendosService } from '../../src/modules/comercial/pedidos/adendos.service';

/**
 * Task 7 — adendo de pedido com histórico append-only e overbooking AD-05.
 */
describe('adendos (adendo com histórico append-only)', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let comprasCookies: string;
  let pedidos: PedidosService;
  let adendos: AdendosService;
  let usuarioId: string;
  let base: { fornecedorId: string; itemCompraId: string; itemComercialId: string; clienteId: string };

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    pedidos = app.get(PedidosService);
    adendos = app.get(AdendosService);

    const drizzle = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    db = drizzle.db;
    const [usuario] = await db.select().from(schema.usuarios).limit(1);
    if (!usuario) throw new Error('Nenhum usuário seed disponível para o teste');
    usuarioId = usuario.id;

    base = await seedComercialBase(app, { fator: 1 });
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function criarPedidoComSaldo(dataOperacao: string, quantidadeDisponivel: number, quantidadePedida: number) {
    const compraProgramadaId = await criarCompraConfirmada(app, comprasCookies, base, {
      dataOperacao, quantidade: quantidadeDisponivel,
    });
    const pedido = await pedidos.criar({
      compraProgramadaId,
      clienteId: base.clienteId,
      dataOperacao,
      salvarComoRascunho: false,
      itens: [{ itemComercialId: base.itemComercialId, quantidadePedida }],
    }, usuarioId);
    const detalhe = await pedidos.detalhar(pedido.id);
    const item = detalhe.itens[0]!;
    return { pedidoId: pedido.id, itemId: item.id };
  }

  it('adendo incrementa o item e grava linha em adendos_pedido e auditoria na mesma transacao',
    async () => {
      const { pedidoId, itemId } = await criarPedidoComSaldo('2026-09-01', 10, 2);

      const resultado = await adendos.registrar(pedidoId, {
        itemComercialId: base.itemComercialId,
        quantidadeAdicionada: 3,
        motivo: 'cliente pediu mais unidades',
      }, usuarioId, false);

      expect(resultado.item.quantidadePedida).toBe('5.000');

      const [linhaAdendo] = await db.select().from(schema.adendosPedido)
        .where(eq(schema.adendosPedido.pedidoVendaItemId, itemId));
      expect(linhaAdendo).toMatchObject({
        pedidoVendaId: pedidoId,
        pedidoVendaItemId: itemId,
        quantidadeAnterior: '2.000',
        quantidadeAdicionada: '3.000',
        quantidadeResultante: '5.000',
        origemConsumo: 'virtual',
        motivo: 'cliente pediu mais unidades',
      });

      const linhasAuditoria = await db.select().from(schema.auditoria)
        .where(and(
          eq(schema.auditoria.tabela, 'adendos_pedido'),
          eq(schema.auditoria.registroId, linhaAdendo!.id),
        ));
      expect(linhasAuditoria).toHaveLength(1);
      expect(linhasAuditoria[0]).toMatchObject({ operacao: 'INSERT', modulo: 'comercial' });
    });

  it('adendo com deficit nao persiste e devolve challenge de overbooking', async () => {
    const { pedidoId, itemId } = await criarPedidoComSaldo('2026-09-02', 5, 2);

    await expect(adendos.registrar(pedidoId, {
      itemComercialId: base.itemComercialId,
      quantidadeAdicionada: 100,
      motivo: 'pedido extra do cliente',
    }, usuarioId, false)).rejects.toMatchObject({ status: 409 });

    const [item] = await db.select().from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, itemId));
    expect(item?.quantidadePedida).toBe('2.000');
    expect(item?.quantidadeOverbooking).toBe('0.000');

    const linhasAdendo = await db.select().from(schema.adendosPedido)
      .where(eq(schema.adendosPedido.pedidoVendaItemId, itemId));
    expect(linhasAdendo).toHaveLength(0);

    const reservas = await db.select().from(schema.reservasDisponibilidade)
      .where(eq(schema.reservasDisponibilidade.pedidoVendaItemId, itemId));
    expect(reservas).toHaveLength(1);
    expect(reservas[0]?.tipoConsumo).toBe('virtual');
  });

  it('confirmacao do adendo soma quantidade cria reserva overbooking e acumula pendencia', async () => {
    // saldo=5, pedido inicial consome 2 (virtual) e deixa 3 disponíveis para o adendo.
    const { pedidoId, itemId } = await criarPedidoComSaldo('2026-09-03', 5, 2);

    const primeiraConfirmacao = await adendos.registrar(pedidoId, {
      itemComercialId: base.itemComercialId,
      quantidadeAdicionada: 100,
      motivo: 'pedido extra confirmado pelo gestor',
    }, usuarioId, true);
    // 100 solicitados: 3 cobertos pelo saldo remanescente, 97 em déficit (overbooking).
    expect(primeiraConfirmacao.item.quantidadePedida).toBe('102.000');
    expect(primeiraConfirmacao.item.quantidadeOverbooking).toBe('97.000');

    const reservasOverbooking = await db.select().from(schema.reservasDisponibilidade)
      .where(and(
        eq(schema.reservasDisponibilidade.pedidoVendaItemId, itemId),
        eq(schema.reservasDisponibilidade.tipoConsumo, 'overbooking'),
      ));
    expect(reservasOverbooking).toHaveLength(1);
    expect(reservasOverbooking[0]?.quantidadeReservada).toBe('97.000');

    const [pendenciaAntes] = await db.select().from(schema.pendenciasOverbooking)
      .where(eq(schema.pendenciasOverbooking.pedidoVendaItemId, itemId));
    expect(pendenciaAntes?.quantidadeDeficit).toBe('97.000');

    const segundaConfirmacao = await adendos.registrar(pedidoId, {
      itemComercialId: base.itemComercialId,
      quantidadeAdicionada: 10,
      motivo: 'novo pedido extra confirmado pelo gestor',
    }, usuarioId, true);
    // Sem saldo restante: os 10 inteiros viram déficit adicional acumulado na mesma pendência.
    expect(segundaConfirmacao.item.quantidadeOverbooking).toBe('107.000');

    const reservasOverbookingApos = await db.select().from(schema.reservasDisponibilidade)
      .where(and(
        eq(schema.reservasDisponibilidade.pedidoVendaItemId, itemId),
        eq(schema.reservasDisponibilidade.tipoConsumo, 'overbooking'),
      ));
    expect(reservasOverbookingApos).toHaveLength(2);

    const pendenciasDoItem = await db.select().from(schema.pendenciasOverbooking)
      .where(eq(schema.pendenciasOverbooking.pedidoVendaItemId, itemId));
    expect(pendenciasDoItem).toHaveLength(1);
    expect(pendenciasDoItem[0]?.quantidadeDeficit).toBe('107.000');

    const historico = await db.select().from(schema.pendenciasOverbookingHistorico)
      .where(eq(schema.pendenciasOverbookingHistorico.pendenciaId, pendenciasDoItem[0]!.id))
      .orderBy(schema.pendenciasOverbookingHistorico.criadoEm);
    expect(historico.map((h) => h.acao)).toEqual([
      'confirmada_pelo_vendedor', 'deficit_aumentado_por_adendo',
    ]);
  });
});
