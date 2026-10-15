import { extrairCodigoErro, extrairErrosPorCampo, extrairMensagemErro } from './error-message';

/**
 * Cadastro fiscal de empresas, estabelecimentos e regime tributário: tipos, rótulos, máscaras
 * e cliente HTTP do BFF `/api/erp/fiscal`. Regras de negócio ficam no backend (RA-01); aqui só
 * apresentação e transporte. Nenhum identificador técnico é exibido ao usuário.
 */

// ── Domínios ────────────────────────────────────────────────────────────────

export type SituacaoEstabelecimento = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
/** Regime e alteração usam os quatro primeiros estados. */
export type SituacaoDecisao = Exclude<SituacaoEstabelecimento, 'SUSPENDED'>;
export type CodigoCrt = '1' | '2' | '3' | '4';
export type TipoCnae = 'PRINCIPAL' | 'SECUNDARIA';

export const ROTULOS_CRT: Record<CodigoCrt, string> = {
  '1': 'Simples Nacional',
  '2': 'Simples Nacional — sublimite',
  '3': 'Regime normal',
  '4': 'MEI',
};

export const ROTULOS_SITUACAO: Record<SituacaoEstabelecimento, string> = {
  DRAFT: 'Rascunho',
  REVIEW: 'Aguardando revisão',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  SUSPENDED: 'Suspenso',
};

export const ROTULOS_TIPO_CNAE: Record<TipoCnae, string> = {
  PRINCIPAL: 'Principal',
  SECUNDARIA: 'Secundária',
};

export const ROTULOS_OBJETO_HISTORICO: Record<string, string> = {
  empresa: 'Empresa',
  estabelecimento: 'Estabelecimento',
  cnae: 'Atividade econômica',
  alteracao: 'Alteração',
  regime: 'Regime tributário',
};

/** Rótulo por operação de auditoria; `ACAO_MANUAL` depende da nova situação (ver `rotuloAcaoHistorico`). */
export const ROTULOS_ACAO_HISTORICO: Record<string, string> = {
  INSERT: 'Cadastro criado',
  UPDATE: 'Dados alterados',
  DELETE: 'Cadastro removido',
  ACAO_MANUAL: 'Situação alterada',
};

const ROTULOS_ACAO_POR_SITUACAO: Record<string, string> = {
  REVIEW: 'Enviado para revisão',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  SUSPENDED: 'Suspenso',
};

export interface EventoHistorico {
  objeto: string;
  operacao: string;
  situacaoAnterior: string | null;
  situacaoNova: string | null;
  usuarioNome: string;
  criadoEm: string;
  justificativa: string | null;
  resumo: string;
}

export function rotuloAcaoHistorico(evento: Pick<EventoHistorico, 'operacao' | 'situacaoAnterior' | 'situacaoNova'>): string {
  if (evento.operacao === 'ACAO_MANUAL' && evento.situacaoNova) {
    if (evento.situacaoAnterior === 'SUSPENDED' && evento.situacaoNova === 'REVIEW') return 'Reativado para revisão';
    return ROTULOS_ACAO_POR_SITUACAO[evento.situacaoNova] ?? ROTULOS_ACAO_HISTORICO.ACAO_MANUAL!;
  }
  return ROTULOS_ACAO_HISTORICO[evento.operacao] ?? 'Cadastro alterado';
}

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Empresa {
  id: string;
  razaoSocial: string;
  cnpjRaiz: string;
  versao: number;
}

export interface CnaeItem {
  codigo: string;
  descricao: string;
  tipo: TipoCnae;
}

export interface RegimeVigente {
  crt: CodigoCrt;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

export interface EstabelecimentoLinha {
  id: string;
  empresaId: string;
  nome: string;
  cnpj: string;
  uf: string;
  situacao: SituacaoEstabelecimento;
  versao: number;
  empresa: { razaoSocial: string };
  regime: RegimeVigente | null;
}

export interface RegimeVersao extends RegimeVigente {
  id: string;
  situacao: SituacaoDecisao;
  versao: number;
}

export interface AlteracaoAberta {
  id: string;
  nome: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  uf: string;
  situacao: SituacaoDecisao;
  versao: number;
  versaoBase: number;
  cnaes: CnaeItem[];
}

export interface EstabelecimentoDetalhe {
  id: string;
  empresaId: string;
  nome: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  uf: string;
  municipioIbgeCodigo: string | null;
  situacao: SituacaoEstabelecimento;
  versao: number;
  justificativaSituacao: string | null;
  empresa: { id: string; razaoSocial: string; cnpjRaiz: string } | null;
  cnaes: CnaeItem[];
  regimes: RegimeVersao[];
  alteracaoAberta: AlteracaoAberta | null;
  responsavel: { nome: string };
}

export interface PreCondicao {
  codigo: string;
  atendida: boolean;
  provisoria: boolean;
}

export interface Contagens {
  total: number;
  emRevisao: number;
  suspensos: number;
}

export type OrdenacaoGrade = 'estabelecimento' | 'cnpj' | 'regime' | 'uf' | 'empresa';

export interface FiltrosGrade {
  empresaId: string;
  estabelecimentoId: string;
  situacao: SituacaoEstabelecimento | '';
  search: string;
  sort: OrdenacaoGrade;
  dir: 'asc' | 'desc';
  page: number;
}

export const FILTROS_PADRAO: FiltrosGrade = {
  empresaId: '',
  estabelecimentoId: '',
  situacao: '',
  search: '',
  sort: 'estabelecimento',
  dir: 'asc',
  page: 1,
};

export const TAMANHO_PAGINA = 20;

// ── Máscaras e formatação ───────────────────────────────────────────────────

/** CNPJ alfanumérico: letras e dígitos em maiúsculas, 14 posições, sem pontuação. */
export function normalizarCnpj(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14);
}

/** Máscara `AA.AAA.AAA/AAAA-DD` conforme digita; os dois dígitos verificadores são numéricos. */
export function mascararCnpjAlfanumerico(valor: string): string {
  const base = normalizarCnpj(valor);
  const c = base.slice(0, 12) + base.slice(12).replace(/\D/g, '');
  let saida = c.slice(0, 2);
  if (c.length > 2) saida += `.${c.slice(2, 5)}`;
  if (c.length > 5) saida += `.${c.slice(5, 8)}`;
  if (c.length > 8) saida += `/${c.slice(8, 12)}`;
  if (c.length > 12) saida += `-${c.slice(12, 14)}`;
  return saida;
}

/** CNAE guardado só com os 7 dígitos. */
export function normalizarCnae(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 7);
}

/** Máscara `0000-0/00` conforme digita. */
export function mascararCnae(valor: string): string {
  const d = normalizarCnae(valor);
  let saida = d.slice(0, 4);
  if (d.length > 4) saida += `-${d.slice(4, 5)}`;
  if (d.length > 5) saida += `/${d.slice(5, 7)}`;
  return saida;
}

/** `2026-10-13` → `13/10/2026`; vazio vira travessão. */
export function formatarDataIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '—';
}

/** Timestamp ISO → `13/10/2026 14:30` no fuso do navegador. */
export function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function rotuloRegime(regime: RegimeVigente | null | undefined): string {
  return regime ? (ROTULOS_CRT[regime.crt] ?? '—') : '—';
}

// ── Erros ───────────────────────────────────────────────────────────────────

/** Mensagens fixas do contrato visível, independentes do texto devolvido pelo backend. */
const MENSAGENS_POR_CODIGO: Record<string, string> = {
  SEGREGACAO_FUNCAO: 'A aprovação deve ser feita por usuário diferente de quem submeteu.',
  ALTERACAO_DESATUALIZADA: 'O cadastro mudou depois desta proposta. Descarte o rascunho ou rejeite a revisão e crie uma nova.',
  CONFLITO_CONCORRENTE: 'O registro foi alterado por outro usuário. Recarregue para continuar.',
};

export class ErroFiscal extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly codigo: string | null,
    readonly dados: Record<string, unknown>,
    readonly porCampo: Record<string, string>,
  ) {
    super(mensagem);
    this.name = 'ErroFiscal';
  }
}

/** Corpo `{ message, codigo, ...dados }`, direto ou dentro do envelope do filtro de exceções. */
function localizarEnvelope(body: unknown): Record<string, unknown> {
  if (body == null || typeof body !== 'object') return {};
  const direto = body as Record<string, unknown>;
  if (typeof direto.codigo === 'string') return direto;
  const interno = direto.message;
  if (interno != null && typeof interno === 'object' && !Array.isArray(interno)) {
    return localizarEnvelope(interno);
  }
  return {};
}

function criarErro(status: number, body: unknown): ErroFiscal {
  const codigo = extrairCodigoErro(body);
  const dados = Object.fromEntries(
    Object.entries(localizarEnvelope(body)).filter(([chave]) => chave !== 'message' && chave !== 'codigo'),
  );
  let mensagem = extrairMensagemErro(body, 'Falha na operação.');
  if (codigo && MENSAGENS_POR_CODIGO[codigo]) mensagem = MENSAGENS_POR_CODIGO[codigo];
  else if (status === 403) mensagem = 'Você não tem permissão para esta ação.';
  else if (status >= 500) mensagem = 'Serviço indisponível no momento. Tente novamente.';
  return new ErroFiscal(mensagem, status, codigo, dados, extrairErrosPorCampo(body));
}

export function ehConflitoConcorrente(erro: unknown): boolean {
  return erro instanceof ErroFiscal && erro.codigo === 'CONFLITO_CONCORRENTE';
}

export function mensagemDoErroFiscal(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Falha na operação.';
}

// ── Cliente HTTP do BFF ─────────────────────────────────────────────────────

const BASE = '/api/erp/fiscal';

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      cache: 'no-store',
      ...(corpo === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    });
  } catch {
    throw new ErroFiscal('Serviço indisponível. Verifique a conexão e tente novamente.', 0, 'SERVICO_INDISPONIVEL', {}, {});
  }
  if (!res.ok) throw criarErro(res.status, await res.json().catch(() => null));
  return (await res.json().catch(() => null)) as T;
}

function consulta(filtros: Partial<FiltrosGrade> & { pageSize?: number }): string {
  const p = new URLSearchParams();
  if (filtros.empresaId) p.set('empresaId', filtros.empresaId);
  if (filtros.estabelecimentoId) p.set('estabelecimentoId', filtros.estabelecimentoId);
  if (filtros.situacao) p.set('situacao', filtros.situacao);
  if (filtros.search?.trim()) p.set('search', filtros.search.trim());
  if (filtros.sort) p.set('sort', filtros.sort);
  if (filtros.dir) p.set('dir', filtros.dir);
  if (filtros.page) p.set('page', String(filtros.page));
  if (filtros.pageSize) p.set('pageSize', String(filtros.pageSize));
  const texto = p.toString();
  return texto ? `?${texto}` : '';
}

export interface Decisao {
  versao: number;
  justificativa: string;
}

export interface DadosFiscais {
  nome: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  uf: string;
}

export interface CorpoRegime {
  crt: CodigoCrt;
  vigenciaInicio: string;
  vigenciaFim?: string;
  justificativa: string;
}

const est = (id: string) => `/estabelecimentos/${encodeURIComponent(id)}`;

export const fiscalApi = {
  listarEmpresas: (search: string, page = 1, pageSize = 100) =>
    chamar<Paginado<Empresa>>('GET', `/empresas${consulta({ search, page, pageSize })}`),
  criarEmpresa: (corpo: { razaoSocial: string; cnpjRaiz: string; justificativa: string }) =>
    chamar<Empresa>('POST', '/empresas', corpo),
  atualizarEmpresa: (id: string, corpo: { razaoSocial: string } & Decisao) =>
    chamar<Empresa>('PATCH', `/empresas/${encodeURIComponent(id)}`, corpo),
  removerEmpresa: (id: string, justificativa: string) =>
    chamar<{ id: string }>('DELETE', `/empresas/${encodeURIComponent(id)}`, { justificativa }),

  listarEstabelecimentos: (filtros: FiltrosGrade, pageSize = TAMANHO_PAGINA) =>
    chamar<Paginado<EstabelecimentoLinha>>('GET', `/estabelecimentos${consulta({ ...filtros, pageSize })}`),
  contagens: (filtros: FiltrosGrade) =>
    chamar<Contagens>('GET', `/estabelecimentos/contagens${consulta({ ...filtros, sort: undefined, dir: undefined, page: undefined })}`),
  obter: (id: string) => chamar<EstabelecimentoDetalhe>('GET', est(id)),
  historico: (id: string) => chamar<EventoHistorico[]>('GET', `${est(id)}/historico`),
  preCondicoes: (id: string) => chamar<PreCondicao[]>('GET', `${est(id)}/pre-condicoes`),

  criarEstabelecimento: (corpo: DadosFiscais & { empresaId: string; cnpj: string; cnaes?: CnaeItem[]; justificativa: string }) =>
    chamar<EstabelecimentoDetalhe>('POST', '/estabelecimentos', corpo),
  atualizarEstabelecimento: (id: string, corpo: Partial<DadosFiscais> & Decisao) =>
    chamar<EstabelecimentoDetalhe>('PATCH', est(id), corpo),
  substituirCnaes: (id: string, corpo: { cnaes: CnaeItem[] } & Decisao) =>
    chamar<EstabelecimentoDetalhe>('PUT', `${est(id)}/cnaes`, corpo),
  acaoEstabelecimento: (id: string, acao: 'submeter' | 'aprovar' | 'rejeitar' | 'suspender' | 'reativar', corpo: Decisao) =>
    chamar<EstabelecimentoDetalhe>('POST', `${est(id)}/${acao}`, corpo),
  removerEstabelecimento: (id: string, justificativa: string) =>
    chamar<{ id: string }>('DELETE', est(id), { justificativa }),

  criarAlteracao: (id: string, corpo: DadosFiscais & { cnaes: CnaeItem[] } & Decisao) =>
    chamar<AlteracaoAberta>('POST', `${est(id)}/alteracoes`, corpo),
  atualizarAlteracao: (id: string, altId: string, corpo: Partial<DadosFiscais> & { cnaes?: CnaeItem[] } & Decisao) =>
    chamar<AlteracaoAberta>('PATCH', `${est(id)}/alteracoes/${encodeURIComponent(altId)}`, corpo),
  acaoAlteracao: (id: string, altId: string, acao: 'submeter' | 'aprovar' | 'rejeitar', corpo: Decisao) =>
    chamar<AlteracaoAberta>('POST', `${est(id)}/alteracoes/${encodeURIComponent(altId)}/${acao}`, corpo),
  descartarAlteracao: (id: string, altId: string, justificativa: string) =>
    chamar<{ id: string }>('DELETE', `${est(id)}/alteracoes/${encodeURIComponent(altId)}`, { justificativa }),

  criarRegime: (id: string, corpo: CorpoRegime) => chamar<RegimeVersao>('POST', `${est(id)}/regimes`, corpo),
  atualizarRegime: (id: string, regimeId: string, corpo: Partial<CorpoRegime> & Decisao) =>
    chamar<RegimeVersao>('PATCH', `${est(id)}/regimes/${encodeURIComponent(regimeId)}`, corpo),
  acaoRegime: (
    id: string,
    regimeId: string,
    acao: 'submeter' | 'aprovar' | 'rejeitar',
    corpo: Decisao & { confirmarTroca?: boolean },
  ) => chamar<RegimeVersao>('POST', `${est(id)}/regimes/${encodeURIComponent(regimeId)}/${acao}`, corpo),
  removerRegime: (id: string, regimeId: string, justificativa: string) =>
    chamar<{ id: string }>('DELETE', `${est(id)}/regimes/${encodeURIComponent(regimeId)}`, { justificativa }),

  /** CSV da visão atual (rótulos, `;`, BOM, sem identificadores) — devolve o arquivo para download. */
  async exportar(filtros: FiltrosGrade): Promise<Blob> {
    let res: Response;
    try {
      res = await fetch(`${BASE}/estabelecimentos/exportacao${consulta({ ...filtros, page: undefined, sort: undefined, dir: undefined })}`, {
        cache: 'no-store',
      });
    } catch {
      throw new ErroFiscal('Serviço indisponível. Verifique a conexão e tente novamente.', 0, 'SERVICO_INDISPONIVEL', {}, {});
    }
    if (!res.ok) throw criarErro(res.status, await res.json().catch(() => null));
    return res.blob();
  },
};
