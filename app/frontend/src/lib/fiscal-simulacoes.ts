import { extrairCodigoErro, extrairErrosPorCampo, extrairMensagemErro } from '@/lib/error-message';
import { mensagemRotulada, TEXTO_SERVICO_INDISPONIVEL } from '@/lib/fiscal-comum-ui';

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

/** Rótulos da tela para os campos que a validação do servidor aponta. */
export const ROTULOS_CAMPOS: Record<string, string> = {
  estabelecimentoId: 'Estabelecimento',
  operacaoId: 'Operação',
  clienteId: 'Cliente',
  produtoId: 'Produto',
  ncmId: 'Classificação fiscal (NCM)',
  quantidade: 'Quantidade',
  pesoNf: 'Peso informado na nota (kg)',
  valor: 'Valor',
  desconto: 'Desconto',
  competencia: 'Competência',
  enquadramentoId: 'Enquadramento fiscal',
  justificativa: 'Motivo da alteração',
  versao: 'Versão',
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
  if (erro.status >= 500 || erro.status === 0) return TEXTO_SERVICO_INDISPONIVEL;
  return erro.message;
}

const BASE = '/api/erp/fiscal/simulacoes';

function criarErro(status: number, body: unknown): ErroSimulacao {
  const codigo = extrairCodigoErro(body);
  const porCampo = extrairErrosPorCampo(body);
  const fechada = codigo ? MENSAGENS[codigo] : undefined;
  const indisponivel = status >= 500 ? TEXTO_SERVICO_INDISPONIVEL : null;
  const rotulada = status === 400 ? mensagemRotulada(porCampo, ROTULOS_CAMPOS) : null;
  return new ErroSimulacao(fechada || indisponivel || rotulada || extrairMensagemErro(body, 'Falha na operação.'), status, codigo, porCampo);
}

async function enviar(metodo: string, caminho: string, corpo?: unknown): Promise<Response> {
  try {
    return await fetch(caminho, {
      method: metodo,
      cache: 'no-store',
      ...(corpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    });
  } catch {
    throw new ErroSimulacao('Serviço indisponível. Verifique a conexão e tente novamente.', 0, 'SERVICO_INDISPONIVEL', {});
  }
}

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const res = await enviar(metodo, caminho, corpo);
  if (!res.ok) throw criarErro(res.status, await res.json().catch(() => null));
  if (res.status === 204) return undefined as T;
  return (await res.json().catch(() => null)) as T;
}

async function baixar(caminho: string): Promise<Blob> {
  const res = await enviar('GET', caminho);
  if (!res.ok) throw criarErro(res.status, await res.json().catch(() => null));
  return res.blob();
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') p.set(chave, String(valor));
  }
  const texto = p.toString();
  return texto ? `?${texto}` : '';
}

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
  /** Linhagem, versão, situação e competência identificam a versão; não são colunas da grade. */
  codigo: string;
  numeroVersao: number;
  situacao: string;
  competenciaRotulo: string;
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

/** Dados do enquadramento escolhido, para preencher os cinco combos que ele fixa. */
export interface EnquadramentoRef {
  estabelecimentoId: string;
  estabelecimentoNome: string;
  operacaoId: string;
  operacaoRotulo: string;
  clienteId: string;
  clienteNome: string;
  produtoId: string;
  produtoNome: string;
  ncmId: string;
  ncmCodigo: string;
  ncmDescricao: string;
}

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Filtros que valem para a lista, as contagens e a exportação. */
const filtrosDe = (f: FiltrosLista) => ({
  search: f.search,
  estabelecimentoId: f.estabelecimentoId,
  clienteId: f.clienteId,
  produtoId: f.produtoId,
  competencia: f.competencia,
});

export const simulacoesApi = {
  listar: (filtros: FiltrosLista) => chamar<Paginado<LinhaSimulacao>>('GET', `${BASE}${qs({ ...filtros, pageSize: 20 })}`),
  contagens: (filtros: FiltrosLista) => chamar<Contagens>('GET', `${BASE}/contagens${qs(filtrosDe(filtros))}`),
  /** Versões da mesma linhagem (mesmo código), com número da versão, situação e competência. */
  versoesDoCodigo: async (codigo: string) =>
    (await chamar<Paginado<LinhaSimulacao>>('GET', `${BASE}${qs({ codigo, pageSize: 100 })}`)).data,
  obter: (id: string) => chamar<DetalheSimulacao>('GET', `${BASE}/${id}`),
  criar: (corpo: CorpoSimulacao) => chamar<DetalheSimulacao>('POST', BASE, corpo),
  versao: (id: string, corpo: CorpoSimulacao & { versao: number }) => chamar<DetalheSimulacao>('POST', `${BASE}/${id}/versoes`, corpo),
  explicar: (id: string) => chamar<Explicacao>('GET', `${BASE}/${id}/explicacao`),
  historico: (id: string) => chamar<EventoHistorico[]>('GET', `${BASE}/${id}/historico`),
  preCondicoes: (id: string) => chamar<PreCondicao[]>('GET', `${BASE}/${id}/pre-condicoes`),
  comparar: (id: string, com: string) => chamar<{ diferencas: Diferenca[] }>('GET', `${BASE}/${id}/comparar${qs({ com })}`),
  enquadramento: (id: string) => chamar<EnquadramentoRef>('GET', `/api/erp/fiscal/enquadramentos/${encodeURIComponent(id)}`),
  /** CSV da visão atual: mesmos filtros e ordenação da grade. */
  exportar: (filtros: FiltrosLista) => baixar(`${BASE}/exportacao${qs({ ...filtrosDe(filtros), sort: filtros.sort, dir: filtros.dir })}`),
  exportarMemoria: (id: string) => baixar(`${BASE}/${id}/memoria`),
};

/** Texto do item do combo de versões: código, número da versão, situação e competência. */
export function rotuloVersao(linha: Pick<LinhaSimulacao, 'codigo' | 'numeroVersao' | 'situacao' | 'competenciaRotulo'>): string {
  return `${linha.codigo} · versão ${linha.numeroVersao} · ${linha.situacao} · ${linha.competenciaRotulo}`;
}

/** Validação local dos números, com as mesmas regras do servidor. */
export const MSG_DINHEIRO = 'Informe um valor com até duas casas decimais.';
export const MSG_QUANTIDADE = 'Informe uma quantidade maior que zero, com até três casas.';
export const MSG_PESO = 'Informe o peso informado na nota (kg) maior que zero, com até três casas.';

export function validarDinheiro(entrada: string, { exigirPositivo }: { exigirPositivo: boolean }): string | null {
  const canon = normalizarDinheiro(entrada);
  if (canon === null) return MSG_DINHEIRO;
  if (exigirPositivo && !/[1-9]/.test(canon)) return 'Informe um valor maior que zero.';
  return null;
}

export function validarEscala(entrada: string, inteirosMax: number, mensagem: string): string | null {
  const canon = normalizarEscala(entrada, inteirosMax);
  return canon === null || !/[1-9]/.test(canon) ? mensagem : null;
}

/** Compara dois valores em reais pelos centavos inteiros, sem número de ponto flutuante. */
export function descontoMaiorQueValor(desconto: string, valor: string): boolean {
  const d = normalizarDinheiro(desconto);
  const v = normalizarDinheiro(valor);
  if (d === null || v === null) return false;
  return BigInt(d.replace('.', '')) > BigInt(v.replace('.', ''));
}
