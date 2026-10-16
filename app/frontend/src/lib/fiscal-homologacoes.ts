import { extrairCodigoErro, extrairErrosPorCampo, extrairMensagemErro } from '@/lib/error-message';
import { buscarCatalogo, mensagemRotulada, TEXTO_SERVICO_INDISPONIVEL } from '@/lib/fiscal-comum-ui';

export const TEXTO_VAZIO = 'Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.';
export const CHAVE_LISTA = 'fiscal.homologacoes.lista';
/** Texto de DUPLA_APROVACAO (plano T05, seção 7). */
export const TEXTO_DUPLA = 'Um aprovador diferente de quem submeteu a regra registra a decisão. O quórum numérico permanece provisório.';
/** Regra do catálogo da tela (catalogo.js L250). */
export const TEXTO_REGRAS = 'aprovador diferente do autor; cenários de regressão obrigatórios';
/** Exceção do catálogo da tela (catalogo.js L251) e o esclarecimento do plano (D21). */
export const TEXTO_EXCECAO = 'Atualização normativa em meio à operação';
export const TEXTO_EXCECAO_CORPO = 'Esta tela não bloqueia a publicação por atualização normativa, porque o protótipo não traz código de erro.';
/** Responsável pela aprovação ainda não definido. */
export const TEXTO_PENDENTE = 'Pendente';

export const SITUACOES = [
  ['EM_REVISAO', 'Em revisão'],
  ['APROVADA', 'Aprovada'],
  ['REJEITADA', 'Rejeitada'],
  ['PUBLICADA', 'Publicada'],
] as const;

const MENSAGENS: Record<string, string> = {
  SEGREGACAO_FUNCAO: 'A aprovação deve ser feita por usuário diferente de quem submeteu.',
  CENARIO_REGRESSAO_AUSENTE: 'A publicação exige ao menos um cenário de regressão.',
  CENARIO_REGRA_DIVERGENTE: 'O cenário de regressão precisa ser uma memória calculada desta versão da regra.',
  CONFLITO_CONCORRENTE: 'O registro foi alterado por outro usuário. Recarregue para continuar.',
  TRANSICAO_INVALIDA: 'Ação não permitida na situação atual.',
  HOMOLOGACAO_ABERTA: 'Já existe homologação em aberto ou publicada para esta versão.',
  REGRA_NAO_APROVADA: 'A homologação exige uma versão de regra já aprovada.',
};

/** Rótulos da tela para os campos que a validação do servidor aponta. */
export const ROTULOS_CAMPOS: Record<string, string> = {
  regraId: 'Enquadramento fiscal',
  descricao: 'Descrição',
  justificativa: 'Justificativa auditável',
  simulacaoId: 'Memória calculada',
  versao: 'Versão',
};

export class ErroHomologacao extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly codigo: string | null,
    readonly porCampo: Record<string, string>,
  ) {
    super(mensagem);
    this.name = 'ErroHomologacao';
  }
}

/** Falha de uma ação do processo, já com o texto da tela; `conflito` é 409 (o diálogo oferece recarregar) e `removido` é 404. */
export class ErroAcaoHomologacao extends Error {
  constructor(mensagem: string, readonly conflito: boolean, readonly removido = false) {
    super(mensagem);
    this.name = 'ErroAcaoHomologacao';
  }
}

export function mensagemDeHomologacao(erro: ErroHomologacao): string {
  const fechada = erro.codigo ? MENSAGENS[erro.codigo] : undefined;
  if (fechada) return fechada;
  if (erro.status >= 500 || erro.status === 0) return TEXTO_SERVICO_INDISPONIVEL;
  return erro.message;
}

const BASE = '/api/erp/fiscal/homologacoes';

function criarErro(status: number, body: unknown): ErroHomologacao {
  const codigo = extrairCodigoErro(body);
  const porCampo = extrairErrosPorCampo(body);
  const fechada = codigo ? MENSAGENS[codigo] : undefined;
  const indisponivel = status >= 500 ? TEXTO_SERVICO_INDISPONIVEL : null;
  const rotulada = status === 400 ? mensagemRotulada(porCampo, ROTULOS_CAMPOS) : null;
  return new ErroHomologacao(fechada || indisponivel || rotulada || extrairMensagemErro(body, 'Falha na operação.'), status, codigo, porCampo);
}

async function enviar(metodo: string, caminho: string, corpo?: unknown): Promise<Response> {
  try {
    return await fetch(caminho, {
      method: metodo,
      cache: 'no-store',
      ...(corpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    });
  } catch {
    throw new ErroHomologacao('Serviço indisponível. Verifique a conexão e tente novamente.', 0, 'SERVICO_INDISPONIVEL', {});
  }
}

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const res = await enviar(metodo, caminho, corpo);
  if (!res.ok) throw criarErro(res.status, await res.json().catch(() => null));
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

export interface FiltrosLista {
  search: string;
  situacao: string;
  sort: string;
  dir: 'asc' | 'desc';
  page: number;
}

export const FILTROS_LISTA: FiltrosLista = {
  search: '',
  situacao: '',
  sort: 'enquadramento',
  dir: 'asc',
  page: 1,
};

export interface LinhaHomologacao {
  id: string;
  enquadramento: string;
  vigenciaInicio: string;
  situacao: string;
  usuario: string;
  aprovador: string;
  descricao: string;
}

export interface CenarioVinculo {
  codigo: string;
  numeroVersao: number;
  competenciaRotulo: string;
}

export interface DetalheHomologacao extends LinhaHomologacao {
  regraId: string;
  codigo: string;
  versao: number;
  numeroVersao: number;
  vigenciaFim: string | null;
  empresa: string;
  responsavel?: string;
  criadoEm: string;
  atualizadoEm: string;
  cenarios: CenarioVinculo[];
}

export interface Diferenca {
  campo: string;
  antes: string | null;
  depois: string;
}

export interface DiffHomologacao {
  codigo: string;
  numeroVersaoAntes: number | null;
  numeroVersaoDepois: number;
  diferencas: Diferenca[];
}

export interface EventoHistorico {
  operacao: string;
  situacaoAnterior: string | null;
  situacaoNova: string | null;
  usuarioNome: string | null;
  criadoEm: string;
  justificativa: string | null;
  resumo: string | null;
  versao: number | null;
}

export interface PreCondicao {
  codigo: string;
  atendida: boolean;
  provisoria: boolean;
  texto?: string;
}

export interface Contagens {
  total: number;
  emRevisao: number;
  aprovadas: number;
  rejeitadas: number;
  publicadas: number;
}

export interface Pagina<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Autor e vigência da versão de regra escolhida, mostrados em leitura no drawer. */
export interface RegraEscolhida {
  autor: string | null;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

export interface CorpoAbertura {
  regraId: string;
  descricao: string;
  justificativa: string;
}

export interface CorpoDecisao {
  versao: number;
  justificativa: string;
}

/** Filtros que valem para a lista e a exportação; as contagens só levam a busca. */
const filtrosDe = (f: FiltrosLista) => ({ search: f.search, situacao: f.situacao });

function listaDe<T>(bruto: T[] | { data?: T[] } | null): T[] {
  if (Array.isArray(bruto)) return bruto;
  return bruto?.data ?? [];
}

export const homologacoesApi = {
  listar: (filtros: FiltrosLista) => chamar<Pagina<LinhaHomologacao>>('GET', `${BASE}${qs({ ...filtrosDe(filtros), sort: filtros.sort, dir: filtros.dir, page: filtros.page, pageSize: 20 })}`),
  contagens: (filtros: FiltrosLista) => chamar<Contagens>('GET', `${BASE}/contagens${qs({ search: filtros.search })}`),
  obter: (id: string) => chamar<DetalheHomologacao>('GET', `${BASE}/${id}`),
  diff: (id: string) => chamar<DiffHomologacao>('GET', `${BASE}/${id}/diff`),
  historico: async (id: string) => listaDe(await chamar<EventoHistorico[] | { data?: EventoHistorico[] }>('GET', `${BASE}/${id}/historico`)),
  preCondicoes: async (id: string) => listaDe(await chamar<PreCondicao[] | { data?: PreCondicao[] }>('GET', `${BASE}/${id}/pre-condicoes`)),
  criar: (corpo: CorpoAbertura) => chamar<DetalheHomologacao>('POST', BASE, corpo),
  aprovar: (id: string, corpo: CorpoDecisao) => chamar<DetalheHomologacao>('POST', `${BASE}/${id}/aprovar`, corpo),
  rejeitar: (id: string, corpo: CorpoDecisao) => chamar<DetalheHomologacao>('POST', `${BASE}/${id}/rejeitar`, corpo),
  publicar: (id: string, corpo: CorpoDecisao) => chamar<DetalheHomologacao>('POST', `${BASE}/${id}/publicar`, corpo),
  vincular: (id: string, corpo: { simulacaoId: string; versao: number; justificativa: string }) =>
    chamar<DetalheHomologacao>('POST', `${BASE}/${id}/cenarios`, corpo),
  regra: (id: string) => chamar<RegraEscolhida>('GET', `/api/erp/fiscal/regras/${encodeURIComponent(id)}`),
  /** CSV da visão atual: mesmos filtros e ordenação da grade. */
  exportar: async (filtros: FiltrosLista) => {
    const res = await enviar('GET', `${BASE}/exportacao${qs({ ...filtrosDe(filtros), sort: filtros.sort, dir: filtros.dir })}`);
    if (!res.ok) throw criarErro(res.status, await res.json().catch(() => null));
    return res.blob();
  },
};

const texto = (valor: unknown) => String(valor ?? '');

/** Versões de regra já aprovadas, filtradas no servidor: "enquadramento · versão N". */
export const buscarRegrasAprovadas = (termo: string) =>
  buscarCatalogo(
    '/api/erp/fiscal/regras',
    termo,
    (l) => ({ id: texto(l.id), rotulo: `${texto(l.enquadramentoFiscal)} · versão ${texto(l.numeroVersao)}` }),
    { situacao: 'APROVADA' },
  );

/** Memórias calculadas desta versão da regra, filtradas no servidor: "código · versão N · competência". */
export const buscarMemoriasDaRegra = (regraId: string, termo: string) =>
  buscarCatalogo(
    '/api/erp/fiscal/simulacoes',
    termo,
    (l) => ({ id: texto(l.id), rotulo: `${texto(l.codigo)} · versão ${texto(l.numeroVersao)} · ${texto(l.competenciaRotulo)}` }),
    { regraId },
  );
