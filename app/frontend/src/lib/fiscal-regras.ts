import { extrairCodigoErro, extrairErrosPorCampo, extrairMensagemErro } from './error-message';
import { buscarCatalogo, mensagemRotulada, TEXTO_SERVICO_INDISPONIVEL } from './fiscal-comum-ui';

const ENTRADA = /^\d{1,3}(\.\d{1,2})?$/;

/** Aceita "41,67", "12.00" ou "100". Devolve a razão "0.4167", "0.1200" ou "1.0000", ou null. Sem parseFloat. */
export function normalizarPercentual(entrada: string): string | null {
  const limpo = entrada.trim().replace('%', '').replace(/\s/g, '').replace(',', '.');
  if (!ENTRADA.test(limpo)) return null;
  const [inteiroBruto = '', frac = ''] = limpo.split('.');
  if (inteiroBruto.length > 1 && inteiroBruto.startsWith('0')) return null;
  if (frac.length > 2) return null;
  const frac2 = (frac + '00').slice(0, 2);
  if (inteiroBruto.length === 3 && inteiroBruto !== '100') return null;
  if (inteiroBruto === '100' && frac2 !== '00') return null;
  const digitos = `${inteiroBruto}${frac2}`.replace(/^0+/, '') || '0';
  const quatro = digitos.padStart(4, '0');
  if (quatro.length > 5) return null;
  const inteiroRazao = quatro.length === 5 ? quatro[0] : '0';
  const fracRazao = quatro.slice(-4);
  if (inteiroRazao !== '0' && inteiroRazao !== '1') return null;
  if (inteiroRazao === '1' && fracRazao !== '0000') return null;
  return `${inteiroRazao}.${fracRazao}`;
}

/** "0.4167" → "41,67". Não usa Number. O prefixo % fica no campo, não nesta string. */
export function formatarPercentualPtBr(canon: string): string {
  const [inteiro = '', frac = ''] = canon.split('.');
  const frac4 = (frac + '0000').slice(0, 4);
  const junto = `${inteiro}${frac4}`;
  const inteiroPct = junto.slice(0, junto.length - 2).replace(/^0+(?=\d)/, '') || '0';
  const fracPct = junto.slice(-2);
  return `${inteiroPct},${fracPct}`;
}

export const ROTULOS_ICMS = {
  '00': 'Tributação integral',
  '20': 'Redução de base',
  '40': 'Isenção',
  '41': 'Não tributada',
  '51': 'Diferimento',
} as const;

export const ROTULOS_IPI = {
  '51': 'Saída tributada à alíquota zero',
  '53': 'Saída não tributada',
  '99': 'Outras saídas',
} as const;

export const ROTULOS_PIS = {
  '01': 'Tributação normal',
  '06': 'Alíquota zero',
  '08': 'Sem incidência',
  '99': 'Outras operações',
} as const;

export const ROTULOS_IBS = {
  '000': 'Tributação integral',
  '200': 'Alíquota reduzida',
} as const;

export const ROTULOS_SITUACAO = {
  RASCUNHO: 'Rascunho',
  SUBMETIDA: 'Submetida',
  APROVADA: 'Aprovada',
  APOSENTADA: 'Aposentada',
} as const;

export const TEXTO_VAZIO = 'Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.';
export const TEXTO_VAZIO_COMBO = 'Nenhum cadastro disponível para seleção. Consulte a área responsável.';
export const CHAVE_LISTA = 'fiscal.regras.lista';

const MENSAGENS: Record<string, string> = {
  VERSAO_IMUTAVEL: 'Versão aprovada ou aposentada não pode ser alterada. Inclua uma versão nova.',
  VIGENCIA_AMBIGUA: 'Já existe versão aprovada deste enquadramento com vigência sobreposta. Nenhuma foi escolhida.',
  SEGREGACAO_FUNCAO: 'A aprovação deve ser feita por usuário diferente de quem submeteu.',
  CONFLITO_CONCORRENTE: 'O registro foi alterado por outro usuário. Recarregue para continuar.',
  ENQUADRAMENTO_DIVERGENTE: 'A operação e a operação fiscal (CFOP) precisam ser as do enquadramento selecionado.',
  BENEFICIO_NAO_ELEGIVEL: 'O benefício fiscal selecionado não está ativo.',
  CLASSIFICACAO_NAO_ATIVA: 'A classificação IBS/CBS selecionada não está ativa.',
  ENQUADRAMENTO_INDISPONIVEL: 'O enquadramento fiscal não está ativo.',
  VERSAO_ABERTA: 'Já existe versão em rascunho ou submetida para este código.',
  LINHAGEM_ENQUADRAMENTO_FIXO: 'A versão nova permanece no mesmo enquadramento fiscal.',
  REGRAS_DISTINTAS: 'A comparação exige duas versões do mesmo código.',
};

/** Rótulos da tela para os campos que a validação do servidor aponta. */
export const ROTULOS_CAMPOS: Record<string, string> = {
  enquadramentoId: 'Enquadramento fiscal',
  operacaoId: 'Operação',
  cfopId: 'Operação fiscal (CFOP)',
  icmsCst: 'Tratamento ICMS',
  pRedBc: 'Redução de base do ICMS (%)',
  pIcms: 'Alíquota (%)',
  beneficioFiscalId: 'Benefício fiscal',
  ipiCst: 'Tratamento IPI',
  pisCst: 'Tratamento PIS/COFINS',
  ibsCst: 'Tratamento IBS/CBS',
  classificacaoIbsCbsId: 'Classificação IBS/CBS',
  vigenciaInicio: 'Início de vigência',
  vigenciaFim: 'Fim de vigência',
  justificativa: 'Justificativa auditável',
  versao: 'Versão',
  codigo: 'Código',
  descricao: 'Descrição',
};

export class ErroRegra extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly codigo: string | null,
    readonly porCampo: Record<string, string>,
  ) {
    super(mensagem);
    this.name = 'ErroRegra';
  }
}

export function mensagemDeRegra(erro: ErroRegra): string {
  const fechada = erro.codigo ? MENSAGENS[erro.codigo] : undefined;
  if (fechada) return fechada;
  if (erro.status >= 500 || erro.status === 0) return TEXTO_SERVICO_INDISPONIVEL;
  return erro.message;
}

const BASE = '/api/erp/fiscal';

function criarErro(status: number, body: unknown): ErroRegra {
  const codigo = extrairCodigoErro(body);
  const porCampo = extrairErrosPorCampo(body);
  const fechada = codigo ? MENSAGENS[codigo] : undefined;
  const rotulada = status === 400 ? mensagemRotulada(porCampo, ROTULOS_CAMPOS) : null;
  const indisponivel = status >= 500 ? TEXTO_SERVICO_INDISPONIVEL : null;
  return new ErroRegra(fechada || indisponivel || rotulada || extrairMensagemErro(body, 'Falha na operação.'), status, codigo, porCampo);
}

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(caminho.startsWith('/api/') ? caminho : `${BASE}${caminho}`, {
      method: metodo,
      cache: 'no-store',
      ...(corpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    });
  } catch {
    throw new ErroRegra('Serviço indisponível. Verifique a conexão e tente novamente.', 0, 'SERVICO_INDISPONIVEL', {});
  }
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
  cfopId: string;
  sort: string;
  dir: 'asc' | 'desc';
  page: number;
}

export const FILTROS_LISTA: FiltrosLista = {
  search: '',
  cfopId: '',
  sort: 'enquadramento',
  dir: 'asc',
  page: 1,
};

export interface LinhaRegra {
  id: string;
  /** Linhagem, número da versão e situação identificam a versão; não são colunas da grade. */
  codigo: string;
  numeroVersao: number;
  situacao: string;
  enquadramentoFiscal: string;
  operacaoFiscal: string;
  beneficioFiscal: string;
  classificacaoIbsCbs: string;
  operacao: string;
  tratamentoIcms: string;
}

export interface DetalheRegra {
  id: string;
  codigo: string;
  numeroVersao: number;
  versao: number;
  enquadramentoId: string;
  enquadramentoCodigo: string;
  operacaoId: string;
  operacaoRotulo: string;
  cfopId: string;
  cfopCodigo: string;
  icmsCst: string;
  pRedBc: string;
  pIcms: string;
  beneficioFiscalId: string;
  beneficioDescricao: string;
  ipiCst: string;
  pisCst: string;
  ibsCst: string;
  classificacaoIbsCbsId: string;
  classificacaoDescricao: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  situacao: string;
  empresaNome: string;
  responsavel: string;
  criadoEm: string;
  atualizadoEm: string;
  autor: string | null;
  aprovador: string | null;
  tratamentoIcms: string;
  tratamentoIpi: string;
  tratamentoPis: string;
  tratamentoIbs: string;
}

export interface CorpoRegra {
  enquadramentoId: string;
  operacaoId: string;
  cfopId: string;
  icmsCst: string;
  pRedBc: string;
  pIcms: string;
  beneficioFiscalId: string;
  ipiCst: string;
  pisCst: string;
  ibsCst: string;
  classificacaoIbsCbsId: string;
  vigenciaInicio: string;
  vigenciaFim?: string | null;
  justificativa: string;
  versao?: number;
}

export interface ContagensRegra {
  total: number;
  rascunhos: number;
  submetidas: number;
  aprovadas: number;
  aposentadas: number;
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
  numeroVersao: number | null;
}

export interface PreCondicao {
  codigo: string;
  atendida: boolean;
  provisoria: boolean;
  texto?: string;
}

export interface Diferenca {
  campo: string;
  antes: string;
  depois: string;
}

/** Operação e CFOP do enquadramento escolhido, para preencher os dois combos. */
export interface EnquadramentoRef {
  operacaoId: string;
  operacaoRotulo: string;
  cfopId: string;
  cfopCodigo: string;
  cfopDescricao: string;
}

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

const item = (id: string) => `/regras/${encodeURIComponent(id)}`;

/** Filtros que valem para a lista, as contagens e a exportação (sem página nem ordenação nas contagens). */
const filtrosDe = (f: FiltrosLista) => ({ search: f.search, cfopId: f.cfopId });

export const regrasApi = {
  listar: (filtros: FiltrosLista) =>
    chamar<Paginado<LinhaRegra>>('GET', `/regras${qs({ ...filtros, pageSize: 20 })}`),
  contagens: (filtros: FiltrosLista) => chamar<ContagensRegra>('GET', `/regras/contagens${qs(filtrosDe(filtros))}`),
  /** Versões da mesma linhagem (mesmo código), com número da versão e situação. */
  versoesDoCodigo: async (codigo: string) =>
    (await chamar<Paginado<LinhaRegra>>('GET', `/regras${qs({ codigo, pageSize: 100 })}`)).data,
  obter: (id: string) => chamar<DetalheRegra>('GET', item(id)),
  historico: (id: string) => chamar<EventoHistorico[]>('GET', `${item(id)}/historico`),
  preCondicoes: (id: string) => chamar<PreCondicao[]>('GET', `${item(id)}/pre-condicoes`),
  criar: (corpo: CorpoRegra) => chamar<DetalheRegra>('POST', '/regras', corpo),
  atualizar: (id: string, corpo: CorpoRegra & { versao: number }) => chamar<DetalheRegra>('PATCH', item(id), corpo),
  versao: (id: string, corpo: CorpoRegra & { versao: number }) => chamar<DetalheRegra>('POST', `${item(id)}/versoes`, corpo),
  submeter: (id: string, corpo: { versao: number; justificativa: string }) => chamar<DetalheRegra>('POST', `${item(id)}/submeter`, corpo),
  aprovar: (id: string, corpo: { versao: number; justificativa: string }) => chamar<DetalheRegra>('POST', `${item(id)}/aprovar`, corpo),
  aposentar: (id: string, corpo: { versao: number; justificativa: string }) => chamar<DetalheRegra>('POST', `${item(id)}/aposentar`, corpo),
  comparar: (id: string, com: string) => chamar<{ diferencas: Diferenca[] }>('GET', `${item(id)}/comparar${qs({ com })}`),
  enquadramento: (id: string) => chamar<EnquadramentoRef>('GET', `/enquadramentos/${encodeURIComponent(id)}`),
  criarBeneficio: (corpo: { codigo: string; descricao: string; justificativa: string }) =>
    chamar<{ id: string; descricao: string }>('POST', '/beneficios-fiscais', corpo),
  criarClassificacao: (corpo: { codigo: string; descricao: string; justificativa: string }) =>
    chamar<{ id: string; descricao: string }>('POST', '/classificacoes-ibs-cbs', corpo),
  /** CSV da visão atual: mesmos filtros e ordenação da grade. */
  exportar: async (filtros: FiltrosLista) => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/regras/exportacao${qs({ ...filtrosDe(filtros), sort: filtros.sort, dir: filtros.dir })}`, { cache: 'no-store' });
    } catch {
      throw new ErroRegra('Serviço indisponível. Verifique a conexão e tente novamente.', 0, 'SERVICO_INDISPONIVEL', {});
    }
    if (!res.ok) throw criarErro(res.status, await res.json().catch(() => null));
    return res.blob();
  },
};

/** Texto do item do combo de versões: código, número da versão e situação. */
export function rotuloVersao(linha: Pick<LinhaRegra, 'codigo' | 'numeroVersao' | 'situacao'>): string {
  return `${linha.codigo} · versão ${linha.numeroVersao} · ${linha.situacao}`;
}

const texto = (valor: unknown) => String(valor ?? '');

/** Combos de busca no servidor (identidade estável para o `ComboboxBusca`). */
export const buscarBeneficios = (termo: string) =>
  buscarCatalogo('/api/erp/fiscal/beneficios-fiscais', termo, (l) => ({ id: texto(l.id), rotulo: texto(l.descricao) }));

export const buscarClassificacoes = (termo: string) =>
  buscarCatalogo('/api/erp/fiscal/classificacoes-ibs-cbs', termo, (l) => ({ id: texto(l.id), rotulo: texto(l.descricao) }));
