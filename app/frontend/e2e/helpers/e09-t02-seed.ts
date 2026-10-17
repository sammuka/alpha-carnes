import { randomInt } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { BACKEND_URL, loginBackend } from './onda6-seed';

export interface PlanoDaJornada {
  sufixo: string;
  centroCodigo: string;
  centroNome: string;
  debitoNome: string;
  creditoNome: string;
}

const competenciasUsadas = new Set<string>();

/** Competência futura sorteada (ano 3000–8999), única dentro da execução. */
export function competenciaUnica(): string {
  for (;;) {
    const candidata = `${randomInt(3000, 9000)}-${String(randomInt(1, 13)).padStart(2, '0')}`;
    if (!competenciasUsadas.has(candidata)) {
      competenciasUsadas.add(candidata);
      return candidata;
    }
  }
}

function ontemIso(): string {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() - 1);
  return data.toISOString().slice(0, 10);
}

async function postar(request: APIRequestContext, cookie: string, rota: string, corpo: unknown) {
  const resposta = await request.post(`${BACKEND_URL}${rota}`, {
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    data: corpo,
  });
  if (!resposta.ok()) throw new Error(`POST ${rota} -> ${resposta.status()}: ${await resposta.text()}`);
}

export interface AprovadorDaJornada { email: string; password: string; cookieHeader: string }

let aprovador: Promise<AprovadorDaJornada> | null = null;

/**
 * Segundo administrador (AD-39): o autor de uma conta não a aprova. Criado uma vez por processo pela
 * API de usuários do backend; o cabeçalho Cookie serve a qualquer APIRequestContext.
 */
export function aprovadorDaJornada(request: APIRequestContext): Promise<AprovadorDaJornada> {
  aprovador ??= (async () => {
    const { cookieHeader } = await loginBackend(request);
    const rodada = `${Date.now().toString(36)}${randomInt(46656).toString(36)}`;
    const email = `aprovador.e09.${rodada}@alphacarnes.local`;
    const password = `E09-${rodada}-Senha!9`;
    await postar(request, cookieHeader, '/usuarios', { nome: 'Aprovador do plano', email, password, perfis: ['administrador'] });
    const login = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { email, password },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!login.ok()) throw new Error(`login do aprovador -> ${login.status()}`);
    const cookie = login.headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value.split(';')[0])
      .join('; ');
    return { email, password, cookieHeader: cookie };
  })();
  return aprovador;
}

/** `debitoComoFormula` dá à conta de débito um nome que começa em "=", para provar a neutralização no CSV. */
export async function criarPlanoDaJornada(request: APIRequestContext, debitoComoFormula = false): Promise<PlanoDaJornada> {
  const { cookieHeader } = await loginBackend(request);
  const { cookieHeader: cookieAprovador } = await aprovadorDaJornada(request);
  const sufixo = `${Date.now().toString(36)}${randomInt(46656).toString(36)}`;
  const vigenciaInicio = ontemIso();
  const centroCodigo = `CT${sufixo}`;
  const plano: PlanoDaJornada = {
    sufixo,
    centroCodigo,
    centroNome: `Operação industrial ${sufixo}`,
    debitoNome: `${debitoComoFormula ? '=' : ''}Caixa e bancos ${sufixo}`,
    creditoNome: `Fornecedores ${sufixo}`,
  };
  await postar(request, cookieHeader, '/contabilidade/centros-custo', {
    codigo: centroCodigo, nome: plano.centroNome, justificativa: 'abre o centro da jornada',
  });
  const contas = [
    { codigo: `A${sufixo}`, nome: `Grupo do ativo ${sufixo}`, classificacao: 'sintetica', natureza: 'ATIVO', pai: null },
    { codigo: `A${sufixo}.1`, nome: plano.debitoNome, classificacao: 'analitica', natureza: 'ATIVO', pai: `A${sufixo}` },
    { codigo: `P${sufixo}`, nome: `Grupo do passivo ${sufixo}`, classificacao: 'sintetica', natureza: 'PASSIVO', pai: null },
    { codigo: `P${sufixo}.1`, nome: plano.creditoNome, classificacao: 'analitica', natureza: 'PASSIVO', pai: `P${sufixo}` },
  ];
  for (const conta of contas) {
    await postar(request, cookieHeader, '/contabilidade/plano', {
      codigo: conta.codigo, nome: conta.nome, classificacao: conta.classificacao, natureza: conta.natureza,
      grupo: 'Circulante', contaPaiCodigo: conta.pai, centroCodigo, vigenciaInicio, vigenciaFim: null,
      justificativa: 'abre a conta da jornada',
    });
    await postar(request, cookieHeader, `/contabilidade/plano/${conta.codigo}/revisar-competencia`, {
      numero: 1, vigenciaInicio, vigenciaFim: null, justificativa: 'revisa a competência',
    });
    // Autor e aprovador são pessoas diferentes (AD-39).
    await postar(request, cookieAprovador, `/contabilidade/plano/${conta.codigo}/aprovar`, {
      numero: 1, justificativa: 'aprova a conta da jornada',
    });
  }
  return plano;
}

/** Cria `quantidade` políticas de Liquidação, cada uma numa competência sorteada, sobre as contas do plano da jornada. */
export async function criarPoliticas(request: APIRequestContext, plano: PlanoDaJornada, quantidade: number): Promise<void> {
  const { cookieHeader } = await loginBackend(request);
  for (let i = 0; i < quantidade; i += 1) {
    await postar(request, cookieHeader, '/contabilidade/politicas', {
      tipoEvento: 'LIQUIDACAO',
      competencia: competenciaUnica(),
      contaDebitoCodigo: `A${plano.sufixo}.1`,
      contaCreditoCodigo: `P${plano.sufixo}.1`,
      centroCodigo: plano.centroCodigo,
      vigenciaInicio: ontemIso(),
      justificativa: 'cria política para paginar',
    });
  }
}
