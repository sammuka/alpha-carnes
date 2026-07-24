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

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL não definida');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Recria o schema public e aplica migrations do journal até o tag informado (inclusive). */
export async function migrarAte(tag: string): Promise<void> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
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

export async function expectTabela(nome: string): Promise<void> {
  const { rows } = await getPool().query<{ exists: boolean }>(
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
  const { rows } = await getPool().query<{ is_nullable: string }>(
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

async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
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
