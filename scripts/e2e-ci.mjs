#!/usr/bin/env node
/**
 * `npm run e2e:ci` — Playwright determinístico (AD-41): banco novo por execução (clonado de um
 * template migrado+semeado), backend `node dist/main.js` e frontend `next start` em portas livres,
 * Playwright com E2E_EXTERNAL=1 e limpeza garantida no finally. Uso e flags: app/frontend/e2e/README.md.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = join(RAIZ, 'app', 'backend');
const FRONTEND = join(RAIZ, 'app', 'frontend');
const PG_PADRAO = 'postgres://alphacarnes:alphacarnes@localhost:15433/postgres';
const STAMP = join(FRONTEND, '.next', 'e2e-ci.json');
const RESTAURAR = [join(FRONTEND, 'AGENTS.md'), join(FRONTEND, 'next-env.d.ts')];

const DEFAULTS_TESTE = {
  JWT_ACCESS_SECRET: 'ci-access-secret-min-32-chars-for-tests',
  JWT_REFRESH_SECRET: 'ci-refresh-secret-min-32-chars-for-tests',
  JWT_ACCESS_TTL: '8h',
  JWT_REFRESH_TTL: '8h',
  COOKIE_SECURE: 'false',
  HARDWARE_FAKE: '1',
  NFSE_FAKE: '1',
  LOG_LEVEL: 'error',
  THROTTLE_LOGIN_LIMIT: '100',
  THROTTLE_LOGIN_TTL: '60000',
  SEED_ADMIN_EMAIL: 'admin@alphacarnes.local',
  SEED_ADMIN_PASSWORD: 'Admin@CiTest123456',
};

export function ambienteDeTeste(env = process.env) {
  const out = {};
  for (const [k, v] of Object.entries(DEFAULTS_TESTE)) out[k] = env[k] ?? v;
  return out;
}

function porta(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`porta inválida: ${valor}`);
  return n;
}

export function lerArgumentos(argv) {
  const opcoes = { keepDb: false, noBuild: false, build: false, portBackend: undefined, portFrontend: undefined };
  const playwright = [];
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    if (flag === '--keep-db') opcoes.keepDb = true;
    else if (flag === '--no-build') opcoes.noBuild = true;
    else if (flag === '--build') opcoes.build = true;
    else if (flag === '--port-backend') opcoes.portBackend = porta(inline ?? argv[++i]);
    else if (flag === '--port-frontend') opcoes.portFrontend = porta(inline ?? argv[++i]);
    else playwright.push(argv[i]);
  }
  return { opcoes, playwright };
}

export function nomeBancoExecucao(agora = new Date(), id = Math.random().toString(36).slice(2, 8)) {
  const ts = agora.toISOString().replace(/\D/g, '').slice(0, 14);
  return `alphacarnes_${ts}_${id.toLowerCase().replace(/[^a-z0-9]/g, '')}_e2e`;
}

export function urlComBanco(url, banco) {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
}

/** Hash das migrations + seeds: o template muda de nome quando o schema/seed muda. */
function hashTemplate() {
  const h = createHash('sha256');
  const db = join(BACKEND, 'src', 'database');
  const visitar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(dir, e.name);
      if (e.isDirectory()) visitar(p);
      else {
        h.update(relative(RAIZ, p).split('\\').join('/'));
        h.update(readFileSync(p));
      }
    }
  };
  visitar(join(db, 'migrations'));
  visitar(join(BACKEND, 'src', 'common', 'rbac'));
  for (const f of readdirSync(db).filter((n) => /^seed.*\.ts$/.test(n)).sort()) h.update(readFileSync(join(db, f)));
  return h.digest('hex').slice(0, 12);
}

const log = (msg) => console.log(`[e2e:ci] ${msg}`);
const ident = (nome) => {
  if (!/^[a-z0-9_]+$/.test(nome)) throw new Error(`identificador inválido: ${nome}`);
  return `"${nome}"`;
};

async function comAdmin(pgUrl, fn) {
  const pg = (await import('pg')).default;
  const c = new pg.Client({ connectionString: pgUrl });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

function rodar(cmd, cwd, env) {
  const r = spawnSync(cmd, { cwd, env, stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error(`falhou (${r.status}): ${cmd}`);
}

async function prepararBanco(pgUrl, banco, env) {
  const template = `alphacarnes_e2e_template_${hashTemplate()}`;
  const existe = await comAdmin(pgUrl, async (c) =>
    (await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [template])).rowCount > 0);
  if (!existe) {
    log(`template ${template} ausente: migrando e semeando do zero`);
    const construcao = `${template}_${banco.split('_')[2]}_wip`;
    await comAdmin(pgUrl, (c) => c.query(`CREATE DATABASE ${ident(construcao)}`));
    try {
      const envDb = { ...env, DATABASE_URL: urlComBanco(pgUrl, construcao) };
      rodar('npm run db:migrate', BACKEND, envDb);
      rodar('npm run db:seed', BACKEND, envDb);
      await comAdmin(pgUrl, (c) => c.query(`ALTER DATABASE ${ident(construcao)} RENAME TO ${ident(template)}`));
    } catch (e) {
      await comAdmin(pgUrl, (c) => c.query(`DROP DATABASE IF EXISTS ${ident(construcao)} WITH (FORCE)`));
      // outra execução pode ter publicado o mesmo template em paralelo
      if (!/already exists/.test(String(e))) throw e;
    }
  }
  await comAdmin(pgUrl, (c) => c.query(`CREATE DATABASE ${ident(banco)} TEMPLATE ${ident(template)}`));
  log(`banco ${banco} criado a partir de ${template}`);
}

function portaLivre(preferida) {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', (e) => (preferida ? resolve(portaLivre()) : reject(e)));
    s.listen(preferida ?? 0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function esperar(url, ms, processo) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (processo.exitCode !== null) throw new Error(`processo saiu (${processo.exitCode}) antes de ${url} responder`);
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.status < 500) return;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timeout esperando ${url}`);
}

function iniciar(args, cwd, env, rotulo) {
  const p = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'inherit', 'inherit'], detached: process.platform !== 'win32' });
  log(`${rotulo} pid=${p.pid}`);
  return p;
}

function parar(p) {
  if (!p || p.exitCode !== null) return;
  // mata só a árvore do PID que este script criou
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(-p.pid, 'SIGTERM');
    } catch {
      p.kill('SIGTERM');
    }
  }
}

async function main() {
  const { opcoes, playwright } = lerArgumentos(process.argv.slice(2));
  const pgUrl = process.env.E2E_PG_URL ?? PG_PADRAO;
  const banco = nomeBancoExecucao();
  const copias = RESTAURAR.filter(existsSync).map((f) => [f, readFileSync(f)]);
  const filhos = [];
  let bancoCriado = false;
  let codigo = 1;
  const limpar = async () => {
    filhos.forEach(parar);
    for (const [f, conteudo] of copias) {
      if (!existsSync(f) || !readFileSync(f).equals(conteudo)) writeFileSync(f, conteudo);
    }
    if (bancoCriado && !opcoes.keepDb) {
      await comAdmin(pgUrl, (c) => c.query(`DROP DATABASE IF EXISTS ${ident(banco)} WITH (FORCE)`))
        .then(() => log(`banco ${banco} removido`))
        .catch((e) => console.error(`[e2e:ci] falha ao remover ${banco}: ${e.message}`));
    } else if (bancoCriado) log(`--keep-db: banco ${banco} mantido`);
  };
  process.once('SIGINT', () => limpar().finally(() => process.exit(130)));

  try {
    const base = { ...process.env, ...ambienteDeTeste() };
    await prepararBanco(pgUrl, banco, base);
    bancoCriado = true;

    const stamp = existsSync(STAMP) ? JSON.parse(readFileSync(STAMP, 'utf8')) : {};
    const portaBackend = await portaLivre(opcoes.portBackend ?? (Number(process.env.E2E_BACKEND_PORT) || stamp.portaBackend));
    const portaFrontend = await portaLivre(opcoes.portFrontend ?? (Number(process.env.E2E_FRONTEND_PORT) || undefined));
    const backendUrl = `http://127.0.0.1:${portaBackend}`;
    const frontendUrl = `http://127.0.0.1:${portaFrontend}`;
    const env = {
      ...base,
      DATABASE_URL: urlComBanco(pgUrl, banco),
      PORT: String(portaBackend),
      CORS_ORIGIN: frontendUrl,
      BACKEND_INTERNAL_URL: backendUrl,
      NEXT_PUBLIC_API_URL: backendUrl,
      E2E_BACKEND_URL: backendUrl,
      E2E_FRONTEND_URL: frontendUrl,
      PLAYWRIGHT_BASE_URL: frontendUrl,
      E2E_EXTERNAL: '1',
      NODE_ENV: 'production',
    };
    delete env.CI; // `CI` muda reuseExistingServer; aqui o Playwright não sobe servidor algum

    if (opcoes.build || !existsSync(join(BACKEND, 'dist', 'main.js'))) rodar('npm run build', BACKEND, env);
    // NEXT_PUBLIC_API_URL é embutido no build: --no-build só reaproveita .next do mesmo backend.
    if (opcoes.noBuild && stamp.backendUrl !== backendUrl) {
      throw new Error(`--no-build: .next foi gerado para ${stamp.backendUrl ?? '(sem stamp)'} e o backend agora é ${backendUrl}; rode sem --no-build ou use --port-backend ${stamp.portaBackend}`);
    }
    if (!opcoes.noBuild) {
      rodar('npx next build --webpack', FRONTEND, env);
      writeFileSync(STAMP, JSON.stringify({ backendUrl, portaBackend }));
    }

    const backend = iniciar([join('dist', 'main.js')], BACKEND, env, `backend ${backendUrl}`);
    filhos.push(backend);
    await esperar(`${backendUrl}/health`, 60_000, backend);
    const nextBin = createRequire(join(FRONTEND, 'package.json')).resolve('next/dist/bin/next');
    const frontend = iniciar([nextBin, 'start', '-p', String(portaFrontend), '-H', '127.0.0.1'], FRONTEND, env, `frontend ${frontendUrl}`);
    filhos.push(frontend);
    await esperar(`${frontendUrl}/login`, 60_000, frontend);

    const cli = createRequire(join(FRONTEND, 'package.json')).resolve('@playwright/test/cli');
    const pw = spawnSync(process.execPath, [cli, 'test', ...playwright], { cwd: FRONTEND, env, stdio: 'inherit' });
    codigo = pw.status ?? 1;
  } catch (e) {
    console.error(`[e2e:ci] ${e.message}`);
    codigo = 1;
  } finally {
    await limpar();
  }
  process.exit(codigo);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
