/**
 * Base dos lints de achados recorrentes (AD-41): varredura de arquivos, AST TypeScript, allowlist
 * por arquivo e saída `arquivo:linha [regra] mensagem`. Cada `lint-*.mjs` exporta `regra`
 * ({ id, descricao, alvo(rel), verificar(rel, texto) }) e roda sozinho via `executarSeDireto`.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ts = createRequire(import.meta.url)('typescript');
const ALLOWLIST = join(RAIZ, 'scripts', 'lint-allowlist.json');
const IGNORAR = new Set(['node_modules', 'dist', '.next', 'coverage', 'test-results']);

export function arquivos(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (IGNORAR.has(e.name)) return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? arquivos(p) : [relative(RAIZ, p).split('\\').join('/')];
  });
}

export const ehTeste = (rel) => /\.(spec|test)\.tsx?$/.test(rel) || /\/(__tests__|test)\//.test(rel);

export function parse(rel, texto) {
  return ts.createSourceFile(rel, texto, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

export const linhaDe = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

export function visitar(node, fn) {
  fn(node);
  ts.forEachChild(node, (filho) => visitar(filho, fn));
}

/** Nome do método de `x.metodo(...)`, ou undefined. */
export const metodo = (call) =>
  ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : undefined;

/** Ancestral mais próximo que é `*.transaction(cb)`. */
export function transacaoDe(node) {
  for (let p = node.parent; p; p = p.parent) if (metodo(p) === 'transaction') return p;
  return undefined;
}

/** Pragma de supressão documentada: `// <regra>: ok — motivo`. */
export const temPragma = (texto, pragma) => texto.includes(`// ${pragma}: ok`);

export function aplicarAllowlist(achados, allowlist, { warn }) {
  const erros = [];
  const avisos = [];
  for (const a of achados) (warn && allowlist[a.regra]?.includes(a.arquivo) ? avisos : erros).push(a);
  const obsoletas = Object.entries(allowlist).flatMap(([regra, lista]) =>
    lista.filter((arq) => !achados.some((a) => a.regra === regra && a.arquivo === arq)).map((arq) => `${regra}: ${arq}`));
  return { erros, avisos, obsoletas };
}

export function coletar(regras) {
  return regras.flatMap((regra) =>
    ['app/backend/src', 'app/frontend/src']
      .flatMap((d) => arquivos(join(RAIZ, d)))
      .filter((rel) => regra.alvo(rel))
      .flatMap((rel) => regra.verificar(rel, readFileSync(join(RAIZ, rel), 'utf8'))));
}

export function executar(regras, argv = process.argv.slice(2)) {
  const achados = coletar(regras);
  const ativas = new Set(regras.flatMap((r) => r.ids));
  if (argv.includes('--gerar-allowlist')) {
    const atual = existsSync(ALLOWLIST) ? JSON.parse(readFileSync(ALLOWLIST, 'utf8')) : {};
    for (const id of ativas) delete atual[id];
    for (const a of achados) (atual[a.regra] ??= []).includes(a.arquivo) || atual[a.regra].push(a.arquivo);
    for (const id of Object.keys(atual)) atual[id].sort();
    writeFileSync(ALLOWLIST, `${JSON.stringify(atual, null, 2)}\n`);
    console.log(`allowlist regravada: ${achados.length} achado(s)`);
    return 0;
  }
  const todas = existsSync(ALLOWLIST) ? JSON.parse(readFileSync(ALLOWLIST, 'utf8')) : {};
  const allowlist = Object.fromEntries(Object.entries(todas).filter(([id]) => ativas.has(id)));
  const { erros, avisos, obsoletas } = aplicarAllowlist(achados, allowlist, { warn: argv.includes('--warn') });
  const fmt = (a) => `${a.arquivo}:${a.linha} [${a.regra}] ${a.mensagem}`;
  if (avisos.length) console.log(`AVISO (allowlist, backlog de hardening): ${avisos.length}\n${avisos.map(fmt).join('\n')}`);
  if (erros.length) console.error(`ERRO: ${erros.length}\n${erros.map(fmt).join('\n')}`);
  if (obsoletas.length) console.error(`ERRO: allowlist obsoleta (remova de scripts/lint-allowlist.json):\n${obsoletas.join('\n')}`);
  const falhou = erros.length > 0 || obsoletas.length > 0;
  if (!falhou) console.log(`lint achados: ok (${regras.map((r) => r.ids.join('/')).join(', ')})`);
  return falhou ? 1 : 0;
}

export function executarSeDireto(url, regras) {
  if (url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = executar(regras);
}
