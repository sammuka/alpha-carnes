import { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import { DRIZZLE } from '../../src/database/database.module';
import { cleanupDb, createTestApp } from '../helpers/test-app';

/**
 * E01-T01 — schema fiscal (expand-only): empresas, estabelecimentos, CNAEs, alterações e regimes.
 * Confere constraints físicas (D-E01, tenant composto, parciais) direto no PostgreSQL.
 */
describe('E01-T01 — migration do cadastro fiscal', () => {
  let app: INestApplication;
  let pool: Pool;
  let usuarioId: string;

  // CNPJs com DV válido (validador da Task 1): raiz 11222333 e 12ABC345.
  const CNPJ_A = '11222333000181';
  const CNPJ_B = '12ABC34501DE35';

  beforeAll(async () => {
    app = await createTestApp();
    ({ pool } = app.get<{ pool: Pool }>(DRIZZLE));
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDb(app);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO usuarios (nome, email, senha_hash)
       VALUES ('Fiscal E01', 'e01-mig@test.local', 'x') RETURNING id`,
    );
    usuarioId = rows[0]!.id;
  });

  async function criarEmpresa(cnpjRaiz: string): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO empresas (razao_social, cnpj_raiz, criado_por_id, atualizado_por_id)
       VALUES ('Empresa ' || $1::text, $1, $2, $2) RETURNING id`,
      [cnpjRaiz, usuarioId],
    );
    return rows[0]!.id;
  }

  async function criarEstabelecimento(empresaId: string, cnpj: string): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO estabelecimentos
         (empresa_id, nome, cnpj, inscricao_estadual, inscricao_municipal, uf, criado_por_id, atualizado_por_id)
       VALUES ($1, 'Matriz', $2, '123456789', '998877', 'SP', $3, $3) RETURNING id`,
      [empresaId, cnpj, usuarioId],
    );
    return rows[0]!.id;
  }

  async function codigoErro(promessa: Promise<unknown>): Promise<string | undefined> {
    try {
      await promessa;
      return undefined;
    } catch (e) {
      return (e as { code?: string }).code;
    }
  }

  it('cria as seis tabelas novas', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])
        ORDER BY table_name`,
      [[
        'empresas', 'estabelecimentos', 'estabelecimento_cnaes', 'estabelecimento_alteracoes',
        'estabelecimento_alteracao_cnaes', 'regimes_tributarios',
      ]],
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      'empresas', 'estabelecimento_alteracao_cnaes', 'estabelecimento_alteracoes',
      'estabelecimento_cnaes', 'estabelecimentos', 'regimes_tributarios',
    ]);
  });

  it('uq_estabelecimentos_id_empresa não parcial (pg_constraint)', async () => {
    const { rows } = await pool.query<{ contype: string; def: string }>(
      `SELECT contype, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname = 'uq_estabelecimentos_id_empresa'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.contype).toBe('u');
    expect(rows[0]!.def).toBe('UNIQUE (id, empresa_id)');
  });

  it('uq_estab_cnaes_principal e uq_estab_cnaes_codigo parciais (pg_indexes)', async () => {
    const { rows } = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE indexname IN ('uq_estab_cnaes_principal', 'uq_estab_cnaes_codigo',
                            'uq_estabelecimentos_cnpj', 'uq_empresas_cnpj_raiz', 'uq_estab_alteracoes_aberta')
        ORDER BY indexname`,
    );
    expect(rows.map((r) => r.indexname)).toEqual([
      'uq_empresas_cnpj_raiz', 'uq_estab_alteracoes_aberta', 'uq_estab_cnaes_codigo',
      'uq_estab_cnaes_principal', 'uq_estabelecimentos_cnpj',
    ]);
    for (const r of rows) {
      expect(r.indexdef).toMatch(/^CREATE UNIQUE INDEX/);
      expect(r.indexdef).toMatch(/WHERE .*deleted_at IS NULL/);
    }
    const principal = rows.find((r) => r.indexname === 'uq_estab_cnaes_principal')!;
    expect(principal.indexdef).toMatch(/tipo = 'PRINCIPAL'/);
  });

  it('INSERT direto de 2º principal → 23505', async () => {
    const empresaId = await criarEmpresa('11222333');
    const estabId = await criarEstabelecimento(empresaId, CNPJ_A);
    const inserir = (codigo: string) =>
      pool.query(
        `INSERT INTO estabelecimento_cnaes
           (estabelecimento_id, empresa_id, codigo, descricao, tipo, criado_por_id, atualizado_por_id)
         VALUES ($1, $2, $3, 'Atividade', 'PRINCIPAL', $4, $4)`,
        [estabId, empresaId, codigo, usuarioId],
      );
    await inserir('6201501');
    expect(await codigoErro(inserir('6202300'))).toBe('23505');
  });

  it('regime/CNAE/alteração com empresa_id divergente → 23503', async () => {
    const empresaA = await criarEmpresa('11222333');
    const empresaB = await criarEmpresa('12ABC345');
    const estabA = await criarEstabelecimento(empresaA, CNPJ_A);

    expect(await codigoErro(pool.query(
      `INSERT INTO regimes_tributarios
         (estabelecimento_id, empresa_id, crt, vigencia_inicio, justificativa, criado_por_id, atualizado_por_id)
       VALUES ($1, $2, '3', '2026-01-01', 'Cadastro inicial', $3, $3)`,
      [estabA, empresaB, usuarioId],
    ))).toBe('23503');

    expect(await codigoErro(pool.query(
      `INSERT INTO estabelecimento_cnaes
         (estabelecimento_id, empresa_id, codigo, descricao, tipo, criado_por_id, atualizado_por_id)
       VALUES ($1, $2, '6201501', 'Atividade', 'PRINCIPAL', $3, $3)`,
      [estabA, empresaB, usuarioId],
    ))).toBe('23503');

    expect(await codigoErro(pool.query(
      `INSERT INTO estabelecimento_alteracoes
         (estabelecimento_id, empresa_id, nome, inscricao_estadual, inscricao_municipal, uf,
          versao_base, justificativa, criado_por_id, atualizado_por_id)
       VALUES ($1, $2, 'Matriz nova', '123', '456', 'SP', 1, 'Mudança de nome', $3, $3)`,
      [estabA, empresaB, usuarioId],
    ))).toBe('23503');
  });

  it('substitui_regime_id de outro estabelecimento → 23503', async () => {
    const empresaA = await criarEmpresa('11222333');
    const estab1 = await criarEstabelecimento(empresaA, CNPJ_A);
    const estab2 = await criarEstabelecimento(empresaA, '11222333000262');
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO regimes_tributarios
         (estabelecimento_id, empresa_id, crt, vigencia_inicio, justificativa, criado_por_id, atualizado_por_id)
       VALUES ($1, $2, '3', '2026-01-01', 'Cadastro inicial', $3, $3) RETURNING id`,
      [estab1, empresaA, usuarioId],
    );
    expect(await codigoErro(pool.query(
      `INSERT INTO regimes_tributarios
         (estabelecimento_id, empresa_id, crt, vigencia_inicio, justificativa, substitui_regime_id,
          criado_por_id, atualizado_por_id)
       VALUES ($1, $2, '1', '2026-06-01', 'Troca', $3, $4, $4)`,
      [estab2, empresaA, rows[0]!.id, usuarioId],
    ))).toBe('23503');
  });

  it('coluna municipio_ibge_codigo nullable; nenhuma coluna certificado', async () => {
    const { rows } = await pool.query<{
      column_name: string; is_nullable: string; data_type: string; character_maximum_length: number | null;
    }>(
      `SELECT column_name, is_nullable, data_type, character_maximum_length
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'estabelecimentos'`,
    );
    const municipio = rows.find((r) => r.column_name === 'municipio_ibge_codigo');
    expect(municipio).toEqual({
      column_name: 'municipio_ibge_codigo', is_nullable: 'YES',
      data_type: 'character varying', character_maximum_length: 7,
    });
    expect(rows.some((r) => r.column_name.includes('certificado'))).toBe(false);
  });

  it('CHECKs de formato e preenchimento', async () => {
    const empresaId = await criarEmpresa('11222333');
    // CNPJ raiz fora do formato
    expect(await codigoErro(pool.query(
      `INSERT INTO empresas (razao_social, cnpj_raiz, criado_por_id, atualizado_por_id)
       VALUES ('X', '1122233a', $1, $1)`, [usuarioId],
    ))).toBe('23514');
    // Razão social em branco
    expect(await codigoErro(pool.query(
      `INSERT INTO empresas (razao_social, cnpj_raiz, criado_por_id, atualizado_por_id)
       VALUES ('   ', '99888777', $1, $1)`, [usuarioId],
    ))).toBe('23514');
    const inserirEstab = (cnpj: string, uf: string, nome = 'Filial', ie = '123') =>
      pool.query(
        `INSERT INTO estabelecimentos
           (empresa_id, nome, cnpj, inscricao_estadual, inscricao_municipal, uf, criado_por_id, atualizado_por_id)
         VALUES ($1, $2, $3, $4, '456', $5, $6, $6)`,
        [empresaId, nome, cnpj, ie, uf, usuarioId],
      );
    // DV com letra
    expect(await codigoErro(inserirEstab('12ABC34501DE3A', 'SP'))).toBe('23514');
    // UF inexistente
    expect(await codigoErro(inserirEstab(CNPJ_A, 'XX'))).toBe('23514');
    // Nome em branco
    expect(await codigoErro(inserirEstab(CNPJ_A, 'SP', '  '))).toBe('23514');
    // IE com caractere inválido
    expect(await codigoErro(inserirEstab(CNPJ_A, 'SP', 'Filial', '12.3'))).toBe('23514');
    // APPROVED sem decisão
    const estabId = await criarEstabelecimento(empresaId, CNPJ_A);
    expect(await codigoErro(pool.query(
      `UPDATE estabelecimentos SET situacao = 'APPROVED' WHERE id = $1`, [estabId],
    ))).toBe('23514');
    // REVIEW sem submetido_por
    expect(await codigoErro(pool.query(
      `UPDATE estabelecimentos SET situacao = 'REVIEW' WHERE id = $1`, [estabId],
    ))).toBe('23514');
    // Município fora de 7 dígitos
    expect(await codigoErro(pool.query(
      `UPDATE estabelecimentos SET municipio_ibge_codigo = '35A' WHERE id = $1`, [estabId],
    ))).toBe('23514');
    // CNAE com 6 dígitos
    expect(await codigoErro(pool.query(
      `INSERT INTO estabelecimento_cnaes
         (estabelecimento_id, empresa_id, codigo, descricao, tipo, criado_por_id, atualizado_por_id)
       VALUES ($1, $2, '620150', 'Atividade', 'PRINCIPAL', $3, $3)`,
      [estabId, empresaId, usuarioId],
    ))).toBe('23514');
    // Regime: CRT 5 e fim < início
    const inserirRegime = (crt: string, inicio: string, fim: string | null) =>
      pool.query(
        `INSERT INTO regimes_tributarios
           (estabelecimento_id, empresa_id, crt, vigencia_inicio, vigencia_fim, justificativa,
            criado_por_id, atualizado_por_id)
         VALUES ($1, $2, $3, $4, $5, 'Motivo', $6, $6)`,
        [estabId, empresaId, crt, inicio, fim, usuarioId],
      );
    expect(await codigoErro(inserirRegime('5', '2026-01-01', null))).toBe('23514');
    expect(await codigoErro(inserirRegime('3', '2026-02-01', '2026-01-31'))).toBe('23514');
  });
});
