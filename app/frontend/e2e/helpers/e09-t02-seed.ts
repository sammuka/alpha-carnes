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

export async function criarPlanoDaJornada(request: APIRequestContext): Promise<PlanoDaJornada> {
  const { cookieHeader } = await loginBackend(request);
  const sufixo = `${Date.now().toString(36)}${randomInt(46656).toString(36)}`;
  const vigenciaInicio = ontemIso();
  const centroCodigo = `CT${sufixo}`;
  const plano: PlanoDaJornada = {
    sufixo,
    centroCodigo,
    centroNome: `Operação industrial ${sufixo}`,
    debitoNome: `Caixa e bancos ${sufixo}`,
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
    await postar(request, cookieHeader, `/contabilidade/plano/${conta.codigo}/aprovar`, {
      numero: 1, justificativa: 'aprova a conta da jornada',
    });
  }
  return plano;
}
