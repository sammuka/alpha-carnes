import { config as loadEnv } from 'dotenv';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool, type PoolClient } from 'pg';

loadEnv({ path: path.resolve(__dirname, '../../../../.env') });
loadEnv();

export const MIGRATIONS_DIR = path.resolve(
  __dirname,
  '../../src/database/migrations',
);
export const BACKEND_DIR = path.resolve(__dirname, '../..');
export const WORKTREE_ROOT = path.resolve(BACKEND_DIR, '../..');

type Journal = {
  entries: Array<{ idx: number; when: number; tag: string }>;
};

function loadJournal(): Journal {
  return JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8'),
  ) as Journal;
}

export function migrationStatements(tag: string): string[] {
  const filePath = path.join(MIGRATIONS_DIR, `${tag}.sql`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration ausente: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function dedicatedConnectionString(): string {
  if (process.env.DATABASE_URL_ONDA4_MIGRATIONS) {
    return process.env.DATABASE_URL_ONDA4_MIGRATIONS;
  }
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL não definida');
  return base.replace(
    /\/([^/?]+)(\?.*)?$/,
    '/$1_onda4_migrations$2',
  );
}

export function onda4DatabaseUrl(): string {
  return dedicatedConnectionString();
}

async function ensureDatabase(connectionString: string): Promise<void> {
  const match = connectionString.match(
    /^(postgres(?:ql)?:\/\/[^/]+)\/([^/?]+)(.*)$/i,
  );
  if (!match) {
    throw new Error(`DATABASE_URL_ONDA4_MIGRATIONS inválida: ${connectionString}`);
  }
  const [, origin, databaseName, suffix] = match;
  if (!databaseName || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseName)) {
    throw new Error(`Nome de database de migrations inválido: ${databaseName}`);
  }

  const admin = new Pool({
    connectionString: `${origin}/postgres${suffix ?? ''}`,
    max: 1,
  });
  try {
    const { rows } = await admin.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
      [databaseName],
    );
    if (!rows[0]?.exists) {
      await admin.query(`CREATE DATABASE ${databaseName}`);
    }
  } finally {
    await admin.end();
  }
}

let pool: Pool | null = null;
let poolReady: Promise<Pool> | null = null;

export async function onda4Pool(): Promise<Pool> {
  if (pool) return pool;
  if (!poolReady) {
    poolReady = (async () => {
      const connectionString = dedicatedConnectionString();
      await ensureDatabase(connectionString);
      pool = new Pool({ connectionString, max: 2 });
      return pool;
    })();
  }
  return poolReady;
}

export async function closeOnda4Pool(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
  poolReady = null;
}

export async function resetOnda4Database(): Promise<void> {
  const client = await (await onda4Pool()).connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  } finally {
    client.release();
  }
}

async function executeTags(
  client: PoolClient,
  tags: string[],
): Promise<void> {
  for (const tag of tags) {
    for (const statement of migrationStatements(tag)) {
      await client.query(statement);
    }
  }
}

export async function migrarAteOnda4(tag: string): Promise<void> {
  await resetOnda4Database();
  const journal = loadJournal();
  const target = journal.entries.find((entry) => entry.tag === tag);
  if (!target) throw new Error(`Tag não encontrada: ${tag}`);

  const client = await (await onda4Pool()).connect();
  try {
    await client.query('BEGIN');
    await executeTags(
      client,
      journal.entries
        .filter((entry) => entry.idx <= target.idx)
        .map((entry) => entry.tag),
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function aplicarTagsOnda4(tags: string[]): Promise<void> {
  const client = await (await onda4Pool()).connect();
  try {
    await client.query('BEGIN');
    await executeTags(client, tags);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function inOnda4Transaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await (await onda4Pool()).connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('ROLLBACK');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function markDrizzleThrough(tag: string): Promise<void> {
  const journal = loadJournal();
  const entry = journal.entries.find((candidate) => candidate.tag === tag);
  if (!entry) throw new Error(`Tag não encontrada: ${tag}`);
  const file = fs.readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`));
  const hash = createHash('sha256').update(file).digest('hex');
  const p = await onda4Pool();
  await p.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await p.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  await p.query(
    `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
     VALUES ($1, $2)`,
    [hash, entry.when],
  );
}

export async function migrateOnda4WithDrizzle(): Promise<void> {
  const p = await onda4Pool();
  await migrate(drizzle(p), { migrationsFolder: MIGRATIONS_DIR });
}

export function runOnda4Seed(): string {
  const tsxCli = path.resolve(WORKTREE_ROOT, 'node_modules/tsx/dist/cli.mjs');
  const result = spawnSync(
    process.execPath,
    [tsxCli, 'src/database/seed.ts'],
    {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      DATABASE_URL: dedicatedConnectionString(),
    },
    encoding: 'utf8',
    timeout: 120_000,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `seed falhou (${result.status}): ${result.error?.message ?? ''}\n` +
      `${result.stdout}\n${result.stderr}`,
    );
  }
  return `${result.stdout}\n${result.stderr}`;
}

export function runDrizzleKit(
  cwd: string,
  args: string[],
): string {
  const binary = path.resolve(
    WORKTREE_ROOT,
    'node_modules/drizzle-kit/bin.cjs',
  );
  const result = spawnSync(process.execPath, [binary, ...args], {
    cwd,
    env: { ...process.env, CI: 'true' },
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `drizzle-kit falhou (${result.status}): ${result.error?.message ?? ''}\n` +
      `${result.stdout}\n${result.stderr}`,
    );
  }
  return `${result.stdout}\n${result.stderr}`;
}

export async function columnExists(
  table: string,
  column: string,
): Promise<boolean> {
  const { rows } = await (await onda4Pool()).query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`,
    [table, column],
  );
  return rows[0]?.exists ?? false;
}

export async function tableExists(table: string): Promise<boolean> {
  const { rows } = await (await onda4Pool()).query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [table],
  );
  return rows[0]?.exists ?? false;
}

export async function indexExists(index: string): Promise<boolean> {
  const { rows } = await (await onda4Pool()).query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = $1
     ) AS exists`,
    [index],
  );
  return rows[0]?.exists ?? false;
}
