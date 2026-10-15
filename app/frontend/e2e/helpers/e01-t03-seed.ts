/**
 * Seed HTTP do E01-T03. Estabelecimento, operação, produto, cliente, CFOP 5102,
 * NCM 02013000 e o enquadramento ativo nascem pela API. SP020450 e 000001 não
 * entram por INSERT: a jornada grava os dois pelo diálogo; o apoio de
 * acessibilidade usa o POST do catálogo e reaproveita a linha se ela já existe.
 */
import { execFileSync } from 'node:child_process';
import type { APIRequestContext } from '@playwright/test';
import {
  criarBase,
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type CenarioE01T02,
  type UsuarioE2e,
  type UsuariosE01,
} from './e01-t02-seed';
import { BACKEND_URL } from './onda6-seed';

export {
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type UsuarioE2e,
  type UsuariosE01,
};

const MOTIVO = 'Seed E2E E01-T03';
const SUFIXO_DE_TESTE = /(_test|_e2e|_e01_t\d+)$/;

/** Banco do E2E vem de DATABASE_URL; nome sem sufixo de teste é recusado para nunca tocar dado real. */
function bancoDeTeste(): { banco: string; usuario: string } {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL é obrigatória para liberar os códigos da jornada.');
  const alvo = new URL(url);
  const banco = decodeURIComponent(alvo.pathname.replace(/^\//, ''));
  if (!SUFIXO_DE_TESTE.test(banco)) {
    throw new Error(`Banco "${banco}" não tem sufixo de teste (_test, _e2e ou _e01_tNN); recusado.`);
  }
  return { banco, usuario: decodeURIComponent(alvo.username) || 'alphacarnes' };
}

export const CODIGO_BENEFICIO = 'SP020450';
export const DESC_BENEFICIO = 'Redução de base — São Paulo (SP020450)';
export const CODIGO_CLASSIFICACAO = '000001';
export const DESC_CLASSIFICACAO = 'Tributação integral (000001)';

export interface CenarioE01T03 extends CenarioE01T02 {
  cfopId: string;
  cfopCodigo: string;
  cfopDivergenteId: string;
  cfopDivergenteCodigo: string;
  enquadramentoId: string;
  codigoEnquadramento: string;
}

async function api<T>(
  request: APIRequestContext,
  cookie: string,
  method: 'GET' | 'POST',
  rota: string,
  corpo?: unknown,
): Promise<T> {
  const res = await request.fetch(`${BACKEND_URL}${rota}`, {
    method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    data: corpo,
  });
  const dados = (await res.json().catch(async () => ({ raw: await res.text() }))) as T;
  if (!res.ok()) throw new Error(`${method} ${rota} → ${res.status()}: ${JSON.stringify(dados)}`);
  return dados;
}

/** POST do código; se já existe, devolve a linha ativa da busca. Nunca faz INSERT SQL. */
async function garantirCodigo(
  request: APIRequestContext,
  cookie: string,
  rota: string,
  codigo: string,
  descricao: string,
): Promise<{ id: string; codigo: string }> {
  const res = await request.fetch(`${BACKEND_URL}${rota}`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    data: { codigo, descricao, justificativa: MOTIVO },
  });
  const corpo = (await res.json().catch(async () => ({ raw: await res.text() }))) as { id?: string; codigo?: string };
  if (res.ok() && corpo.id && corpo.codigo) return { id: corpo.id, codigo: corpo.codigo };
  if (res.status() !== 409) {
    throw new Error(`POST ${rota} → ${res.status()}: ${JSON.stringify(corpo)}`);
  }
  const lista = await api<{ data: Array<{ id: string; codigo: string }> }>(
    request,
    cookie,
    'GET',
    `${rota}?search=${encodeURIComponent(codigo)}&pageSize=20`,
  );
  const achado = lista.data.find((item) => item.codigo === codigo);
  if (!achado) throw new Error(`POST ${rota} 409 e a busca não achou ${codigo}`);
  return achado;
}

/** Enquadramento ativo com CFOP 5102 e um segundo CFOP para a divergência. */
export async function criarCenario(
  request: APIRequestContext,
  cookieA: string,
  cookieB: string,
  rotulo: string,
): Promise<CenarioE01T03> {
  const base = await criarBase(request, cookieA, cookieB, rotulo);
  const cfop = await garantirCodigo(request, cookieA, '/fiscal/cfops', '5102', 'Venda de mercadoria');
  const ncm = await garantirCodigo(request, cookieA, '/fiscal/ncms', '02013000', 'Carnes bovinas');
  const outro = await garantirCodigo(request, cookieA, '/fiscal/cfops', '6102', 'Venda interestadual');
  const criado = await api<{ id: string; codigo: string }>(request, cookieA, 'POST', '/fiscal/enquadramentos', {
    estabelecimentoId: base.estabelecimento.id,
    operacaoId: base.operacaoId,
    tpNf: '1',
    finNfe: '1',
    cfopId: cfop.id,
    abrangencia: 'INTERNA',
    tipoProduto: 'REVENDA',
    produtoId: base.produtoId,
    ncmId: ncm.id,
    cest: '1708700',
    clienteId: base.clienteId,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: '2026-12-31',
    prioridade: 1,
    justificativa: MOTIVO,
  });
  return {
    ...base,
    cfopId: cfop.id,
    cfopCodigo: cfop.codigo,
    cfopDivergenteId: outro.id,
    cfopDivergenteCodigo: outro.codigo,
    enquadramentoId: criado.id,
    codigoEnquadramento: criado.codigo,
  };
}

/**
 * Rascunho de apoio para o teclado. O catálogo nasce pelo POST da API desta
 * fatia; se a jornada já gravou o código pelo diálogo, a busca reaproveita.
 */
export async function criarRegraApoio(
  request: APIRequestContext,
  cookie: string,
  cenario: CenarioE01T03,
): Promise<void> {
  const beneficio = await garantirCodigo(
    request, cookie, '/fiscal/beneficios-fiscais', CODIGO_BENEFICIO, DESC_BENEFICIO,
  );
  const classificacao = await garantirCodigo(
    request, cookie, '/fiscal/classificacoes-ibs-cbs', CODIGO_CLASSIFICACAO, DESC_CLASSIFICACAO,
  );
  await api(request, cookie, 'POST', '/fiscal/regras', {
    enquadramentoId: cenario.enquadramentoId,
    operacaoId: cenario.operacaoId,
    cfopId: cenario.cfopId,
    icmsCst: '20',
    pRedBc: '41,67',
    pIcms: '12,00',
    beneficioFiscalId: beneficio.id,
    ipiCst: '53',
    pisCst: '06',
    ibsCst: '000',
    classificacaoIbsCbsId: classificacao.id,
    vigenciaInicio: '2026-02-01',
    justificativa: MOTIVO,
  });
}

/** Libera os códigos da jornada para o diálogo criar de novo. Não insere linha. */
export function liberarCodigosDaJornada(): void {
  const sql = [
    `UPDATE beneficios_fiscais SET deleted_at = now() WHERE codigo = '${CODIGO_BENEFICIO}' AND deleted_at IS NULL;`,
    `UPDATE classificacoes_ibs_cbs SET deleted_at = now() WHERE codigo = '${CODIGO_CLASSIFICACAO}' AND deleted_at IS NULL;`,
  ].join(' ');
  executarSqlDeTeste(sql);
}

/** psql no contêiner do Postgres, sempre no banco de teste derivado de DATABASE_URL. */
export function executarSqlDeTeste(sql: string): void {
  const { banco, usuario } = bancoDeTeste();
  execFileSync('docker', [
    'exec', process.env.E2E_PG_CONTAINER ?? 'alphacarnes-postgres-1',
    'psql', '-U', usuario, '-d', banco,
    '-v', 'ON_ERROR_STOP=1', '-c', sql,
  ], { stdio: 'pipe' });
}
