/**
 * Acesso SQL único dos E2E. O banco vem SEMPRE de DATABASE_URL (o `npm run e2e:ci` exporta o
 * banco descartável da execução); nada de nome de banco ou de contêiner fixo.
 */
import { Client } from 'pg';

/** Nome do banco vindo de DATABASE_URL; recusa banco sem sufixo de teste. */
export function bancoDeTeste(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL é obrigatório para o seed SQL do E2E');
  const nome = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!/^[a-z0-9_]+$/.test(nome) || !/_(test|e2e|e01_t\d+)$/.test(nome)) {
    throw new Error(`Banco "${nome}" sem sufixo de teste (_test, _e2e ou _e01_tNN): seed SQL recusado`);
  }
  return nome;
}

/** Executa SQL no banco de teste de DATABASE_URL (falha alto; nunca em banco sem sufixo de teste). */
export async function executarSql(sql: string): Promise<void> {
  bancoDeTeste();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
