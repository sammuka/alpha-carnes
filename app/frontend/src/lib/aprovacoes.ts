import { extrairCodigoErro, extrairMensagemErro, mensagemDeErro } from '@/lib/error-message';

export type TipoAprovacao =
  | 'divergencia_transformacao'
  | 'estorno_fora_regra'
  | 'reabertura_carga_pedido'
  | 'ajuste_estoque_relevante';

export const ROTULO_TIPO_APROVACAO: Record<TipoAprovacao, string> = {
  divergencia_transformacao: 'Divergência de transformação',
  estorno_fora_regra: 'Estorno fora da regra',
  reabertura_carga_pedido: 'Reabertura de carga/pedido',
  ajuste_estoque_relevante: 'Ajuste de estoque relevante',
};

export const ROTULO_STATUS_APROVACAO: Record<string, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
};

export const ROTULO_STATUS_OCORRENCIA: Record<string, string> = {
  aberta: 'Aberta',
  em_analise: 'Em tratativa',
  aguardando_fornecedor: 'Aguardando fornecedor',
  resolvida: 'Concluída',
};

export interface OcorrenciaLista {
  id: string;
  fornecedorNome: string;
  nfChave: string | null;
  pedidoLote: string | null;
  produtosDivergentes: number;
  difQtdTotal: string | null;
  difPesoTotal: string | null;
  responsavelNome: string | null;
  status: string;
  dataAbertura: string;
}

export interface AprovacaoOperacional {
  id: string;
  tipo: TipoAprovacao;
  origem: string;
  descricao: string;
  impacto: string;
  status: string;
  solicitadoEm: string;
  solicitanteNome: string | null;
  decisaoMotivo: string | null;
  decididoEm: string | null;
}

export interface PaginadoAprovacoes<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listarAprovacoes<T>(params: {
  operacaoId: string;
  aba: 'ocorrencias' | 'operacionais';
  busca?: string;
}): Promise<PaginadoAprovacoes<T>> {
  const qs = new URLSearchParams({
    operacaoId: params.operacaoId,
    aba: params.aba,
    limite: '50',
  });
  if (params.busca) qs.set('busca', params.busca);
  const res = await fetch(`/api/gestao/aprovacoes?${qs}`);
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json() as Promise<PaginadoAprovacoes<T>>;
}

export async function buscarComparativo(ocorrenciaId: string) {
  const res = await fetch(`/api/gestao/aprovacoes/ocorrencias/${ocorrenciaId}/comparativo`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = extrairMensagemErro(body, 'Falha ao carregar comparativo');
    if (
      extrairCodigoErro(body) === 'CONCLUSAO_INEXISTENTE' ||
      msg.includes('CONCLUSAO_INEXISTENTE')
    ) {
      return null;
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function registrarAndamento(id: string, acao: string) {
  const res = await fetch(`/api/operacao/ocorrencias-fornecedor/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao }),
  });
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json();
}

export async function encerrarOcorrencia(id: string, desfecho: string) {
  const res = await fetch(`/api/operacao/ocorrencias-fornecedor/${id}/encerrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ desfecho }),
  });
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json();
}

export async function decidirAprovacao(id: string, decisao: 'aprovada' | 'rejeitada', motivo: string) {
  const res = await fetch(`/api/gestao/aprovacoes/operacionais/${id}/decidir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisao, motivo }),
  });
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json();
}
