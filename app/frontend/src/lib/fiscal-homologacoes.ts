import { extrairCodigoErro, extrairErrosPorCampo, extrairMensagemErro } from '@/lib/error-message';

export const TEXTO_VAZIO = 'Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.';
export const CHAVE_LISTA = 'fiscal.homologacoes.lista';
export const TEXTO_DUPLA = 'Um aprovador diferente de quem submeteu a regra registra a decisão. O quórum numérico permanece provisório.';
export const TEXTO_REGRAS = 'aprovador diferente do autor; cenários de regressão obrigatórios';
export const TEXTO_EXCECAO = 'Atualização normativa em meio à operação';
export const TEXTO_EXCECAO_CORPO = 'Esta tela não bloqueia a publicação por atualização normativa, porque o protótipo não traz código de erro.';
export const TEXTO_ACEITE = 'A seleção dos checkboxes serve apenas à revisão do protótipo: não registra aceite contratual. O aceite real depende de evidências CI, integração HML, UAT e responsável autorizado.';
export const CRITERIOS_ACEITE = [
  'Todos os campos de negócio e seus formatos são exibidos e validados',
  'Ações de cadastro, edição, confirmação, cancelamento e versões possuem estados visíveis',
  'Regras de negócio do backend e pré-condições são verificadas',
  'Fluxos negativos exibem erros e não produzem gravações parciais',
  'Permissões e segregação das aprovações são auditáveis',
  'Concorrência, duplicação e reprocessamento seguros são testados',
  'Interface respeita DS v3, teclado, estados vazios e tratamento de loading/erro',
  'Integrações e batch possuem evidência de contrato, sandbox e rastreabilidade',
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

export function mensagemDeHomologacao(erro: ErroHomologacao): string {
  const fechada = erro.codigo ? MENSAGENS[erro.codigo] : undefined;
  if (fechada) return fechada;
  if (erro.status >= 500 || erro.status === 0) return 'Serviço indisponível no momento. Tente novamente.';
  return erro.message;
}

const BASE = '/api/erp/fiscal/homologacoes';

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(caminho, {
      method: metodo,
      cache: 'no-store',
      ...(corpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    });
  } catch {
    throw new ErroHomologacao('Serviço indisponível. Verifique a conexão e tente novamente.', 0, 'SERVICO_INDISPONIVEL', {});
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const codigo = extrairCodigoErro(body);
    const fechada = codigo ? MENSAGENS[codigo] : undefined;
    const mensagem = fechada || extrairMensagemErro(body, 'Falha na operação.');
    throw new ErroHomologacao(mensagem, res.status, codigo, extrairErrosPorCampo(body));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json().catch(() => null)) as T;
}

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') p.set(chave, valor);
  }
  const texto = p.toString();
  return texto ? `?${texto}` : '';
}

export interface FiltrosLista {
  search: string;
  situacao: string;
  sort: string;
  dir: 'asc' | 'desc';
  page: string;
}

export const FILTROS_LISTA: FiltrosLista = {
  search: '',
  situacao: '',
  sort: 'enquadramento',
  dir: 'asc',
  page: '1',
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

export interface OpcaoRegra {
  id: string;
  rotulo: string;
}

export interface MemoriaCenario {
  id: string;
  rotulo: string;
}

interface LinhaRegra {
  id: string;
  enquadramentoFiscal?: string;
}

interface LinhaSimulacao {
  id: string;
  enquadramento?: string;
}

interface DetalheSimulacao {
  id: string;
  codigo: string;
  numeroVersao: number;
  competenciaRotulo: string;
  enquadramento: string;
  situacao: string;
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

function listaDe<T>(bruto: T[] | { data?: T[] } | null): T[] {
  if (Array.isArray(bruto)) return bruto;
  return bruto?.data ?? [];
}

export const homologacoesApi = {
  listar: (filtros: FiltrosLista) => chamar<Pagina<LinhaHomologacao>>('GET', `${BASE}${qs({
    search: filtros.search,
    situacao: filtros.situacao,
    sort: filtros.sort,
    dir: filtros.dir,
    page: filtros.page,
    pageSize: '20',
  })}`),
  contagens: (filtros: FiltrosLista) => chamar<Contagens>('GET', `${BASE}/contagens${qs({
    search: filtros.search,
    situacao: filtros.situacao,
    sort: filtros.sort,
    dir: filtros.dir,
    page: filtros.page,
    pageSize: '20',
  })}`),
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
  regras: async (): Promise<OpcaoRegra[]> => {
    const acumulado: LinhaRegra[] = [];
    let pagina = 1;
    let total = 1;
    while (acumulado.length < total) {
      const lote = await chamar<Pagina<LinhaRegra>>('GET', `/api/erp/fiscal/regras${qs({ pageSize: '100', page: String(pagina) })}`);
      total = lote.total;
      acumulado.push(...lote.data);
      if (lote.data.length === 0) break;
      pagina += 1;
    }
    const aprovadas: OpcaoRegra[] = [];
    for (const linha of acumulado) {
      const detalhe = await chamar<{ situacao?: string; numeroVersao?: number }>('GET', `/api/erp/fiscal/regras/${linha.id}`);
      if (detalhe.situacao !== 'Aprovada' && detalhe.situacao !== 'APROVADA') continue;
      aprovadas.push({
        id: linha.id,
        rotulo: `${linha.enquadramentoFiscal ?? ''} · versão ${detalhe.numeroVersao ?? ''}`.trim(),
      });
    }
    return aprovadas;
  },
  memorias: async (enquadramento: string): Promise<MemoriaCenario[]> => {
    const lista = await chamar<Pagina<LinhaSimulacao>>('GET', '/api/erp/fiscal/simulacoes?pageSize=100&page=1');
    const memorias: MemoriaCenario[] = [];
    for (const linha of lista.data) {
      const detalhe = await chamar<DetalheSimulacao>('GET', `/api/erp/fiscal/simulacoes/${linha.id}`);
      if (detalhe.enquadramento !== enquadramento) continue;
      if (detalhe.situacao !== 'Calculada' && detalhe.situacao !== 'CALCULADA') continue;
      memorias.push({
        id: detalhe.id,
        rotulo: `${detalhe.codigo} · versão ${detalhe.numeroVersao} · ${detalhe.competenciaRotulo}`,
      });
    }
    return memorias;
  },
};
