/**
 * Seed HTTP do E01-T05. Reusa a base da T04 (estabelecimento aprovado, CFOP 5102,
 * NCM 02013000, enquadramento ATIVA e regra APROVADA) e grava uma simulação CALCULADA.
 */
import type { APIRequestContext } from '@playwright/test';
import { BACKEND_URL } from './onda6-seed';
import {
  criarCenario,
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type CenarioE01T04,
  type UsuarioE2e,
  type UsuariosE01,
} from './e01-t04-seed';

export {
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type UsuarioE2e,
  type UsuariosE01,
};

const MOTIVO = 'Seed E2E E01-T05';

export interface CenarioE01T05 extends CenarioE01T04 {
  simulacaoId: string;
  simulacaoCodigo: string;
}

async function api<T>(
  request: APIRequestContext,
  cookie: string,
  rota: string,
  corpo: unknown,
): Promise<T> {
  const res = await request.fetch(`${BACKEND_URL}${rota}`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    data: corpo,
  });
  const dados = (await res.json().catch(async () => ({ raw: await res.text() }))) as T;
  if (!res.ok()) throw new Error(`POST ${rota} → ${res.status()}: ${JSON.stringify(dados)}`);
  return dados;
}

export async function criarCenarioHomologacao(
  request: APIRequestContext,
  cookieA: string,
  cookieB: string,
  rotulo: string,
): Promise<CenarioE01T05> {
  const cenario = await criarCenario(request, cookieA, cookieB, rotulo);
  const simulacao = await api<{ id: string; codigo: string }>(request, cookieA, '/fiscal/simulacoes', {
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
  return { ...cenario, simulacaoId: simulacao.id, simulacaoCodigo: simulacao.codigo };
}
