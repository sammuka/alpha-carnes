import { config as loadEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Pool, type PoolClient } from 'pg';

// Worktree root .env (monorepo); fallback para cwd.
loadEnv({ path: path.resolve(__dirname, '../../../../.env') });
loadEnv();

const JOURNAL_PATH = path.join(
  __dirname,
  '../../src/database/migrations/meta/_journal.json',
);
const MIGRATIONS_DIR = path.join(__dirname, '../../src/database/migrations');

type Journal = {
  entries: Array<{ idx: number; tag: string }>;
};

function loadJournal(): Journal {
  return JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8')) as Journal;
}

function sqlStatements(fileContent: string): string[] {
  return fileContent
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

let pool: Pool | null = null;
let poolReady: Promise<Pool> | null = null;

/**
 * Banco dedicado para DROP SCHEMA das migrations. Evita derrubar o schema
 * usado pelas suites e2e no mesmo DATABASE_URL (mesmo com maxWorkers=1,
 * afterAll/antes do próximo arquivo ainda compartilhavam o catálogo).
 */
function connectionStringMigrations(): string {
  if (process.env.DATABASE_URL_MIGRATIONS) {
    return process.env.DATABASE_URL_MIGRATIONS;
  }
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL não definida');
  // Deriva .../alphacarnes_migrations a partir do DB padrão de testes.
  return base.replace(/\/([^/?]+)(\?.*)?$/, '/$1_migrations$2');
}

async function ensureMigrationsDatabase(connectionString: string): Promise<void> {
  const match = connectionString.match(/^(postgres(?:ql)?:\/\/[^/]+)\/([^/?]+)(.*)$/i);
  if (!match) throw new Error(`DATABASE_URL_MIGRATIONS inválida: ${connectionString}`);
  const [, origin, dbName, suffix] = match;
  const adminUrl = `${origin}/postgres${suffix ?? ''}`;
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  try {
    const { rows } = await admin.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists`,
      [dbName],
    );
    if (!rows[0]?.exists) {
      // Identificador validado: só [a-zA-Z0-9_]
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dbName!)) {
        throw new Error(`Nome de database de migrations inválido: ${dbName}`);
      }
      await admin.query(`CREATE DATABASE ${dbName}`);
    }
  } finally {
    await admin.end();
  }
}

/** @deprecated Prefira ensurePool(); mantido para leituras após migrarAte. */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Pool de migrations ainda não inicializado — chame ensurePool()');
  }
  return pool;
}

/** Garante DB dedicado + pool (lazy, idempotente). */
export async function ensurePool(): Promise<Pool> {
  if (pool) return pool;
  if (!poolReady) {
    poolReady = (async () => {
      const connectionString = connectionStringMigrations();
      await ensureMigrationsDatabase(connectionString);
      pool = new Pool({ connectionString, max: 1 });
      return pool;
    })();
  }
  return poolReady;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    poolReady = null;
  }
}

async function dropSchemasComRetry(client: PoolClient): Promise<void> {
  // Não usar pg_terminate_backend: com maxWorkers=1 o DROP serializa com as
  // suites e2e; terminate matava pools Nest vizinhos e gerava 401/TRUNCATE falho.
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= 8; tentativa++) {
    try {
      await client.query('DROP SCHEMA IF EXISTS public CASCADE');
      await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
      return;
    } catch (err) {
      ultimoErro = err;
      const code = (err as { code?: string }).code;
      // 40P01 deadlock; 55006 object_in_use; 57P01 admin_shutdown
      if (code !== '40P01' && code !== '55006' && code !== '57P01') throw err;
      await new Promise((r) => setTimeout(r, 150 * tentativa));
    }
  }
  throw ultimoErro;
}

/** Recria o schema public e aplica migrations do journal até o tag informado (inclusive). */
export async function migrarAte(tag: string): Promise<void> {
  const p = await ensurePool();
  const client = await p.connect();
  try {
    await dropSchemasComRetry(client);
    await client.query('CREATE SCHEMA public');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    const journal = loadJournal();
    const target = journal.entries.find((e) => e.tag === tag);
    if (!target) {
      throw new Error(`Migration tag não encontrado no journal: ${tag}`);
    }

    for (const entry of journal.entries) {
      if (entry.idx > target.idx) break;
      const filePath = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo de migration ausente: ${filePath}`);
      }
      const content = fs.readFileSync(filePath, 'utf8');
      for (const stmt of sqlStatements(content)) {
        await client.query(stmt);
      }
    }
  } finally {
    client.release();
  }
}

/** Aplica um único arquivo de migration sobre o schema já existente (sem DROP). */
export async function aplicarMigration(tag: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, `${tag}.sql`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de migration ausente: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const client = await (await ensurePool()).connect();
  try {
    for (const stmt of sqlStatements(content)) {
      await client.query(stmt);
    }
  } finally {
    client.release();
  }
}

export async function expectTabela(nome: string): Promise<void> {
  const { rows } = await (await ensurePool()).query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [nome],
  );
  expect(rows[0]?.exists).toBe(true);
}

export async function expectColuna(
  tabela: string,
  coluna: string,
  opts: { nullable: boolean },
): Promise<void> {
  const { rows } = await (await ensurePool()).query<{ is_nullable: string }>(
    `SELECT is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2`,
    [tabela, coluna],
  );
  expect(rows.length).toBe(1);
  expect(rows[0]!.is_nullable).toBe(opts.nullable ? 'YES' : 'NO');
}

export async function expectColunaAusente(tabela: string, coluna: string): Promise<void> {
  const { rows } = await (await ensurePool()).query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tabela, coluna],
  );
  expect(rows[0]?.exists).toBe(false);
}

async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await (await ensurePool()).connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Verifica se o CHECK da coluna aceita o valor: tenta INSERT mínimo
 * (ou UPDATE de probe) e espera sucesso sem violação de check.
 * Para tabelas com muitas FKs, usa ALTER TABLE VALIDATE via tentativa
 * de INSERT em tabela temporária espelhando só a coluna + CHECK — fallback:
 * consulta pg_constraint e tenta um INSERT com defaults/NULLs onde possível.
 */
export async function expectCheckAceita(
  tabela: string,
  coluna: string,
  valor: string,
): Promise<void> {
  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      // Probe: cria tabela temporária com o mesmo CHECK da coluna-alvo.
      const { rows: cons } = await client.query<{ conname: string; def: string }>(
        `SELECT c.conname,
                pg_get_constraintdef(c.oid) AS def
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relname = $1
            AND c.contype = 'c'
            AND pg_get_constraintdef(c.oid) ILIKE '%' || $2 || '%'`,
        [tabela, coluna],
      );
      const check = cons.find((c) => c.def.includes(coluna));
      if (!check) {
        throw new Error(`CHECK envolvendo ${tabela}.${coluna} não encontrado`);
      }
      await client.query(`CREATE TEMP TABLE _chk_probe (v text)`);
      // Extrai a lista IN (...) da definição e recria constraint simples.
      const match = check.def.match(/CHECK\s*\((.+)\)/i);
      if (!match) throw new Error(`Não foi possível parsear CHECK: ${check.def}`);
      const expr = match[1]!.replace(new RegExp(`"?${tabela}"?\\."?${coluna}"?`, 'g'), 'v')
        .replace(new RegExp(`"?${coluna}"?`, 'g'), 'v');
      await client.query(`ALTER TABLE _chk_probe ADD CONSTRAINT _chk_probe_c CHECK (${expr})`);
      await client.query(`INSERT INTO _chk_probe (v) VALUES ($1)`, [valor]);
      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function expectCheckRejeita(
  tabela: string,
  coluna: string,
  valor: string,
): Promise<void> {
  let rejeitou = false;
  try {
    await expectCheckAceita(tabela, coluna, valor);
  } catch {
    rejeitou = true;
  }
  expect(rejeitou).toBe(true);
}

/** Semeia divergências legadas (após 0012) com FKs mínimas válidas. */
export async function semearDivergenciasLegadas(
  tipos: string[],
): Promise<Array<{ id: string; tipoLegado: string }>> {
  return withClient(async (client) => {
    const u = await client.query<{ id: string }>(
      `INSERT INTO usuarios (nome, email, senha_hash)
       VALUES ('Mig', 'mig-${Date.now()}@t.local', 'x') RETURNING id`,
    );
    const usuarioId = u.rows[0]!.id;
    const f = await client.query<{ id: string }>(
      `INSERT INTO fornecedores (codigo, razao_social, documento_fiscal)
       VALUES ('F-MIG', 'Forn Mig', 'DOC-MIG-${Date.now()}') RETURNING id`,
    );
    const fornecedorId = f.rows[0]!.id;
    const ic = await client.query<{ id: string }>(
      `INSERT INTO itens_comerciais (codigo, descricao, unidade_comercial)
       VALUES ('IC-MIG', 'Item Mig', 'parte') RETURNING id`,
    );
    const itemComercialId = ic.rows[0]!.id;
    const op = await client.query<{ id: string }>(
      `INSERT INTO operacoes (data, dia_semana, rotulo)
       VALUES ('2099-01-01', 4, 'Op Mig') RETURNING id`,
    );
    const operacaoId = op.rows[0]!.id;
    const cp = await client.query<{ id: string }>(
      `INSERT INTO compras_programadas
         (data_operacao, operacao_id, fornecedor_id, status, usuario_criacao_id)
       VALUES ('2099-01-01', $1, $2, 'confirmada', $3) RETURNING id`,
      [operacaoId, fornecedorId, usuarioId],
    );
    const compraId = cp.rows[0]!.id;
    const r = await client.query<{ id: string }>(
      `INSERT INTO recebimentos
         (compra_programada_id, fornecedor_id, data_operacao, operacao_id,
          responsavel_recebimento_id, status, nfe_numero)
       VALUES ($1, $2, '2099-01-01', $3, $4, 'aguardando_conferencia', 'NF-MIG')
       RETURNING id`,
      [compraId, fornecedorId, operacaoId, usuarioId],
    );
    const recebimentoId = r.rows[0]!.id;
    const ri = await client.query<{ id: string }>(
      `INSERT INTO recebimentos_itens
         (recebimento_id, item_comercial_id, quantidade_esperada)
       VALUES ($1, $2, 1) RETURNING id`,
      [recebimentoId, itemComercialId],
    );
    const recebimentoItemId = ri.rows[0]!.id;

    const out: Array<{ id: string; tipoLegado: string }> = [];
    for (const tipo of tipos) {
      const d = await client.query<{ id: string }>(
        `INSERT INTO divergencias_recebimento
           (recebimento_id, recebimento_item_id, item_comercial_id, tipo, descricao,
            acao_imediata, responsavel_registro_id)
         VALUES ($1, $2, $3, $4, 'legado', 'tratar', $5) RETURNING id`,
        [recebimentoId, recebimentoItemId, itemComercialId, tipo, usuarioId],
      );
      out.push({ id: d.rows[0]!.id, tipoLegado: tipo });
    }
    return out;
  });
}

export async function buscarDivergencia(id: string): Promise<{ tipo: string; descricao: string }> {
  const { rows } = await (await ensurePool()).query<{ tipo: string; descricao: string }>(
    `SELECT tipo, descricao FROM divergencias_recebimento WHERE id = $1`,
    [id],
  );
  if (!rows[0]) throw new Error(`divergência ${id} não encontrada`);
  return rows[0];
}

export async function contarDivergenciasComTipoLegado(): Promise<number> {
  const { rows } = await (await ensurePool()).query<{ total: string }>(
    `SELECT count(*)::text AS total FROM divergencias_recebimento
      WHERE tipo IN (
        'quantidade_menor','quantidade_maior','item_divergente','qualidade_divergente',
        'peso_incompativel','item_ausente','item_excedente','inconsistencia_nf_fisico'
      )`,
  );
  return Number(rows[0]?.total ?? 0);
}
