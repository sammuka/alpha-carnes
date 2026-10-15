import { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import * as schema from '../../src/database/schema';
import { DRIZZLE } from '../../src/database/database.module';
import { cleanupDb, createTestApp } from '../helpers/test-app';

/**
 * E01-T04 — memória de simulação fiscal.
 * Sem coluna de data comercial, fiscal ou efetiva e sem FK para nota.
 */
describe('E01-T04 — migration de simulações fiscais', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let pool: Pool;
  let usuarioId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ({ db, pool } = app.get<{ db: NodePgDatabase<typeof schema>; pool: Pool }>(DRIZZLE));
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDb(app);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO usuarios (nome, email, senha_hash)
       VALUES ('Fiscal E01-T04', 'e01-t04-mig@test.local', 'x') RETURNING id`,
    );
    usuarioId = rows[0]!.id;
  });

  async function codigoErro(promessa: Promise<unknown>): Promise<{ code?: string; constraint?: string }> {
    try {
      await promessa;
      return {};
    } catch (e) {
      const err = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
      return {
        code: err.code ?? err.cause?.code,
        constraint: err.constraint ?? err.cause?.constraint,
      };
    }
  }

  it('a simulação não ganha coluna de data fiscal nem FK de nota', async () => {
    const colunas = await db.execute(sql`
      SELECT column_name, data_type, numeric_precision::int AS numeric_precision, numeric_scale::int AS numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'simulacoes_fiscais'
    `);
    const nomes = colunas.rows.map((r) => String((r as { column_name: string }).column_name));
    for (const proibida of ['data_comercial', 'data_fiscal', 'data_efetiva', 'nota_id', 'xml', 'chave', 'protocolo', 'p_icms', 'p_red_bc', 'ipi', 'pis', 'ibs']) {
      expect(nomes).not.toContain(proibida);
    }
    expect(nomes).toEqual(expect.arrayContaining(['competencia', 'valor', 'desconto', 'valor_liquido', 'base_tributavel', 'icms', 'quantidade', 'peso_nf', 'regra_id']));
    const dinheiro = colunas.rows.filter((r) => ['valor', 'desconto', 'valor_liquido', 'base_tributavel', 'icms'].includes(String((r as { column_name: string }).column_name)));
    for (const coluna of dinheiro) {
      expect(coluna).toMatchObject({ data_type: 'numeric', numeric_precision: 15, numeric_scale: 2 });
    }
    const fks = await db.execute(sql`
      SELECT ccu.table_name AS destino
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'simulacoes_fiscais' AND tc.constraint_type = 'FOREIGN KEY'
    `);
    const destinos = fks.rows.map((r) => String((r as { destino: string }).destino));
    expect(destinos).not.toContain('notas_fiscais');
    expect(destinos).not.toContain('notas_fiscais_fornecedor');
    const doubles = colunas.rows.filter((r) => String((r as { data_type: string }).data_type) === 'double precision');
    expect(doubles).toHaveLength(0);
  });

  it('uq_simulacoes_codigo_versao é parcial', async () => {
    const indices = await db.execute(sql`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE indexname = 'uq_simulacoes_codigo_versao'
    `);
    expect(indices.rows).toHaveLength(1);
    const def = String((indices.rows[0] as { indexdef: string }).indexdef);
    expect(def).toMatch(/^CREATE UNIQUE INDEX/);
    expect(def).toMatch(/deleted_at IS NULL/);
  });

  it('competência 2026-13 viola simulacoes_competencia_check', async () => {
    const base = await baseSimulacao();
    const erro = await codigoErro(inserirSimulacao(base, { competencia: '2026-13' }));
    expect(erro).toEqual({ code: '23514', constraint: 'simulacoes_competencia_check' });
  });

  it('situação APROVADA viola simulacoes_situacao_check', async () => {
    const base = await baseSimulacao();
    const erro = await codigoErro(inserirSimulacao(base, { situacao: 'APROVADA' }));
    expect(erro).toEqual({ code: '23514', constraint: 'simulacoes_situacao_check' });
  });

  it('desconto maior que o valor viola simulacoes_desconto_teto_check', async () => {
    const base = await baseSimulacao();
    const erro = await codigoErro(inserirSimulacao(base, {
      valor: '1000.00',
      desconto: '1000.01',
      valorLiquido: '-0.01',
      baseTributavel: '1000.00',
      icms: '0.00',
      baseDifereBruto: false,
    }));
    expect(erro).toEqual({ code: '23514', constraint: 'simulacoes_desconto_teto_check' });
  });

  async function baseSimulacao() {
    const empresa = await pool.query<{ id: string }>(
      `INSERT INTO empresas (razao_social, cnpj_raiz, criado_por_id, atualizado_por_id)
       VALUES ('Alpha Carnes', '11222333', $1, $1) RETURNING id`,
      [usuarioId],
    );
    const estab = await pool.query<{ id: string }>(
      `INSERT INTO estabelecimentos
         (empresa_id, nome, cnpj, inscricao_estadual, inscricao_municipal, uf, situacao,
          decidido_por_id, decidido_em, criado_por_id, atualizado_por_id)
       VALUES ($1, 'Matriz', '11222333000181', '123456789', '12345', 'SP', 'APPROVED',
               $2, now(), $2, $2) RETURNING id`,
      [empresa.rows[0]!.id, usuarioId],
    );
    const operacao = await pool.query<{ id: string }>(
      `INSERT INTO operacoes (data, dia_semana, rotulo, criada_por_id)
       VALUES ('2026-10-15', 4, 'Operação do dia', $1) RETURNING id`,
      [usuarioId],
    );
    const cfop = await pool.query<{ id: string }>(
      `INSERT INTO cfops (codigo, descricao, criado_por_id, atualizado_por_id)
       VALUES ('5102', 'Venda de mercadoria', $1, $1) RETURNING id`,
      [usuarioId],
    );
    const ncm = await pool.query<{ id: string }>(
      `INSERT INTO ncms (codigo, descricao, criado_por_id, atualizado_por_id)
       VALUES ('02013000', 'Carnes desossadas', $1, $1) RETURNING id`,
      [usuarioId],
    );
    const produto = await pool.query<{ id: string }>(
      `INSERT INTO produtos (codigo, nome, unidade_pedido)
       VALUES ('PAT', 'Patinho', 'kg') RETURNING id`,
      [],
    );
    const cliente = await pool.query<{ id: string }>(
      `INSERT INTO clientes (codigo, razao_social, documento_fiscal, faixa_preco)
       VALUES ('C1', 'Cliente Um', '12345678000199', 'A') RETURNING id`,
      [],
    );
    const enquadramento = await pool.query<{ id: string }>(
      `INSERT INTO enquadramentos_fiscais (
         codigo, empresa_id, estabelecimento_id, operacao_id, tp_nf, fin_nfe, cfop_id,
         abrangencia, tipo_produto, produto_id, ncm_id, cest, cliente_id,
         vigencia_inicio, prioridade, situacao, criado_por_id, atualizado_por_id
       ) VALUES (
         '1', $1, $2, $3, '1', '1', $4,
         'INTERNA', 'REVENDA', $5, $6, '1234567', $7,
         '2026-01-01', 1, 'ATIVA', $8, $8
       ) RETURNING id`,
      [
        empresa.rows[0]!.id,
        estab.rows[0]!.id,
        operacao.rows[0]!.id,
        cfop.rows[0]!.id,
        produto.rows[0]!.id,
        ncm.rows[0]!.id,
        cliente.rows[0]!.id,
        usuarioId,
      ],
    );
    const beneficio = await pool.query<{ id: string }>(
      `INSERT INTO beneficios_fiscais (codigo, descricao, criado_por_id, atualizado_por_id)
       VALUES ('SP020450', 'Redução de base', $1, $1) RETURNING id`,
      [usuarioId],
    );
    const classificacao = await pool.query<{ id: string }>(
      `INSERT INTO classificacoes_ibs_cbs (codigo, descricao, criado_por_id, atualizado_por_id)
       VALUES ('000001', 'Tributação integral', $1, $1) RETURNING id`,
      [usuarioId],
    );
    const regra = await pool.query<{ id: string }>(
      `INSERT INTO regras_tributarias (
         codigo, numero_versao, enquadramento_id, icms_cst, p_red_bc, p_icms,
         beneficio_fiscal_id, ipi_cst, pis_cst, ibs_cst, classificacao_ibs_cbs_id,
         vigencia_inicio, justificativa, criado_por_id, atualizado_por_id
       ) VALUES (
         '1', 1, $1, '20', '0.4167', '0.1200',
         $2, '53', '06', '000', $3,
         '2026-01-01', 'Regra da memória.', $4, $4
       ) RETURNING id`,
      [enquadramento.rows[0]!.id, beneficio.rows[0]!.id, classificacao.rows[0]!.id, usuarioId],
    );
    return {
      estabelecimentoId: estab.rows[0]!.id,
      operacaoId: operacao.rows[0]!.id,
      clienteId: cliente.rows[0]!.id,
      produtoId: produto.rows[0]!.id,
      ncmId: ncm.rows[0]!.id,
      enquadramentoId: enquadramento.rows[0]!.id,
      regraId: regra.rows[0]!.id,
    };
  }

  function inserirSimulacao(
    base: {
      estabelecimentoId: string;
      operacaoId: string;
      clienteId: string;
      produtoId: string;
      ncmId: string;
      enquadramentoId: string;
      regraId: string;
    },
    extra: {
      competencia?: string;
      situacao?: string;
      valor?: string;
      desconto?: string;
      valorLiquido?: string;
      baseTributavel?: string;
      icms?: string;
      baseDifereBruto?: boolean;
    } = {},
  ) {
    const valor = extra.valor ?? '1000.00';
    const desconto = extra.desconto ?? '0.00';
    const valorLiquido = extra.valorLiquido ?? '1000.00';
    const baseTributavel = extra.baseTributavel ?? '583.30';
    const icms = extra.icms ?? '70.00';
    const baseDifereBruto = extra.baseDifereBruto ?? true;
    return pool.query(
      `INSERT INTO simulacoes_fiscais (
         codigo, numero_versao, estabelecimento_id, operacao_id, cliente_id, produto_id, ncm_id,
         quantidade, peso_nf, valor, desconto, competencia, enquadramento_id, regra_id,
         valor_liquido, base_tributavel, icms, base_difere_bruto, situacao,
         justificativa, criado_por_id, atualizado_por_id
       ) VALUES (
         '1', 1, $1, $2, $3, $4, $5,
         '10.000', '982.000', $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15,
         'Motivo da alteração de teste.', $16, $16
       )`,
      [
        base.estabelecimentoId,
        base.operacaoId,
        base.clienteId,
        base.produtoId,
        base.ncmId,
        valor,
        desconto,
        extra.competencia ?? '2026-10',
        base.enquadramentoId,
        base.regraId,
        valorLiquido,
        baseTributavel,
        icms,
        baseDifereBruto,
        extra.situacao ?? 'CALCULADA',
        usuarioId,
      ],
    );
  }
});
