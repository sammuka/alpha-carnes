import { extrairCodigoErro, extrairErrosPorCampo, extrairMensagemErro } from '@/lib/error-message';

export function normalizarDinheiro(entrada: string): string | null {
  const limpo = entrada.trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (limpo.includes(',')) {
    if (limpo.split(',').length !== 2) return null;
    const [esq, dir] = limpo.split(',');
    if (esq === undefined || dir === undefined) return null;
    if (!/^(\d{1,3}(\.\d{3})*|\d+)$/.test(esq)) return null;
    if (!/^\d{1,2}$/.test(dir)) return null;
    const inteiro = esq.replaceAll('.', '');
    if (inteiro.length > 13) return null;
    if (inteiro.length > 1 && inteiro.startsWith('0')) return null;
    return `${inteiro}.${dir.padEnd(2, '0')}`;
  }
  if ((limpo.match(/\./g) ?? []).length > 1) return null;
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, frac = ''] = limpo.split('.');
  if (inteiro === undefined) return null;
  if (inteiro.length > 1 && inteiro.startsWith('0')) return null;
  return `${inteiro}.${frac.padEnd(2, '0')}`;
}

export function normalizarEscala(entrada: string, inteirosMax: number): string | null {
  const limpo = entrada.trim().replace(/\s/g, '');
  let inteiro = '';
  let frac = '';
  if (limpo.includes(',')) {
    if (limpo.split(',').length !== 2) return null;
    const [esq, dir] = limpo.split(',');
    if (esq === undefined || dir === undefined) return null;
    if (!/^(\d{1,3}(\.\d{3})*|\d+)$/.test(esq)) return null;
    if (!/^\d{1,3}$/.test(dir)) return null;
    inteiro = esq.replaceAll('.', '');
    frac = dir;
  } else {
    if ((limpo.match(/\./g) ?? []).length > 1) return null;
    if (!/^\d+(\.\d{1,3})?$/.test(limpo)) return null;
    const partes = limpo.split('.');
    inteiro = partes[0] ?? '';
    frac = partes[1] ?? '';
  }
  if (inteiro.length > inteirosMax) return null;
  if (inteiro.length > 1 && inteiro.startsWith('0')) return null;
  return `${inteiro}.${frac.padEnd(3, '0')}`;
}

export function formatarDinheiroPtBr(canon: string): string {
  const partes = canon.split('.');
  const inteiro = partes[0] ?? '';
  const frac = partes[1] ?? '';
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${comMilhar},${frac}`;
}

export function formatarEscalaPtBr(canon: string): string {
  const partes = canon.split('.');
  const inteiro = partes[0] ?? '';
  const frac = partes[1] ?? '';
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${comMilhar},${frac}`;
}

const MESES: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

export function rotuloCompetencia(competencia: string): string {
  const partes = competencia.split('-');
  const ano = partes[0] ?? '';
  const mes = partes[1] ?? '';
  return `${MESES[mes] ?? ''} de ${ano}`;
}

export const TEXTO_VAZIO = 'Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.';
export const TEXTO_FALTA_PADRAO = 'A simulação só grava quando existe uma regra tributária aprovada cuja vigência cobre o dia 1º da competência.';
export const FRASE_SEM_ALIQUOTA = 'Esta regra não guarda alíquota deste tributo; nenhum valor é calculado.';
export const CHAVE_LISTA = 'fiscal.simulador.lista';

const MENSAGENS: Record<string, string> = {
  FALTA_REFERENCIA_LEGAL: 'Não há regra tributária aprovada vigente nesta competência para o enquadramento selecionado.',
  DESCONTO_MAIOR_QUE_VALOR: 'O desconto não pode ser maior que o valor.',
  VERSAO_IMUTAVEL: 'A memória calculada não pode ser alterada. Inclua uma versão nova.',
  ENQUADRAMENTO_DIVERGENTE: 'Estabelecimento, operação, cliente, produto e classificação fiscal (NCM) precisam ser os do enquadramento selecionado.',
  ENQUADRAMENTO_INDISPONIVEL: 'O enquadramento fiscal não cobre esta competência.',
  LINHAGEM_ENQUADRAMENTO_FIXO: 'A versão nova permanece no mesmo enquadramento fiscal.',
  SIMULACOES_DISTINTAS: 'A comparação exige duas versões da mesma simulação.',
  CONFLITO_CONCORRENTE: 'O registro foi alterado por outro usuário. Recarregue para continuar.',
};

export class ErroSimulacao extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly codigo: string | null,
    readonly porCampo: Record<string, string>,
  ) {
    super(mensagem);
    this.name = 'ErroSimulacao';
  }
}

export function mensagemDeSimulacao(erro: ErroSimulacao): string {
  const fechada = erro.codigo ? MENSAGENS[erro.codigo] : undefined;
  if (fechada) return fechada;
  if (erro.status >= 500 || erro.status === 0) return 'Serviço indisponível no momento. Tente novamente.';
  return erro.message;
}

const BASE = '/api/erp/fiscal/simulacoes';

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(caminho, {
      method: metodo,
      cache: 'no-store',
      ...(corpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    });
  } catch {
    throw new ErroSimulacao('Serviço indisponível. Verifique a conexão e tente novamente.', 0, 'SERVICO_INDISPONIVEL', {});
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const codigo = extrairCodigoErro(body);
    const fechada = codigo ? MENSAGENS[codigo] : undefined;
    const mensagem = fechada || extrairMensagemErro(body, 'Falha na operação.');
    throw new ErroSimulacao(mensagem, res.status, codigo, extrairErrosPorCampo(body));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json().catch(() => null)) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') p.set(chave, String(valor));
  }
  const texto = p.toString();
  return texto ? `?${texto}` : '';
}

export interface OpcaoCombo { id: string; rotulo: string }

export interface FiltrosLista {
  search: string;
  estabelecimentoId: string;
  clienteId: string;
  produtoId: string;
  competencia: string;
  sort: string;
  dir: 'asc' | 'desc';
  page: number;
}

export const FILTROS_LISTA: FiltrosLista = {
  search: '',
  estabelecimentoId: '',
  clienteId: '',
  produtoId: '',
  competencia: '',
  sort: 'cliente',
  dir: 'asc',
  page: 1,
};

export interface LinhaSimulacao {
  id: string;
  cliente: string;
  produto: string;
  valor: string;
  valorLiquido: string;
  estabelecimento: string;
  operacao: string;
}

export interface DetalheSimulacao {
  id: string;
  codigo: string;
  numeroVersao: number;
  versao: number;
  situacao: string;
  cliente: string;
  produto: string;
  estabelecimento: string;
  operacao: string;
  ncm: string;
  enquadramento: string;
  empresa: string;
  responsavel: string;
  quantidade: string;
  pesoNf: string;
  valor: string;
  desconto: string;
  valorLiquido: string;
  baseTributavel: string;
  icms: string;
  baseDifereBruto: boolean;
  competencia: string;
  competenciaRotulo: string;
  justificativa: string;
  criadoEm: string;
  atualizadoEm: string;
  estabelecimentoId?: string;
  operacaoId?: string;
  clienteId?: string;
  produtoId?: string;
  ncmId?: string;
  enquadramentoId?: string;
}

export interface CorpoSimulacao {
  estabelecimentoId: string;
  operacaoId: string;
  clienteId: string;
  produtoId: string;
  ncmId: string;
  quantidade: string;
  pesoNf: string;
  valor: string;
  desconto: string;
  competencia: string;
  enquadramentoId: string;
  justificativa: string;
  versao?: number;
}

export interface LinhaExplicacao { rotulo: string; valor: string }
export interface SemAliquota { rotulo: string; tratamento: string; texto: string }
export interface Explicacao {
  linhas: LinhaExplicacao[];
  semAliquota: SemAliquota[];
  referenciaLegal: string;
  textoBase: string | null;
}
export interface Diferenca { campo: string; antes: string; depois: string }
export interface Contagens { simulacoes: number; versoes: number; baseDiferente: number }
export interface EventoHistorico {
  operacao: string;
  situacaoAnterior: string | null;
  situacaoNova: string | null;
  usuarioNome: string | null;
  criadoEm: string;
  justificativa: string | null;
  resumo: string | null;
  versao: number | null;
  numeroVersao: number | null;
}
export interface PreCondicao {
  codigo: string;
  atendida: boolean;
  provisoria: boolean;
  texto?: string;
}

export const simulacoesApi = {
  listar: (filtros: FiltrosLista) => chamar<{ data: LinhaSimulacao[]; total: number }>('GET', `${BASE}${qs({ ...filtros })}`),
  contagens: (filtros: FiltrosLista) => chamar<Contagens>('GET', `${BASE}/contagens${qs({ ...filtros })}`),
  obter: (id: string) => chamar<DetalheSimulacao>('GET', `${BASE}/${id}`),
  criar: (corpo: CorpoSimulacao) => chamar<DetalheSimulacao>('POST', BASE, corpo),
  versao: (id: string, corpo: CorpoSimulacao & { versao: number }) => chamar<DetalheSimulacao>('POST', `${BASE}/${id}/versoes`, corpo),
  explicar: (id: string) => chamar<Explicacao>('GET', `${BASE}/${id}/explicacao`),
  historico: (id: string) => chamar<EventoHistorico[]>('GET', `${BASE}/${id}/historico`),
  preCondicoes: (id: string) => chamar<PreCondicao[]>('GET', `${BASE}/${id}/pre-condicoes`),
  comparar: (id: string, com: string) => chamar<{ diferencas: Diferenca[] }>('GET', `${BASE}/${id}/comparar${qs({ com })}`),
};

function linhasDe(body: unknown): Record<string, unknown>[] {
  if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: Record<string, unknown>[] }).data;
  }
  return [];
}

export async function opcoesDe(caminho: string, rotulo: (linha: Record<string, unknown>) => string): Promise<OpcaoCombo[]> {
  const body = await chamar<unknown>('GET', caminho);
  return linhasDe(body).map((linha) => ({ id: String(linha.id ?? ''), rotulo: rotulo(linha) })).filter((item) => item.id);
}
