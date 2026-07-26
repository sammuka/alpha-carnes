import { INestApplication } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada } from '../helpers/comercial-fixtures';
import { PedidosService } from '../../src/modules/comercial/pedidos/pedidos.service';

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Task 6 — AD-03 (unicidade do pedido aberto) e D31 (herança representante/rota).
 */
describe('pedidos-onda4 (AD-03 unicidade + D31 herança)', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let service: PedidosService;
  let usuarioId: string;
  let dtoBase: {
    compraProgramadaId: string;
    clienteId: string;
    dataOperacao: string;
    itens: Array<{ itemComercialId: string; quantidadePedida: number }>;
  };
  let ctx: {
    clienteComRotaId: string;
    clienteSemRotaId: string;
    representanteId: string;
    nomeRepresentante: string;
    nomeRotaDoCliente: string;
  };

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    service = app.get(PedidosService);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const [usuario] = await db.select().from(schema.usuarios).limit(1);
    if (!usuario) throw new Error('Nenhum usuário seed disponível para o teste');
    usuarioId = usuario.id;

    const base = await seedComercialBase(app, { fator: 1 });
    const datasComSaldo = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'];
    const compraIdPorData = new Map<string, string>();
    for (const dataOperacao of datasComSaldo) {
      const compraId = await criarCompraConfirmada(app, comprasCookies, base, {
        dataOperacao,
        quantidade: 10,
      });
      compraIdPorData.set(dataOperacao, compraId);
    }

    dtoBase = {
      compraProgramadaId: compraIdPorData.get('2026-08-05')!,
      clienteId: base.clienteId,
      dataOperacao: '2026-08-05',
      itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 2 }],
    };

    const [rota] = await db.insert(schema.rotas)
      .values({ codigo: uid('ROTA'), nome: 'Rota Norte' })
      .returning();
    const [representante] = await db.insert(schema.representantes)
      .values({ codigo: uid('REP'), nome: 'Representante Sul' })
      .returning();
    if (!rota || !representante) throw new Error('Falha ao criar rota/representante do teste');

    const [clienteComRota] = await db.insert(schema.clientes).values({
      codigo: uid('CLIHER'),
      razaoSocial: 'Cliente Com Rota',
      documentoFiscal: uid('DOCHER'),
      rotaId: rota.id,
      representanteId: representante.id,
    }).returning();
    const [clienteSemRota] = await db.insert(schema.clientes).values({
      codigo: uid('CLISEM'),
      razaoSocial: 'Cliente Sem Rota',
      documentoFiscal: uid('DOCSEM'),
    }).returning();
    if (!clienteComRota || !clienteSemRota) throw new Error('Falha ao criar clientes do teste');

    ctx = {
      clienteComRotaId: clienteComRota.id,
      clienteSemRotaId: clienteSemRota.id,
      representanteId: representante.id,
      nomeRepresentante: representante.nome,
      nomeRotaDoCliente: rota.nome,
    };
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('recusa segundo pedido aberto do mesmo cliente item e operacao com 409 PEDIDO_ABERTO_EXISTENTE',
    async () => {
      await service.criar(dtoBase, usuarioId);
      await expect(service.criar(dtoBase, usuarioId)).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: 'PEDIDO_ABERTO_EXISTENTE' }),
      });
    });

  it('permite pedidos abertos do mesmo cliente e item em operacoes diferentes', async () => {
    await service.criar({ ...dtoBase, dataOperacao: '2026-08-01' }, usuarioId);
    await expect(service.criar({ ...dtoBase, dataOperacao: '2026-08-02' }, usuarioId))
      .resolves.toMatchObject({ status: 'em_elaboracao_reserva_ativa' });
  });

  it('criar em data sem operacao nao checa AD-03 e cria a operacao do dia', async () => {
    // Data virgem: não há operação nem disponibilidade — o próprio déficit é overbooking,
    // por isso a criação exige a confirmação explícita (AD-05); o ponto testado aqui é que
    // a ausência de operação NÃO impede a criação nem aciona a checagem AD-03 (ramo nulo).
    const pedido = await service.criar({ ...dtoBase, dataOperacao: '2026-08-09' }, usuarioId, true);
    expect(pedido.operacaoId).toEqual(expect.any(String));
    await expect(service.buscarAberto({
      clienteId: dtoBase.clienteId,
      itemComercialId: dtoBase.itens[0]!.itemComercialId,
      dataOperacao: '2026-08-10',
    })).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ code: 'OPERACAO_NAO_ENCONTRADA' }),
    });
  });

  it('pedido herda rota do cliente e expoe o representante do cadastro', async () => {
    const comHeranca = await service.criar(
      { ...dtoBase, clienteId: ctx.clienteComRotaId, rotaPrevista: undefined }, usuarioId,
    );
    expect(comHeranca.rotaPrevista).toBe(ctx.nomeRotaDoCliente);
    const detalhe = await service.detalhar(comHeranca.id);
    expect(detalhe.heranca).toMatchObject({
      representanteId: ctx.representanteId,
      representanteNome: ctx.nomeRepresentante,
      rotaNome: ctx.nomeRotaDoCliente,
    });

    const comDesvio = await service.criar(
      { ...dtoBase, clienteId: ctx.clienteComRotaId, dataOperacao: '2026-08-03',
        rotaPrevista: 'Entrega direta' }, usuarioId,
    );
    expect(comDesvio.rotaPrevista).toBe('Entrega direta');

    const semRota = await service.criar(
      { ...dtoBase, clienteId: ctx.clienteSemRotaId, dataOperacao: '2026-08-04',
        rotaPrevista: undefined }, usuarioId,
    );
    expect(semRota.rotaPrevista).toBeNull();
  });
});
