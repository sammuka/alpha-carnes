import { execFileSync } from 'node:child_process';

/** Só bancos de teste: sufixo _e2e, _test ou _eNN_tNN (um banco por fatia). */
const BANCO_DE_TESTE = /_(e2e|test|e\d{2}_t\d{2})$/;

export function comandoLimpezaPlano(env: NodeJS.ProcessEnv = process.env): { container: string; args: string[] } {
  const bruto = env.DATABASE_URL;
  if (!bruto) throw new Error('DATABASE_URL ausente: o e2e do plano de contas não limpa banco sem saber qual.');
  const url = new URL(bruto);
  const banco = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const usuario = decodeURIComponent(url.username);
  if (!usuario) throw new Error('DATABASE_URL sem usuário.');
  if (!BANCO_DE_TESTE.test(banco)) {
    throw new Error(`Banco "${banco}" não é de teste (sufixo _e2e, _test ou _eNN_tNN). Limpeza recusada.`);
  }
  const container = env.E2E_POSTGRES_CONTAINER ?? 'alphacarnes-postgres-1';
  return {
    container,
    // CASCADE esvazia também as tabelas que referenciem estas (política da T02, quando existir) sem nomeá-las.
    args: ['exec', container, 'psql', '-U', usuario, '-d', banco, '-v', 'ON_ERROR_STOP=1', '-c',
      'TRUNCATE conta_versoes, contas_contabeis, centros_custo CASCADE;'],
  };
}

export function limparPlano() {
  execFileSync('docker', comandoLimpezaPlano().args, { stdio: 'pipe' });
}
