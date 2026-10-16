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

/**
 * Várias homologações da mesma versão de regra: abre, rejeita e abre de novo (a rejeitada libera a regra),
 * para passar de 20 linhas na lista. A última fica em revisão.
 */
export async function criarHomologacoesEmLote(
  request: APIRequestContext,
  cookieA: string,
  cookieB: string,
  cenario: CenarioE01T05,
  quantidade: number,
  descricao: string,
): Promise<void> {
  for (let i = 0; i < quantidade; i += 1) {
    const aberta = await api<{ id: string; versao: number }>(request, cookieA, '/fiscal/homologacoes', {
      regraId: cenario.regraId,
      descricao,
      justificativa: MOTIVO,
    });
    if (i < quantidade - 1) {
      await api(request, cookieB, `/fiscal/homologacoes/${aberta.id}/rejeitar`, { versao: aberta.versao, justificativa: MOTIVO });
    }
  }
}
