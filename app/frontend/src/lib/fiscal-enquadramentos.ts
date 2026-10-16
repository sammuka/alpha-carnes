import { extrairCodigoErro, extrairMensagemErro } from './error-message';

/**
 * Operações fiscais e enquadramentos: rótulos, normalização e cliente HTTP do BFF.
 * Não calcula tributo (a consulta recusa a resolução no backend).
 */

export const ROTULOS_TP_NF = { '0': 'Entrada', '1': 'Saída' } as const;
export const ROTULOS_FIN_NFE = {
  '1': 'Operação normal',
  '2': 'NF-e complementar',
  '3': 'NF-e de ajuste',
  '4': 'Devolução',
} as const;
export const ROTULOS_ABRANGENCIA = {
  INTERNA: 'Dentro do estado',
  INTER: 'Outro estado',
  EXT: 'Exterior',
} as const;
export const ROTULOS_TIPO_PRODUTO = {
  PROPRIA: 'Produção própria',
  REVENDA: 'Revenda',
  SUB: 'Subproduto',
} as const;
export const ROTULOS_SITUACAO_ENQUADRAMENTO = {
  ATIVA: 'Ativa',
  INATIVA: 'Inativa',
} as const;

export const CHAVE_LISTA = 'fiscal.enquadramentos.lista';
export const TEXTO_VAZIO = 'Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.';
export const TEXTO_VAZIO_COMBO = 'Nenhum cadastro disponível para seleção. Consulte a área responsável.';

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  CONFLITO_CONCORRENTE: 'O registro foi alterado por outro usuário. Recarregue para continuar.',
};

/** Remove só a máscara (ponto, hífen e espaço comum); o resto permanece e reprova em `codigoFiscalValido`. */
export function normalizarNcm(valor: string): string {
  return valor.replace(/[. -]/g, '');
}

export function normalizarCfop(valor: string): string {
  return valor.replace(/[. -]/g, '');
}

export function codigoFiscalValido(tipo: 'cfops' | 'ncms', normalizado: string): boolean {
  return (tipo === 'ncms' ? /^[0-9]{8}$/ : /^[0-9]{4}$/).test(normalizado);
}

export function normalizarCest(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 7);
}

export function rotuloData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

const FORMATO_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Instante ISO → `dd/MM/aaaa HH:mm` no fuso America/Sao_Paulo. */
export function rotuloDataHora(iso: string): string {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return iso;
  const p = Object.fromEntries(FORMATO_DATA_HORA.formatToParts(instante).map((parte) => [parte.type, parte.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function rotuloOperacao(rotulo: string, data: string): string {
  return `${rotulo} · ${rotuloData(data)}`;
}

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LinhaEnquadramento {
  id: string;
  codigo: string;
  versao: number;
  operacao: string;
  cfop: string;
  vigenciaInicio: string;
  estabelecimento: string;
  tpNf: string;
  finNfe: string;
  situacao: string;
}

export interface DetalheEnquadramento {
  id: string;
  codigo: string;
  versao: number;
  empresaNome: string;
  estabelecimentoId: string;
  estabelecimentoNome: string;
  operacaoId: string;
  operacaoRotulo: string;
  tpNf: string;
  tipoNota: string;
  finNfe: string;
  finalidade: string;
  cfopId: string;
  cfopCodigo: string;
  cfopDescricao: string;
  abrangencia: string;
  abrangenciaRotulo: string;
  tipoProduto: string;
  tipoProdutoRotulo: string;
  produtoId: string;
  produtoNome: string;
  ncmId: string;
  ncmCodigo: string;
  ncmDescricao: string;
  cest: string;
  clienteId: string;
  clienteNome: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  prioridade: number;
  situacao: string;
  situacaoRotulo: string;
  responsavel: string;
  criadoEm: string;
  atualizadoEm: string;
  origemCodigo: string | null;
}

export interface ContagensEnquadramento {
  total: number;
  ativas: number;
  inativas: number;
}

export interface PreCondicao {
  codigo: string;
  atendida: boolean;
  provisoria: boolean;
}

export interface EventoHistoricoEnquadramento {
  operacao: string;
  situacaoAnterior: string | null;
  situacaoNova: string | null;
  usuarioNome: string;
  criadoEm: string;
  justificativa: string | null;
  resumo: string;
  versao: number | null;
}

export interface OpcaoCombo {
  id: string;
  rotulo: string;
}

export interface ConflitoVigencia {
  codigo: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  prioridade: number;
}

export interface CandidatoConsulta {
  codigo: string;
  prioridade: number;
}

export class ErroEnquadramento extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly codigo: string | null,
    readonly dados: Record<string, unknown>,
  ) {
    super(mensagem);
    this.name = 'ErroEnquadramento';
  }
}

function envelope(body: unknown): Record<string, unknown> {
  if (body == null || typeof body !== 'object') return {};
  const direto = body as Record<string, unknown>;
  if (typeof direto.codigo === 'string') return direto;
  const interno = direto.message;
  if (interno != null && typeof interno === 'object' && !Array.isArray(interno)) return envelope(interno);
  return {};
}

function criarErro(status: number, body: unknown): ErroEnquadramento {
  const codigo = extrairCodigoErro(body);
  const dados = Object.fromEntries(
    Object.entries(envelope(body)).filter(([chave]) => chave !== 'message' && chave !== 'codigo'),
  );
  let mensagem = extrairMensagemErro(body, 'Falha na operação.');
  if (codigo && MENSAGENS_POR_CODIGO[codigo]) mensagem = MENSAGENS_POR_CODIGO[codigo];
  else if (status >= 500) mensagem = 'Serviço indisponível no momento. Tente novamente.';
  return new ErroEnquadramento(mensagem, status, codigo, dados);
}

export function mensagemSobreposicao(erro: ErroEnquadramento): string | null {
  if (erro.codigo !== 'ENQUADRAMENTO_SOBREPOSTO') return null;
  const conflito = erro.dados.conflito as ConflitoVigencia | undefined;
  if (!conflito?.codigo) return erro.message;
  const fim = conflito.vigenciaFim ? rotuloData(conflito.vigenciaFim) : 'em aberto';
  return `Há vigência sobreposta com o código ${conflito.codigo}. Vigência ${rotuloData(conflito.vigenciaInicio)} a ${fim}.`;
}

export function textoConsulta(erro: ErroEnquadramento): string {
  if (erro.codigo === 'EMPATE_ENQUADRAMENTO') {
    const candidatos = Array.isArray(erro.dados.candidatos) ? erro.dados.candidatos as CandidatoConsulta[] : [];
    const codigos = candidatos.map((c) => c.codigo).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    return `${erro.message} Códigos ${codigos.join(', ')}.`;
  }
  if (erro.codigo === 'REGRA_APROVADA_AUSENTE') {
    const localizado = erro.dados.enquadramentoLocalizado as { codigo?: string } | null;
    return localizado?.codigo ? `${erro.message} Enquadramento localizado: ${localizado.codigo}.` : erro.message;
  }
  return erro.message;
}

const BASE = '/api/erp/fiscal';

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(caminho.startsWith('/api/') ? caminho : `${BASE}${caminho}`, {
      method: metodo,
      cache: 'no-store',
      ...(corpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    });
  } catch {
    throw new ErroEnquadramento('Serviço indisponível. Verifique a conexão e tente novamente.', 0, 'SERVICO_INDISPONIVEL', {});
  }
  if (!res.ok) throw criarErro(res.status, await res.json().catch(() => null));
  if (res.status === 204) return undefined as T;
  const tipo = res.headers.get('content-type') ?? '';
  if (tipo.includes('text/csv')) return (await res.blob()) as T;
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

function linhas(body: unknown): Record<string, unknown>[] {
  if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: Record<string, unknown>[] }).data;
  }
  return [];
}

function ativo(linha: Record<string, unknown>): boolean {
  if (linha.deletedAt) return false;
  if (typeof linha.status === 'string' && linha.status !== 'ativo') return false;
  return true;
}

export interface FiltrosLista {
  search: string;
  estabelecimentoId: string;
  cfopId: string;
  produtoId: string;
  clienteId: string;
  sort: string;
  dir: 'asc' | 'desc';
  page: number;
}

export const FILTROS_LISTA: FiltrosLista = {
  search: '',
  estabelecimentoId: '',
  cfopId: '',
  produtoId: '',
  clienteId: '',
  sort: 'operacao',
  dir: 'asc',
  page: 1,
};

export interface CorpoEnquadramento {
  estabelecimentoId: string;
  operacaoId: string;
  tpNf: string;
  finNfe: string;
  cfopId: string;
  abrangencia: string;
  tipoProduto: string;
  produtoId: string;
  ncmId: string;
  cest: string;
  clienteId: string;
  vigenciaInicio: string;
  vigenciaFim?: string;
  prioridade: number;
  justificativa: string;
}

const item = (id: string) => `/enquadramentos/${encodeURIComponent(id)}`;

export const enquadramentosApi = {
  listar: (filtros: FiltrosLista) =>
    chamar<Paginado<LinhaEnquadramento>>('GET', `/enquadramentos${qs({ ...filtros, pageSize: 20 })}`),
  contagens: (filtros: FiltrosLista) =>
    chamar<ContagensEnquadramento>('GET', `/enquadramentos/contagens${qs({
      search: filtros.search,
      estabelecimentoId: filtros.estabelecimentoId,
      cfopId: filtros.cfopId,
      produtoId: filtros.produtoId,
      clienteId: filtros.clienteId,
    })}`),
  obter: (id: string) => chamar<DetalheEnquadramento>('GET', item(id)),
  historico: (id: string) => chamar<EventoHistoricoEnquadramento[]>('GET', `${item(id)}/historico`),
  preCondicoes: (id: string) => chamar<PreCondicao[]>('GET', `${item(id)}/pre-condicoes`),
  criar: (corpo: CorpoEnquadramento) => chamar<DetalheEnquadramento>('POST', '/enquadramentos', corpo),
  atualizar: (id: string, corpo: Omit<CorpoEnquadramento, 'estabelecimentoId'> & { versao: number }) =>
    chamar<DetalheEnquadramento>('PATCH', item(id), corpo),
  consultar: (corpo: Record<string, string>) => chamar<never>('POST', '/enquadramentos/consulta', corpo),
  duplicar: (id: string, corpo: { vigenciaInicio: string; vigenciaFim?: string; prioridade?: number; versao: number; justificativa: string }) =>
    chamar<DetalheEnquadramento>('POST', `${item(id)}/duplicar`, corpo),
  inativar: (id: string, corpo: { versao: number; justificativa: string }) =>
    chamar<DetalheEnquadramento>('POST', `${item(id)}/inativar`, corpo),
  reativar: (id: string, corpo: { versao: number; justificativa: string }) =>
    chamar<DetalheEnquadramento>('POST', `${item(id)}/reativar`, corpo),
  remover: (id: string, justificativa: string) =>
    chamar<{ codigo: string }>('DELETE', item(id), { justificativa }),
  criarCodigo: (tipo: 'cfops' | 'ncms', corpo: { codigo: string; descricao: string; justificativa: string }) =>
    chamar<{ id: string; codigo: string; descricao: string }>('POST', `/${tipo}`, {
      ...corpo,
      codigo: tipo === 'ncms' ? normalizarNcm(corpo.codigo) : corpo.codigo,
    }),
  exportar: async (filtros: FiltrosLista) => {
    const res = await fetch(`${BASE}/enquadramentos/exportacao${qs({
      search: filtros.search,
      estabelecimentoId: filtros.estabelecimentoId,
      cfopId: filtros.cfopId,
      produtoId: filtros.produtoId,
      clienteId: filtros.clienteId,
    })}`, { cache: 'no-store' });
    if (!res.ok) throw criarErro(res.status, await res.json().catch(() => null));
    return res.blob();
  },
  opcoesEstabelecimento: async (): Promise<OpcaoCombo[]> => {
    const body = await chamar<unknown>('GET', '/estabelecimentos?situacao=APPROVED&pageSize=100');
    return linhas(body)
      .filter((l) => l.situacao === 'APPROVED' || l.situacao === undefined)
      .map((l) => ({ id: String(l.id), rotulo: String(l.nome ?? '') }));
  },
  opcoesOperacao: async (): Promise<OpcaoCombo[]> => {
    const body = await chamar<unknown>('GET', '/api/operacoes?limite=100');
    return linhas(body).map((l) => ({
      id: String(l.id),
      rotulo: rotuloOperacao(String(l.rotulo ?? ''), String(l.data ?? '')),
    }));
  },
};

export type TipoBusca = 'produtos' | 'clientes' | 'cfops' | 'ncms';

export interface ResultadoBusca {
  opcoes: OpcaoCombo[];
  /** Total de cadastros que casam com a busca no servidor. */
  total: number;
  /** `true` quando há mais resultados do que os exibidos. */
  truncado: boolean;
}

export const TAMANHO_BUSCA = 50;
export const AVISO_REFINAR = 'Há mais resultados do que os exibidos. Refine a busca.';

const ROTA_BUSCA: Record<TipoBusca, string> = {
  produtos: '/api/cadastros/produtos',
  clientes: '/api/cadastros/clientes',
  cfops: '/cfops',
  ncms: '/ncms',
};

/** Busca no servidor (parâmetro `search` dos cadastros) para os combos de produto, cliente, CFOP e NCM. */
export async function buscarOpcoes(tipo: TipoBusca, termo: string): Promise<ResultadoBusca> {
  const comStatus = tipo === 'produtos' || tipo === 'clientes';
  const body = await chamar<unknown>('GET', `${ROTA_BUSCA[tipo]}${qs({
    page: 1,
    pageSize: TAMANHO_BUSCA,
    status: comStatus ? 'ativo' : undefined,
    search: termo.trim(),
  })}`);
  const bruto = linhas(body);
  const opcoes = bruto.filter(ativo).map((l): OpcaoCombo => {
    if (tipo === 'produtos') return { id: String(l.id), rotulo: String(l.nome ?? '') };
    if (tipo === 'clientes') {
      return { id: String(l.id), rotulo: String((typeof l.nomeFantasia === 'string' && l.nomeFantasia.trim()) || l.razaoSocial || '') };
    }
    return { id: String(l.id), rotulo: `${String(l.codigo ?? '')} ${String(l.descricao ?? '')}`.trim() };
  });
  const total = typeof (body as { total?: unknown } | null)?.total === 'number' ? (body as { total: number }).total : bruto.length;
  return { opcoes, total, truncado: total > bruto.length };
}
