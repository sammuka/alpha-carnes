import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { criarCompraConfirmada } from '../helpers/comercial-fixtures';

type Db = NodePgDatabase<typeof schema>;

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

let cnpjSeq = 11_222_333;
function proximoCnpj(): string {
  cnpjSeq += 1;
  const base = `${String(cnpjSeq).padStart(8, '0')}0001`;
  const calc = (slice: string, pesos: number[]) => {
    const nums = slice.split('').map(Number);
    const soma = nums.reduce((s, n, i) => s + n * pesos[i]!, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(`${base}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`;
}

let placaSeq = 0;
function proximaPlaca(): string {
  placaSeq += 1;
  const d = placaSeq % 10;
  const letra = String.fromCharCode(65 + (Math.floor(placaSeq / 10) % 26));
  const rest = String(placaSeq % 100).padStart(2, '0');
  return `OAB-${d}${letra}${rest}`;
}

function bearerFromCookies(cookies: string): string {
  const match = cookies.match(/access_token=([^;]+)/);
  if (!match?.[1]) throw new Error('access_token ausente no cookie de teste');
  return match[1];
}

describe('Onda 12 — domínio de campos', () => {
  let app: INestApplication;
  let db: Db;
  let adminCookies: string;
  let token: string;
  let comercialCookies: string;
  let comprasCookies: string;
  let expedicaoCookies: string;
  let estoqueCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const expedicao = await createTestUser(app, { perfil: 'expedicao' });
    const estoque = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    token = bearerFromCookies(adminCookies);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    expedicaoCookies = await loginCookies(app, expedicao.adminEmail, expedicao.adminPassword);
    estoqueCookies = await loginCookies(app, estoque.adminEmail, estoque.adminPassword);
  }, 60_000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  async function contarAuditoria(tabela: string): Promise<number> {
    const rows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.auditoria)
      .where(eq(schema.auditoria.tabela, tabela));
    return rows[0]?.total ?? 0;
  }

  async function criarRepresentante(over: Record<string, unknown> = {}) {
    const res = await request(srv()).post('/representantes').set('Cookie', adminCookies).send({
      codigo: uid('REP'),
      nome: uid('Representante'),
      status: 'ativo',
      ...over,
    });
    expect(res.status).toBe(201);
    return res.body as { id: string; codigo: string; nome: string; status: string };
  }

  async function criarRota(over: Record<string, unknown> = {}) {
    const res = await request(srv()).post('/rotas').set('Cookie', adminCookies).send({
      codigo: uid('ROT'),
      nome: uid('Rota'),
      paradas: [],
      diasAtendimento: [],
      status: 'ativo',
      ...over,
    });
    return res;
  }

  async function criarCaminhaoFrota(over: Record<string, unknown> = {}) {
    const res = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies).send({
      placa: proximaPlaca(),
      status: 'ativo',
      ...over,
    });
    expect(res.status).toBe(201);
    return res.body as { id: string; placa: string; status: string };
  }

  async function criarMotorista(over: Record<string, unknown> = {}) {
    const res = await request(srv()).post('/frota/motoristas').set('Cookie', adminCookies).send({
      nome: uid('Mot'),
      documento: uid('CNH'),
      status: 'ativo',
      ...over,
    });
    expect(res.status).toBe(201);
    return res.body as { id: string; nome: string; status: string };
  }

  it('DoD 12.2 rejeita unidade livre e aceita o enum nos três cadastros', async () => {
    const livreProduto = await request(srv()).post('/produtos').set('Cookie', adminCookies).send({
      codigo: uid('PRD'),
      nome: 'Produto livre',
      unidadePedido: 'caixa',
    });
    expect(livreProduto.status).toBe(400);

    const okProduto = await request(srv()).post('/produtos').set('Cookie', adminCookies).send({
      codigo: uid('PRD'),
      nome: 'Produto kg',
      unidadePedido: 'kg',
    });
    expect(okProduto.status).toBe(201);
    expect(okProduto.body.unidadePedido).toBe('kg');

    const livreCompra = await request(srv()).post('/itens-compra').set('Cookie', adminCookies).send({
      codigo: uid('ICO'),
      descricao: 'Item livre',
      unidadeCompra: 'peca',
    });
    expect(livreCompra.status).toBe(400);

    const okCompra = await request(srv()).post('/itens-compra').set('Cookie', adminCookies).send({
      codigo: uid('ICO'),
      descricao: 'Item unidade',
      unidadeCompra: 'unidade',
    });
    expect(okCompra.status).toBe(201);
    expect(okCompra.body.unidadeCompra).toBe('unidade');

    const livreComercial = await request(srv()).post('/itens-comerciais').set('Cookie', adminCookies)
      .send({
        codigo: uid('ICM'),
        descricao: 'Item litro',
        unidadeComercial: 'litro',
      });
    expect(livreComercial.status).toBe(400);

    const okComercial = await request(srv()).post('/itens-comerciais').set('Cookie', adminCookies)
      .send({
        codigo: uid('ICM'),
        descricao: 'Item kg',
        unidadeComercial: 'kg',
      });
    expect(okComercial.status).toBe(201);
    expect(okComercial.body.unidadeComercial).toBe('kg');
  });

  it('DoD 12.9 rejeita UF fora do enum em cliente e caminhão', async () => {
    const cliente = await request(srv()).post('/clientes').set('Cookie', adminCookies).send({
      razaoSocial: 'Cliente UF',
      documentoFiscal: proximoCnpj(),
      dadosFiscaisJson: { uf: 'XX' },
    });
    expect(cliente.status).toBe(400);

    const caminhao = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies).send({
      placa: proximaPlaca(),
      certificadoUf: 'XX',
    });
    expect(caminhao.status).toBe(400);

    const clienteOk = await request(srv()).post('/clientes').set('Cookie', adminCookies).send({
      razaoSocial: 'Cliente SP',
      documentoFiscal: proximoCnpj(),
      dadosFiscaisJson: { uf: 'SP' },
    });
    expect(clienteOk.status).toBe(201);
  });

  it('DoD 12.4a catálogos de criação excluem inativos', async () => {
    const casos = [
      {
        endpoint: '/rotas',
        buscaUnica: uid('BUSCAROTA'),
        criarAtivo: async (busca: string) => {
          const res = await criarRota({ codigo: busca, nome: `${busca} ativa` });
          expect(res.status).toBe(201);
          return res.body.id as string;
        },
        criarInativo: async (busca: string) => {
          const res = await criarRota({
            codigo: `${busca}-IN`,
            nome: `${busca} inativa`,
            status: 'inativo',
          });
          expect(res.status).toBe(201);
          return res.body.id as string;
        },
      },
      {
        endpoint: '/produtos',
        buscaUnica: uid('BUSCAPRD'),
        criarAtivo: async (busca: string) => {
          const res = await request(srv()).post('/produtos').set('Cookie', adminCookies).send({
            codigo: busca, nome: `${busca} ativo`, unidadePedido: 'kg',
          });
          expect(res.status).toBe(201);
          return res.body.id as string;
        },
        criarInativo: async (busca: string) => {
          const res = await request(srv()).post('/produtos').set('Cookie', adminCookies).send({
            codigo: `${busca}-IN`, nome: `${busca} inativo`, unidadePedido: 'kg', status: 'inativo',
          });
          expect(res.status).toBe(201);
          return res.body.id as string;
        },
      },
      {
        endpoint: '/fornecedores',
        buscaUnica: uid('BUSCAFORN'),
        criarAtivo: async (busca: string) => {
          const res = await request(srv()).post('/fornecedores').set('Cookie', adminCookies).send({
            codigo: busca, razaoSocial: `${busca} ativo`, documentoFiscal: proximoCnpj(),
          });
          expect(res.status).toBe(201);
          return res.body.id as string;
        },
        criarInativo: async (busca: string) => {
          const res = await request(srv()).post('/fornecedores').set('Cookie', adminCookies).send({
            codigo: `${busca}-IN`,
            razaoSocial: `${busca} inativo`,
            documentoFiscal: proximoCnpj(),
            status: 'inativo',
          });
          expect(res.status).toBe(201);
          return res.body.id as string;
        },
      },
      {
        endpoint: '/itens-compra',
        buscaUnica: uid('BUSCAICO'),
        criarAtivo: async (busca: string) => {
          const res = await request(srv()).post('/itens-compra').set('Cookie', adminCookies).send({
            codigo: busca, descricao: `${busca} ativo`, unidadeCompra: 'unidade',
          });
          expect(res.status).toBe(201);
          return res.body.id as string;
        },
        criarInativo: async (busca: string) => {
          const res = await request(srv()).post('/itens-compra').set('Cookie', adminCookies).send({
            codigo: `${busca}-IN`,
            descricao: `${busca} inativo`,
            unidadeCompra: 'unidade',
            status: 'inativo',
          });
          expect(res.status).toBe(201);
          return res.body.id as string;
        },
      },
      {
        endpoint: '/itens-comerciais',
        buscaUnica: uid('BUSCAICM'),
        criarAtivo: async (busca: string) => {
          const res = await request(srv()).post('/itens-comerciais').set('Cookie', adminCookies)
            .send({ codigo: busca, descricao: `${busca} ativo`, unidadeComercial: 'kg' });
          expect(res.status).toBe(201);
          return res.body.id as string;
        },
        criarInativo: async (busca: string) => {
          const res = await request(srv()).post('/itens-comerciais').set('Cookie', adminCookies)
            .send({
              codigo: `${busca}-IN`,
              descricao: `${busca} inativo`,
              unidadeComercial: 'kg',
              status: 'inativo',
            });
          expect(res.status).toBe(201);
          return res.body.id as string;
        },
      },
    ];

    for (const caso of casos) {
      const ativoId = await caso.criarAtivo(caso.buscaUnica);
      const inativoId = await caso.criarInativo(caso.buscaUnica);
      const response = await request(app.getHttpServer())
        .get(`${caso.endpoint}?page=1&pageSize=100&status=ativo&search=${caso.buscaUnica}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = (response.body.data as Array<{ id: string }>).map(({ id }) => id);
      expect(ids).toContain(ativoId);
      expect(ids).not.toContain(inativoId);
      expect(response.body.total).toBe(1);
    }
  });

  async function basePedido() {
    const produtoCompra = await request(srv()).post('/itens-compra').set('Cookie', adminCookies).send({
      codigo: uid('ICO'), descricao: 'Boi O12', unidadeCompra: 'unidade',
    });
    const produto = await request(srv()).post('/itens-comerciais').set('Cookie', adminCookies)
      .send({ codigo: uid('ICM'), descricao: 'Dianteiro O12', unidadeComercial: 'kg' });
    expect(produtoCompra.status).toBe(201);
    expect(produto.status).toBe(201);
    const regra = await request(srv()).post('/regras-desdobramento').set('Cookie', adminCookies).send({
      produtoId: produtoCompra.body.id,
      produtoId: produto.body.id,
      fatorQuantidade: 1,
      vigenciaInicio: '2026-01-01T00:00:00.000Z',
    });
    expect(regra.status).toBe(201);
    const fornecedor = await request(srv()).post('/fornecedores').set('Cookie', adminCookies).send({
      codigo: uid('FORN'), razaoSocial: 'Forn O12', documentoFiscal: proximoCnpj(),
    });
    expect(fornecedor.status).toBe(201);
    const cliente = await request(srv()).post('/clientes').set('Cookie', adminCookies).send({
      razaoSocial: 'Cliente Pedido O12', documentoFiscal: proximoCnpj(),
    });
    expect(cliente.status).toBe(201);
    const compraId = await criarCompraConfirmada(
      app,
      comprasCookies,
      { fornecedorId: fornecedor.body.id, produtoId: produtoCompra.body.id },
      { dataOperacao: '2026-09-01', quantidade: 10 },
    );
    return {
      produtoId: produtoCompra.body.id as string,
      produtoId: produto.body.id as string,
      clienteId: cliente.body.id as string,
      compraId,
      fornecedorId: fornecedor.body.id as string,
    };
  }

  it('DoD 12.5 pedido persiste rotaId ativa e snapshot canônico', async () => {
    const base = await basePedido();
    const rota = await criarRota({ codigo: uid('ROT'), nome: 'Rota Pedido O12' });
    expect(rota.status).toBe(201);
    const criar = await request(srv()).post('/comercial/pedidos').set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: base.compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-09-01',
        rotaId: rota.body.id,
        itens: [{ produtoId: base.produtoId, quantidadePedida: 2 }],
      });
    expect(criar.status).toBe(201);
    const rows = await db.execute<{ rota_id: string | null; rota_prevista: string | null }>(
      sql`SELECT rota_id, rota_prevista FROM pedidos_venda WHERE id = ${criar.body.id}`,
    );
    expect(rows.rows[0]).toEqual({
      rota_id: rota.body.id,
      rota_prevista: 'Rota Pedido O12',
    });
  });

  it('DoD 12.5b pedido rejeita rota inválida sem criar pedido ou reserva', async () => {
    const base = await basePedido();
    const rota = await criarRota({ codigo: uid('ROT'), nome: 'Rota inativa pedido', status: 'inativo' });
    expect(rota.status).toBe(201);
    const pedidosAntes = await db.execute<{ total: string }>(
      sql`SELECT count(*)::text AS total FROM pedidos_venda WHERE deleted_at IS NULL`,
    );
    const reservasAntes = await db.execute<{ total: string }>(
      sql`SELECT count(*)::text AS total FROM reservas_disponibilidade`,
    );
    const auditAntes = await contarAuditoria('pedidos_venda');
    const criar = await request(srv()).post('/comercial/pedidos').set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: base.compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-09-01',
        rotaId: rota.body.id,
        itens: [{ produtoId: base.produtoId, quantidadePedida: 2 }],
      });
    expect(criar.status).toBe(400);
    const pedidosDepois = await db.execute<{ total: string }>(
      sql`SELECT count(*)::text AS total FROM pedidos_venda WHERE deleted_at IS NULL`,
    );
    const reservasDepois = await db.execute<{ total: string }>(
      sql`SELECT count(*)::text AS total FROM reservas_disponibilidade`,
    );
    expect(pedidosDepois.rows[0]!.total).toBe(pedidosAntes.rows[0]!.total);
    expect(reservasDepois.rows[0]!.total).toBe(reservasAntes.rows[0]!.total);
    expect(await contarAuditoria('pedidos_venda')).toBe(auditAntes);
  });

  it('DoD 12.6a criação de rota rejeita vínculo inativo com 400 sem auditoria', async () => {
    const repInativo = await criarRepresentante({ status: 'inativo' });
    const caminhaoInativo = await criarCaminhaoFrota({ status: 'inativo' });
    const motoristaInativo = await criarMotorista({ status: 'inativo' });
    const auditAntes = await contarAuditoria('rotas');
    const criar = await criarRota({ representantePadraoId: repInativo.id });
    expect(criar.status).toBe(400);
    expect(criar.body.codigo ?? criar.body.message).toBeDefined();
    const criarCaminhao = await criarRota({ caminhaoPadraoId: caminhaoInativo.id });
    expect(criarCaminhao.status).toBe(400);
    const criarMotoristaRota = await criarRota({ motoristaPadraoId: motoristaInativo.id });
    expect(criarMotoristaRota.status).toBe(400);
    expect(await contarAuditoria('rotas')).toBe(auditAntes);
  });

  it('DoD 12.6b edição de rota mantém vínculo persistido que ficou inativo', async () => {
    const rep = await criarRepresentante();
    const caminhao = await criarCaminhaoFrota();
    const motorista = await criarMotorista();
    const criar = await criarRota({
      representantePadraoId: rep.id,
      caminhaoPadraoId: caminhao.id,
      motoristaPadraoId: motorista.id,
    });
    expect(criar.status).toBe(201);
    await request(srv()).patch(`/representantes/${rep.id}`).set('Cookie', adminCookies)
      .send({ status: 'inativo' });
    await request(srv()).patch(`/frota/caminhoes/${caminhao.id}`).set('Cookie', adminCookies)
      .send({ status: 'inativo' });
    await request(srv()).patch(`/frota/motoristas/${motorista.id}`).set('Cookie', adminCookies)
      .send({ status: 'inativo' });
    const editar = await request(srv()).patch(`/rotas/${criar.body.id}`).set('Cookie', adminCookies)
      .send({
        nome: 'Rota mantém inativo',
        representantePadraoId: rep.id,
        caminhaoPadraoId: caminhao.id,
        motoristaPadraoId: motorista.id,
      });
    expect(editar.status).toBe(200);
    const rows = await db.execute<{
      representante_padrao_id: string | null;
      caminhao_padrao_id: string | null;
      motorista_padrao_id: string | null;
    }>(sql`
      SELECT representante_padrao_id, caminhao_padrao_id, motorista_padrao_id
        FROM rotas WHERE id = ${criar.body.id}
    `);
    expect(rows.rows[0]).toEqual({
      representante_padrao_id: rep.id,
      caminhao_padrao_id: caminhao.id,
      motorista_padrao_id: motorista.id,
    });
  });

  it('DoD 12.6c edição de rota rejeita troca para outro inativo com 400 sem auditoria', async () => {
    const repAtual = await criarRepresentante();
    const repOutro = await criarRepresentante({ status: 'inativo' });
    const criar = await criarRota({ representantePadraoId: repAtual.id });
    expect(criar.status).toBe(201);
    const auditAntes = await contarAuditoria('rotas');
    const editar = await request(srv()).patch(`/rotas/${criar.body.id}`).set('Cookie', adminCookies)
      .send({ representantePadraoId: repOutro.id });
    expect(editar.status).toBe(400);
    expect(await contarAuditoria('rotas')).toBe(auditAntes);
    const rows = await db.execute<{ representante_padrao_id: string | null }>(
      sql`SELECT representante_padrao_id FROM rotas WHERE id = ${criar.body.id}`,
    );
    expect(rows.rows[0]!.representante_padrao_id).toBe(repAtual.id);
  });

  it('DoD 12.6 criação de caminhão rejeita rota padrão inativa com 400 sem auditoria', async () => {
    const rota = await criarRota({ status: 'inativo' });
    expect(rota.status).toBe(201);
    const auditAntes = await contarAuditoria('frota_caminhoes');
    const criar = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies).send({
      placa: proximaPlaca(),
      rotaPadraoId: rota.body.id,
    });
    expect(criar.status).toBe(400);
    expect(await contarAuditoria('frota_caminhoes')).toBe(auditAntes);
  });

  it('DoD 12.6 edição de caminhão mantém rota padrão persistida inativa', async () => {
    const rota = await criarRota();
    expect(rota.status).toBe(201);
    const criar = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies).send({
      placa: proximaPlaca(),
      rotaPadraoId: rota.body.id,
    });
    expect(criar.status).toBe(201);
    await request(srv()).patch(`/rotas/${rota.body.id}`).set('Cookie', adminCookies)
      .send({ status: 'inativo' });
    const editar = await request(srv()).patch(`/frota/caminhoes/${criar.body.id}`)
      .set('Cookie', adminCookies)
      .send({ rotaPadraoId: rota.body.id, descricao: 'mantém' });
    expect(editar.status).toBe(200);
    expect(editar.body.rotaPadraoId).toBe(rota.body.id);
  });

  it('DoD 12.6 edição de caminhão rejeita troca para outra rota inativa', async () => {
    const rotaAtual = await criarRota();
    const rotaOutra = await criarRota({ status: 'inativo' });
    expect(rotaAtual.status).toBe(201);
    expect(rotaOutra.status).toBe(201);
    const criar = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies).send({
      placa: proximaPlaca(),
      rotaPadraoId: rotaAtual.body.id,
    });
    const auditAntes = await contarAuditoria('frota_caminhoes');
    const editar = await request(srv()).patch(`/frota/caminhoes/${criar.body.id}`)
      .set('Cookie', adminCookies)
      .send({ rotaPadraoId: rotaOutra.body.id });
    expect(editar.status).toBe(400);
    expect(await contarAuditoria('frota_caminhoes')).toBe(auditAntes);
  });

  it('DoD 12.6 criação de motorista rejeita caminhão padrão inativo', async () => {
    const caminhao = await criarCaminhaoFrota({ status: 'inativo' });
    const auditAntes = await contarAuditoria('frota_motoristas');
    const criar = await request(srv()).post('/frota/motoristas').set('Cookie', adminCookies).send({
      nome: uid('Mot'),
      documento: uid('CNH'),
      caminhaoPadraoId: caminhao.id,
    });
    expect(criar.status).toBe(400);
    expect(await contarAuditoria('frota_motoristas')).toBe(auditAntes);
  });

  it('DoD 12.6 edição de motorista mantém caminhão padrão persistido inativo', async () => {
    const caminhao = await criarCaminhaoFrota();
    const criar = await request(srv()).post('/frota/motoristas').set('Cookie', adminCookies).send({
      nome: uid('Mot'),
      documento: uid('CNH'),
      caminhaoPadraoId: caminhao.id,
    });
    expect(criar.status).toBe(201);
    await request(srv()).patch(`/frota/caminhoes/${caminhao.id}`).set('Cookie', adminCookies)
      .send({ status: 'inativo' });
    const editar = await request(srv()).patch(`/frota/motoristas/${criar.body.id}`)
      .set('Cookie', adminCookies)
      .send({ caminhaoPadraoId: caminhao.id, telefone: '11999999999' });
    expect(editar.status).toBe(200);
    expect(editar.body.caminhaoPadraoId).toBe(caminhao.id);
  });

  it('DoD 12.6 edição de motorista rejeita troca para outro caminhão inativo', async () => {
    const atual = await criarCaminhaoFrota();
    const outro = await criarCaminhaoFrota({ status: 'inativo' });
    const criar = await request(srv()).post('/frota/motoristas').set('Cookie', adminCookies).send({
      nome: uid('Mot'),
      documento: uid('CNH'),
      caminhaoPadraoId: atual.id,
    });
    const auditAntes = await contarAuditoria('frota_motoristas');
    const editar = await request(srv()).patch(`/frota/motoristas/${criar.body.id}`)
      .set('Cookie', adminCookies)
      .send({ caminhaoPadraoId: outro.id });
    expect(editar.status).toBe(400);
    expect(await contarAuditoria('frota_motoristas')).toBe(auditAntes);
  });

  it('DoD 12.7 carga persiste motoristaId e rotaId com snapshots canônicos', async () => {
    const motorista = await criarMotorista({ nome: 'Motorista Carga O12' });
    const rota = await criarRota({ nome: 'Rota Carga O12' });
    expect(rota.status).toBe(201);
    const criar = await request(srv()).post('/operacao/expedicao/caminhoes')
      .set('Cookie', expedicaoCookies)
      .send({
        placa: proximaPlaca(),
        motoristaId: motorista.id,
        rotaId: rota.body.id,
        dataOperacao: '2026-09-02',
      });
    expect(criar.status).toBe(201);
    const rows = await db.execute<{
      motorista_id: string | null;
      motorista: string;
      rota_id: string | null;
      rota: string | null;
    }>(sql`
      SELECT motorista_id, motorista, rota_id, rota
        FROM caminhoes WHERE id = ${criar.body.id}
    `);
    expect(rows.rows[0]).toEqual({
      motorista_id: motorista.id,
      motorista: 'Motorista Carga O12',
      rota_id: rota.body.id,
      rota: 'Rota Carga O12',
    });
  });

  it('DoD 12.8 entrada de estoque persiste fornecedorId e nome canônico', async () => {
    const produto = await request(srv()).post('/produtos').set('Cookie', adminCookies).send({
      codigo: uid('CX'),
      nome: 'Caixaria O12',
      tipoOperacional: 'entrada_unidade',
      unidadePedido: 'unidade',
      exigePeso: false,
    });
    expect(produto.status).toBe(201);
    const fornecedor = await request(srv()).post('/fornecedores').set('Cookie', adminCookies).send({
      codigo: uid('FORN'),
      razaoSocial: 'Frigorífico Canônico O12',
      documentoFiscal: proximoCnpj(),
    });
    expect(fornecedor.status).toBe(201);
    const entrada = await request(srv()).post('/estoque/entradas').set('Cookie', estoqueCookies)
      .send({
        produtoId: produto.body.id,
        quantidade: 3,
        unidade: 'caixa',
        fornecedorId: fornecedor.body.id,
        destino: 'estoque',
      });
    expect(entrada.status).toBe(201);
    const rows = await db.execute<{ fornecedor_id: string | null; fornecedor_nome: string }>(
      sql`SELECT fornecedor_id, fornecedor_nome FROM entradas_itens WHERE id = ${entrada.body.id}`,
    );
    expect(rows.rows[0]).toEqual({
      fornecedor_id: fornecedor.body.id,
      fornecedor_nome: 'Frigorífico Canônico O12',
    });
  });

  it('DoD 12.8b fornecedor inativo não cria entrada nem consome pedido', async () => {
    const base = await basePedido();
    const produto = await request(srv()).post('/produtos').set('Cookie', adminCookies).send({
      codigo: uid('CX'),
      nome: 'Caixaria inativa O12',
      tipoOperacional: 'entrada_unidade',
      unidadePedido: 'unidade',
      exigePeso: false,
    });
    expect(produto.status).toBe(201);
    const fornecedor = await request(srv()).post('/fornecedores').set('Cookie', adminCookies).send({
      codigo: uid('FORN'),
      razaoSocial: 'Forn inativo entrada',
      documentoFiscal: proximoCnpj(),
      status: 'inativo',
    });
    expect(fornecedor.status).toBe(201);
    const pedido = await request(srv()).post('/comercial/pedidos').set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: base.compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-09-01',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 1 }],
      });
    expect(pedido.status).toBe(201);
    const det = await request(srv()).get(`/comercial/pedidos/${pedido.body.id}`)
      .set('Cookie', comercialCookies);
    const pedidoItemId = (det.body.itens as Array<{ id: string }>)[0]!.id;
    const entradasAntes = await db.execute<{ total: string }>(
      sql`SELECT count(*)::text AS total FROM entradas_itens WHERE deleted_at IS NULL`,
    );
    const itemAntes = await db.execute<{ quantidade_atendida: string }>(
      sql`SELECT quantidade_atendida::text FROM pedidos_venda_itens WHERE id = ${pedidoItemId}`,
    );
    const auditAntes = await contarAuditoria('entradas_itens');
    const entrada = await request(srv()).post('/estoque/entradas').set('Cookie', estoqueCookies)
      .send({
        produtoId: produto.body.id,
        quantidade: 1,
        unidade: 'caixa',
        fornecedorId: fornecedor.body.id,
        destino: 'pedido',
        pedidoVendaItemId: pedidoItemId,
      });
    expect(entrada.status).toBe(400);
    const entradasDepois = await db.execute<{ total: string }>(
      sql`SELECT count(*)::text AS total FROM entradas_itens WHERE deleted_at IS NULL`,
    );
    const itemDepois = await db.execute<{ quantidade_atendida: string }>(
      sql`SELECT quantidade_atendida::text FROM pedidos_venda_itens WHERE id = ${pedidoItemId}`,
    );
    expect(entradasDepois.rows[0]!.total).toBe(entradasAntes.rows[0]!.total);
    expect(itemDepois.rows[0]!.quantidade_atendida).toBe(itemAntes.rows[0]!.quantidade_atendida);
    expect(await contarAuditoria('entradas_itens')).toBe(auditAntes);
  });

  it('DoD 12.11 lista regra com labels e cria por FKs ativas', async () => {
    const produtoCompra = await request(srv()).post('/itens-compra').set('Cookie', adminCookies).send({
      codigo: 'BOI-O12', descricao: 'Boi casado O12', unidadeCompra: 'unidade',
    });
    const produto = await request(srv()).post('/itens-comerciais').set('Cookie', adminCookies)
      .send({ codigo: 'TZ-O12', descricao: 'Traseiro O12', unidadeComercial: 'kg' });
    expect(produtoCompra.status).toBe(201);
    expect(produto.status).toBe(201);
    const criar = await request(srv()).post('/regras-desdobramento').set('Cookie', adminCookies)
      .send({
        produtoId: produtoCompra.body.id,
        produtoId: produto.body.id,
        fatorQuantidade: 2,
        vigenciaInicio: '2026-01-01T00:00:00.000Z',
      });
    expect(criar.status).toBe(201);
    const lista = await request(srv()).get('/regras-desdobramento?pageSize=100')
      .set('Cookie', adminCookies);
    expect(lista.status).toBe(200);
    const linha = (lista.body.data as Array<{
      id: string;
      produtoCompraCodigo: string;
      produtoCompraNome: string;
      produtoCodigo: string;
      produtoNome: string;
    }>).find((r) => r.id === criar.body.id);
    expect(linha).toMatchObject({
      produtoCompraCodigo: 'BOI-O12',
      produtoCompraNome: 'Boi casado O12',
      produtoCodigo: 'TZ-O12',
      produtoNome: 'Traseiro O12',
    });
  });

  it('DoD 12.12 fornecedor persiste e reexibe todos os parâmetros operacionais', async () => {
    const criar = await request(srv()).post('/fornecedores').set('Cookie', adminCookies).send({
      codigo: uid('FORN'),
      razaoSocial: 'Forn params O12',
      documentoFiscal: proximoCnpj(),
      parametrosOperacionaisJson: {
        romaneioAntecipado: false,
        horarioLimiteRecebimento: '08:30',
        capacidadeMaximaKg: 0,
        toleranciaDivergenciaPercentual: 0,
        notaQualidade: 'B',
      },
    });
    expect(criar.status).toBe(201);
    expect(criar.body.parametrosOperacionaisJson).toMatchObject({
      romaneioAntecipado: false,
      horarioLimiteRecebimento: '08:30',
      capacidadeMaximaKg: 0,
      toleranciaDivergenciaPercentual: 0,
      notaQualidade: 'B',
    });
    const detalhe = await request(srv()).get(`/fornecedores/${criar.body.id}`)
      .set('Cookie', adminCookies);
    expect(detalhe.body.parametrosOperacionaisJson).toMatchObject({
      romaneioAntecipado: false,
      horarioLimiteRecebimento: '08:30',
      capacidadeMaximaKg: 0,
      toleranciaDivergenciaPercentual: 0,
      notaQualidade: 'B',
    });
    const patch = await request(srv()).patch(`/fornecedores/${criar.body.id}`)
      .set('Cookie', adminCookies)
      .send({
        parametrosOperacionaisJson: {
          romaneioAntecipado: true,
          horarioLimiteRecebimento: '18:00',
          capacidadeMaximaKg: 0,
          toleranciaDivergenciaPercentual: 12.5,
          notaQualidade: 'A',
        },
      });
    expect(patch.status).toBe(200);
    expect(patch.body.parametrosOperacionaisJson).toMatchObject({
      romaneioAntecipado: true,
      horarioLimiteRecebimento: '18:00',
      capacidadeMaximaKg: 0,
      toleranciaDivergenciaPercentual: 12.5,
      notaQualidade: 'A',
    });
  });

  async function clienteComVinculos() {
    const representante = await criarRepresentante();
    const rota = await criarRota();
    expect(rota.status).toBe(201);
    const criar = await request(srv()).post('/clientes').set('Cookie', adminCookies).send({
      razaoSocial: uid('CliVinculo'),
      documentoFiscal: proximoCnpj(),
      representanteId: representante.id,
      rotaId: rota.body.id,
    });
    expect(criar.status).toBe(201);
    return { clienteId: criar.body.id as string, representante, rota };
  }

  it('cliente PATCH preserva representanteId quando a chave é omitida', async () => {
    const { clienteId, representante } = await clienteComVinculos();
    const patch = await request(srv()).patch(`/clientes/${clienteId}`).set('Cookie', adminCookies)
      .send({ observacoesOperacionais: 'preserva representante' });
    expect(patch.status).toBe(200);
    const rows = await db.execute<{ representante_id: string | null }>(
      sql`SELECT representante_id FROM clientes WHERE id = ${clienteId}`,
    );
    expect(rows.rows[0]!.representante_id).toBe(representante.id);
  });

  it('cliente PATCH preserva rotaId quando a chave é omitida', async () => {
    const { clienteId, rota } = await clienteComVinculos();
    const patch = await request(srv()).patch(`/clientes/${clienteId}`).set('Cookie', adminCookies)
      .send({ observacoesOperacionais: 'preserva rota' });
    expect(patch.status).toBe(200);
    const rows = await db.execute<{ rota_id: string | null }>(
      sql`SELECT rota_id FROM clientes WHERE id = ${clienteId}`,
    );
    expect(rows.rows[0]!.rota_id).toBe(rota.body.id);
  });

  it('cliente PATCH limpa representanteId com null', async () => {
    const { clienteId } = await clienteComVinculos();
    const patch = await request(srv()).patch(`/clientes/${clienteId}`).set('Cookie', adminCookies)
      .send({ representanteId: null });
    expect(patch.status).toBe(200);
    const rows = await db.execute<{ representante_id: string | null }>(
      sql`SELECT representante_id FROM clientes WHERE id = ${clienteId}`,
    );
    expect(rows.rows[0]!.representante_id).toBeNull();
  });

  it('cliente PATCH limpa rotaId com null', async () => {
    const { clienteId } = await clienteComVinculos();
    const patch = await request(srv()).patch(`/clientes/${clienteId}`).set('Cookie', adminCookies)
      .send({ rotaId: null });
    expect(patch.status).toBe(200);
    const rows = await db.execute<{ rota_id: string | null }>(
      sql`SELECT rota_id FROM clientes WHERE id = ${clienteId}`,
    );
    expect(rows.rows[0]!.rota_id).toBeNull();
  });

  it('cliente PATCH troca representanteId por UUID ativo', async () => {
    const { clienteId, representante } = await clienteComVinculos();
    const representanteAtivoNovo = await criarRepresentante();
    expect(representanteAtivoNovo.id).not.toBe(representante.id);
    const patch = await request(srv()).patch(`/clientes/${clienteId}`).set('Cookie', adminCookies)
      .send({ representanteId: representanteAtivoNovo.id });
    expect(patch.status).toBe(200);
    const rows = await db.execute<{ representante_id: string | null }>(
      sql`SELECT representante_id FROM clientes WHERE id = ${clienteId}`,
    );
    expect(rows.rows[0]!.representante_id).toBe(representanteAtivoNovo.id);
  });

  it('cliente PATCH troca rotaId por UUID ativo', async () => {
    const { clienteId, rota } = await clienteComVinculos();
    const rotaAtivaNova = await criarRota();
    expect(rotaAtivaNova.status).toBe(201);
    expect(rotaAtivaNova.body.id).not.toBe(rota.body.id);
    const patch = await request(srv()).patch(`/clientes/${clienteId}`).set('Cookie', adminCookies)
      .send({ rotaId: rotaAtivaNova.body.id });
    expect(patch.status).toBe(200);
    const rows = await db.execute<{ rota_id: string | null }>(
      sql`SELECT rota_id FROM clientes WHERE id = ${clienteId}`,
    );
    expect(rows.rows[0]!.rota_id).toBe(rotaAtivaNova.body.id);
  });
});
