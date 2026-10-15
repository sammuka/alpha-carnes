/**
 * Seed HTTP do E01-T04. Estabelecimento aprovado, operação, produto, cliente,
 * CFOP 5102, NCM 02013000, enquadramento ATIVA e regra APROVADA nascem pela API.
 * A vigência do enquadramento cobre 2027-01-01; a da regra termina em 2026-12-31,
 * para a competência 2027-01 cair em falta de referência e não em enquadramento indisponível.
 */
import type { APIRequestContext } from '@playwright/test';
import {
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type UsuarioE2e,
  type UsuariosE01,
} from './e01-t03-seed';
import { criarBase, type CenarioE01T02 } from './e01-t02-seed';
import { BACKEND_URL } from './onda6-seed';

export {
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type UsuarioE2e,
  type UsuariosE01,
};

const MOTIVO = 'Seed E2E E01-T04';

export interface CenarioE01T04 extends CenarioE01T02 {
  cfopId: string;
  ncmId: string;
  enquadramentoId: string;
  codigoEnquadramento: string;
  regraId: string;
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
  if (res.status() !== 409) throw new Error(`POST ${rota} → ${res.status()}: ${JSON.stringify(corpo)}`);
  const lista = await api<{ data: Array<{ id: string; codigo: string }> }>(
    request, cookie, 'GET', `${rota}?search=${encodeURIComponent(codigo)}&pageSize=20`,
  );
  const achado = lista.data.find((item) => item.codigo === codigo);
  if (!achado) throw new Error(`POST ${rota} 409 e a busca não achou ${codigo}`);
  return achado;
}

function codigoUnico(prefixo: string, digitos: number): string {
  return `${prefixo}${String(Date.now()).slice(-digitos)}`;
}

/** Enquadramento ATIVA até 2027-12-31 e regra APROVADA só até 2026-12-31. */
export async function criarCenario(
  request: APIRequestContext,
  cookieA: string,
  cookieB: string,
  rotulo: string,
): Promise<CenarioE01T04> {
  const base = await criarBase(request, cookieA, cookieB, rotulo);
  const cfop = await garantirCodigo(request, cookieA, '/fiscal/cfops', '5102', 'Venda de mercadoria');
  const ncm = await garantirCodigo(request, cookieA, '/fiscal/ncms', '02013000', 'Carnes bovinas');
  const enquadramento = await api<{ id: string; codigo: string }>(request, cookieA, 'POST', '/fiscal/enquadramentos', {
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
    vigenciaFim: '2027-12-31',
    prioridade: 1,
    justificativa: MOTIVO,
  });
  const beneficio = await api<{ id: string }>(request, cookieA, 'POST', '/fiscal/beneficios-fiscais', {
    codigo: codigoUnico('SP', 6),
    descricao: 'Redução de base — São Paulo',
    justificativa: MOTIVO,
  });
  const classificacao = await api<{ id: string }>(request, cookieA, 'POST', '/fiscal/classificacoes-ibs-cbs', {
    codigo: codigoUnico('', 6),
    descricao: 'Tributação integral da classificação',
    justificativa: MOTIVO,
  });
  const rascunho = await api<{ id: string; versao: number }>(request, cookieA, 'POST', '/fiscal/regras', {
    enquadramentoId: enquadramento.id,
    operacaoId: base.operacaoId,
    cfopId: cfop.id,
    icmsCst: '20',
    pRedBc: '41,67',
    pIcms: '12,00',
    beneficioFiscalId: beneficio.id,
    ipiCst: '53',
    pisCst: '06',
    ibsCst: '000',
    classificacaoIbsCbsId: classificacao.id,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: '2026-12-31',
    justificativa: MOTIVO,
  });
  const submetida = await api<{ versao: number }>(request, cookieA, 'POST', `/fiscal/regras/${rascunho.id}/submeter`, {
    versao: rascunho.versao,
    justificativa: MOTIVO,
  });
  await api(request, cookieB, 'POST', `/fiscal/regras/${rascunho.id}/aprovar`, {
    versao: submetida.versao,
    justificativa: MOTIVO,
  });
  return {
    ...base,
    cfopId: cfop.id,
    ncmId: ncm.id,
    enquadramentoId: enquadramento.id,
    codigoEnquadramento: enquadramento.codigo,
    regraId: rascunho.id,
  };
}

/** Linha calculada para o teclado, sem passar pelo drawer. */
export async function criarSimulacaoApoio(
  request: APIRequestContext,
  cookie: string,
  cenario: CenarioE01T04,
): Promise<void> {
  await api(request, cookie, 'POST', '/fiscal/simulacoes', {
    estabelecimentoId: cenario.estabelecimento.id,
    operacaoId: cenario.operacaoId,
    clienteId: cenario.clienteId,
    produtoId: cenario.produtoId,
    ncmId: cenario.ncmId,
    quantidade: '10,000',
    pesoNf: '982,000',
    valor: '1.000,00',
    desconto: '0,00',
    competencia: '2026-10',
    enquadramentoId: cenario.enquadramentoId,
    justificativa: MOTIVO,
  });
}
