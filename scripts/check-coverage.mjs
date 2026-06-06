#!/usr/bin/env node
// Lê coverage/coverage-summary.json e falha se lines ou branches < --min
import { readFileSync } from 'fs';
import { argv } from 'process';

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
const lines = total.lines.pct;
const branches = total.branches.pct;

console.log(`Coverage: lines=${lines}%, branches=${branches}% (min=${min}%)`);

if (lines < min || branches < min) {
  console.error(`FALHA: cobertura abaixo do mínimo de ${min}%`);
  process.exit(1);
}

console.log('OK: cobertura dentro do limiar');
process.exit(0);
