#!/usr/bin/env node
// Lê coverage/coverage-summary.json e falha se o total OU qualquer service
// tocado pelo PR ficar abaixo de --min em lines/branches.
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { argv, env } from 'process';
import { resolve } from 'path';

const minIdx = argv.indexOf('--min');
const min = minIdx !== -1 ? parseInt(argv[minIdx + 1], 10) : 80;

const summaryPath = new URL('../coverage/coverage-summary.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
let summary;
try {
  summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
} catch (e) {
  console.error('Erro ao ler coverage-summary.json:', e.message);
  process.exit(1);
}

const total = summary.total;
const avaliar = (rotulo, cobertura) => {
  const lines = cobertura.lines.pct;
  const branches = cobertura.branches.pct;
  console.log(`Coverage ${rotulo}: lines=${lines}%, branches=${branches}% (min=${min}%)`);
  if (lines < min || branches < min) {
    console.error(`FALHA: ${rotulo} abaixo do mínimo de ${min}%`);
    return false;
  }
  return true;
};

let ok = avaliar('total', total);

const baseRef = env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : 'HEAD^';
let changedServices = [];
try {
  changedServices = execFileSync(
    'git',
    ['diff', '--name-only', `${baseRef}...HEAD`, '--', 'app/backend/src/**/*.service.ts'],
    { encoding: 'utf8' },
  ).trim().split(/\r?\n/).filter(Boolean);
} catch (error) {
  console.error(`FALHA: não foi possível calcular services tocados contra ${baseRef}: ${error.message}`);
  process.exit(1);
}

const entries = Object.entries(summary).filter(([key]) => key !== 'total');
for (const service of changedServices) {
  const expectedSuffix = service.replace(/^app\/backend\//, '').replaceAll('/', '\\');
  const match = entries.find(([key]) => {
    const normalized = resolve(key).replaceAll('/', '\\');
    return normalized.endsWith(expectedSuffix);
  });
  if (!match) {
    console.error(`FALHA: service tocado sem entrada de cobertura: ${service}`);
    ok = false;
    continue;
  }
  ok = avaliar(service, match[1]) && ok;
}

if (!ok) process.exit(1);
console.log(`OK: cobertura total e ${changedServices.length} service(s) tocado(s) dentro do limiar`);
