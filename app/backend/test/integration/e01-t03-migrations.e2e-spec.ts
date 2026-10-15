import { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import * as schema from '../../src/database/schema';
import { DRIZZLE } from '../../src/database/database.module';
import { cleanupDb, createTestApp } from '../helpers/test-app';

/**
 * E01-T03 — schema da regra tributária e catálogos manuais vazios.
 * Sem semente, sem CSOSN, IS, NT, datas comercial/fiscal/efetiva e sem FK para nota.
 */
describe('E01-T03 — migration de regras tributárias', () => {
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
       VALUES ('Fiscal E01-T03', 'e01-t03-mig@test.local', 'x') RETURNING id`,
    );
    usuarioId = rows[0]!.id;
  });

  async function codigoErro(promessa: Promise<unknown>): Promise<{ code?: string; constraint?: string }> {
    try {
      await promessa;
      return {};
    } catch (e) {
      const err = e as { code?: string; constraint?: string };
      return { code: err.code, constraint: err.constraint };
    }
  }

  it('catálogos nascem vazios e a regra não ganha coluna fora do contrato', async () => {
    const tabelas = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('beneficios_fiscais','classificacoes_ibs_cbs','regras_tributarias')
    `);
    expect(tabelas.rows).toHaveLength(3);
    const beneficios = await db.execute(sql`SELECT COUNT(*)::int AS n FROM beneficios_fiscais`);
    const classes = await db.execute(sql`SELECT COUNT(*)::int AS n FROM classificacoes_ibs_cbs`);
    expect(beneficios.rows[0]).toMatchObject({ n: 0 });
    expect(classes.rows[0]).toMatchObject({ n: 0 });
    const colunas = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'regras_tributarias'
    `);
    const nomes = colunas.rows.map((r) => String((r as { column_name: string }).column_name));
    for (const proibida of ['csosn', 'is', 'versao_nt', 'data_comercial', 'data_fiscal', 'data_efetiva', 'nota_id', 'operacao_id', 'cfop_id']) {
      expect(nomes).not.toContain(proibida);
    }
    expect(nomes).toEqual(expect.arrayContaining(['vigencia_inicio', 'vigencia_fim', 'p_red_bc', 'p_icms', 'icms_cst', 'ibs_cst']));
    const percentuais = await db.execute(sql`
      SELECT column_name, numeric_precision::int AS numeric_precision, numeric_scale::int AS numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'regras_tributarias' AND column_name IN ('p_red_bc', 'p_icms')
    `);
    expect(percentuais.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ column_name: 'p_red_bc', numeric_precision: 5, numeric_scale: 4 }),
      expect.objectContaining({ column_name: 'p_icms', numeric_precision: 5, numeric_scale: 4 }),
    ]));
  });

  it('uq_beneficios_codigo e uq_regras_abertas_codigo são parciais', async () => {
    const indices = await db.execute(sql`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE indexname IN ('uq_beneficios_codigo', 'uq_regras_abertas_codigo')
      ORDER BY indexname
    `);
    expect(indices.rows.map((r) => String((r as { indexname: string }).indexname))).toEqual([
      'uq_beneficios_codigo',
      'uq_regras_abertas_codigo',
    ]);
    for (const r of indices.rows) {
      const def = String((r as { indexdef: string }).indexdef);
      expect(def).toMatch(/^CREATE UNIQUE INDEX/);
      expect(def).toMatch(/deleted_at IS NULL/);
    }
  });

  it('não há FK de regras_tributarias para notas_fiscais', async () => {
    const fks = await db.execute(sql`
      SELECT kcu.constraint_name
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = rc.constraint_name
       AND kcu.constraint_schema = rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = rc.unique_constraint_name
       AND ccu.constraint_schema = rc.unique_constraint_schema
      WHERE kcu.table_schema = 'public'
        AND kcu.table_name = 'regras_tributarias'
        AND ccu.table_name = 'notas_fiscais'
    `);
    expect(fks.rows).toHaveLength(0);
  });

  it('insert de benefício SP1 viola o formato', async () => {
    const erro = await codigoErro(pool.query(
      `INSERT INTO beneficios_fiscais (codigo, descricao, criado_por_id, atualizado_por_id)
       VALUES ('SP1', 'Formato curto', $1, $1)`,
      [usuarioId],
    ));
    expect(erro).toEqual({ code: '23514', constraint: 'beneficios_codigo_formato_check' });
  });

  it('insert de icms_cst 99 viola regras_icms_cst_check', async () => {
    const base = await baseRegra();
    const erro = await codigoErro(pool.query(
      `INSERT INTO regras_tributarias (
         codigo, numero_versao, enquadramento_id, icms_cst, p_red_bc, p_icms,
         beneficio_fiscal_id, ipi_cst, pis_cst, ibs_cst, classificacao_ibs_cbs_id,
         vigencia_inicio, justificativa, criado_por_id, atualizado_por_id
       ) VALUES (
         '1', 1, $1, '99', '0.4167', '0.1200',
         $2, '53', '06', '000', $3,
         '2026-01-01', 'Teste de check', $4, $4
       )`,
      [base.enquadramentoId, base.beneficioId, base.classificacaoId, usuarioId],
    ));
    expect(erro.constraint).toBe('regras_icms_cst_check');
  });

  it('p_icms 1.0001 viola a faixa e 0.0000 e 1.0000 passam', async () => {
    const base = await baseRegra();
    const acima = await codigoErro(inserirRegra(base, { codigo: '1', pIcms: '1.0001' }));
    expect(acima.constraint).toBe('regras_p_icms_faixa_check');
    await inserirRegra(base, { codigo: '2', pIcms: '0.0000' });
    await inserirRegra(base, { codigo: '3', pIcms: '1.0000' });
    const gravados = await db.execute(sql`
      SELECT codigo, p_icms::text AS p_icms FROM regras_tributarias ORDER BY codigo
    `);
    expect(gravados.rows).toEqual([
      { codigo: '2', p_icms: '0.0000' },
      { codigo: '3', p_icms: '1.0000' },
    ]);
  });

  async function baseRegra() {
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
    return {
      enquadramentoId: enquadramento.rows[0]!.id,
      beneficioId: beneficio.rows[0]!.id,
      classificacaoId: classificacao.rows[0]!.id,
    };
  }

  function inserirRegra(
    base: { enquadramentoId: string; beneficioId: string; classificacaoId: string },
    extra: { codigo: string; pIcms: string },
  ) {
    return pool.query(
      `INSERT INTO regras_tributarias (
         codigo, numero_versao, enquadramento_id, icms_cst, p_red_bc, p_icms,
         beneficio_fiscal_id, ipi_cst, pis_cst, ibs_cst, classificacao_ibs_cbs_id,
         vigencia_inicio, justificativa, criado_por_id, atualizado_por_id
       ) VALUES (
         $1, 1, $2, '20', '0.4167', $3,
         $4, '53', '06', '000', $5,
         '2026-01-01', 'Teste de faixa', $6, $6
       )`,
      [extra.codigo, base.enquadramentoId, extra.pIcms, base.beneficioId, base.classificacaoId, usuarioId],
    );
  }
});
