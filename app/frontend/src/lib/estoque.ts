import { mensagemDeErro } from '@/lib/error-message';

export type TipoItemEstoque = 'peca' | 'subitem' | 'entrada';

export type StatusRotuloEstoque =
  | 'Disponível'
  | 'Destinado a pedido'
  | 'Em desossa'
  | 'Bloqueado por ocorrência';

export interface ItemEstoqueConsulta {
  id: string;
  tipo: TipoItemEstoque;
  codigo: string;
  statusFisico: string;
  statusRotulo: StatusRotuloEstoque;
  quantidade: string;
  peso: string | null;
  unidade: string;
  produto: { id: string | null; codigo: string; nome: string };
  origem: string;
  nfLote: string | null;
  local: { valor: string | null; provisorio: boolean };
  caracteristicas: string[];
  pedidoReservado: string | null;
  estoqueAnterior: boolean;
  createdAt: string;
}

export interface PedidoCompativelEstoque {
  pedidoVendaItemId: string;
  pedidoVendaId: string;
  clienteNome: string;
  pendencia: string;
}

export interface EntradaItem {
  id: string;
  produtoId: string;
  produtoNome: string | null;
  quantidade: number;
  unidade: 'caixa' | 'unidade';
  destino: 'estoque' | 'pedido';
  operadorNome: string;
  createdAt: string;
}

export interface AjusteEstoque {
  id: string;
  produtoCodigo: string;
  quantidadeDelta: number;
  quantidadeAnterior: number;
  motivo: 'quebra' | 'perda' | 'erro_contagem' | 'vencimento' | 'outro';
  status: 'aplicado' | 'aguardando_aprovacao' | 'rejeitado';
  criadoPor: string;
  responsavelNome: string | null;
  createdAt: string;
}

export interface EventoHistoricoEstoque {
  descricao: string;
  dataHora: string;
}

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Consulta ────────────────────────────────────────────────────────────────

export async function consultarEstoque(filtros?: {
  status?: string;
  produtoId?: string;
  search?: string;
}): Promise<ItemEstoqueConsulta[]> {
  const qs = new URLSearchParams();
  if (filtros?.status) qs.set('status', filtros.status);
  if (filtros?.produtoId) qs.set('produtoId', filtros.produtoId);
  if (filtros?.search) qs.set('search', filtros.search);
  const query = qs.toString();
  const res = await fetch(`/api/operacao/estoque/consulta${query ? `?${query}` : ''}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao consultar estoque'));
  return res.json() as Promise<ItemEstoqueConsulta[]>;
}

// ── Destinar ────────────────────────────────────────────────────────────────

export interface DestinarPayload {
  tipo: TipoItemEstoque;
  id: string;
  pedidoVendaItemId: string;
  quantidade?: number;
}

export async function destinarItem(payload: DestinarPayload): Promise<ItemEstoqueConsulta> {
  const res = await fetch('/api/operacao/estoque/destinar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao destinar item'));
  return res.json();
}

/** SugestaoScored do backend não traz nome do cliente — só clienteId (RF-PS-08/09/10). */
interface SugestaoScoredApi {
  pedidoVendaId: string;
  pedidoVendaItemId: string;
  clienteId: string;
  saldoPendente: string;
  justificativa: string;
}

function sugestaoParaCompativel(s: SugestaoScoredApi): PedidoCompativelEstoque {
  return {
    pedidoVendaItemId: s.pedidoVendaItemId,
    pedidoVendaId: s.pedidoVendaId,
    clienteNome: `Cliente ${s.clienteId.slice(0, 8)}…`,
    pendencia: s.justificativa,
  };
}

export async function compativeisPeca(pecaId: string): Promise<PedidoCompativelEstoque[]> {
  const res = await fetch(`/api/operacao/pesagem/pecas/${pecaId}/compativeis`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao buscar pedidos compatíveis'));
  const sugestoes = (await res.json()) as SugestaoScoredApi[];
  return sugestoes.map(sugestaoParaCompativel);
}

export async function compativeisSubitem(subitemId: string): Promise<PedidoCompativelEstoque[]> {
  const res = await fetch(`/api/operacao/corte/subitens/${subitemId}/sugestao`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao buscar pedidos compatíveis'));
  const data = (await res.json()) as { compativeis: SugestaoScoredApi[] };
  return (data.compativeis ?? []).map(sugestaoParaCompativel);
}

export async function compativeisEntrada(entradaId: string): Promise<PedidoCompativelEstoque[]> {
  const res = await fetch(`/api/operacao/estoque/entradas/${entradaId}/compativeis`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao buscar pedidos compatíveis'));
  return res.json();
}

export async function compativeisPorProduto(produtoId: string): Promise<PedidoCompativelEstoque[]> {
  const res = await fetch(`/api/operacao/estoque/entradas/compativeis?produtoId=${produtoId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao buscar pedidos compatíveis'));
  return res.json();
}

// ── Histórico ───────────────────────────────────────────────────────────────

export async function historicoItem(tipo: TipoItemEstoque, id: string): Promise<EventoHistoricoEstoque[]> {
  const res = await fetch(`/api/operacao/estoque/${tipo}/${id}/historico`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao carregar histórico'));
  return res.json();
}

// ── Entradas ────────────────────────────────────────────────────────────────

export interface CriarEntradaPayload {
  produtoId: string;
  quantidade: number;
  unidade: 'caixa' | 'unidade';
  fornecedorNome: string;
  loteNf?: string;
  local?: string;
  destino: 'estoque' | 'pedido';
  pedidoVendaItemId?: string;
  observacao?: string;
}

export async function listarEntradas(page = 1, pageSize = 50): Promise<Paginado<EntradaItem>> {
  const res = await fetch(`/api/operacao/estoque/entradas?page=${page}&pageSize=${pageSize}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao listar entradas'));
  return res.json();
}

export async function criarEntrada(payload: CriarEntradaPayload): Promise<EntradaItem> {
  const res = await fetch('/api/operacao/estoque/entradas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao registrar entrada'));
  return res.json();
}

// ── Ajustes ─────────────────────────────────────────────────────────────────

export interface CriarAjustePayload {
  tipo: TipoItemEstoque;
  id: string;
  quantidadeDelta: number;
  motivo: 'quebra' | 'perda' | 'erro_contagem' | 'vencimento' | 'outro';
  descricao?: string;
}

export async function listarAjustes(page = 1, pageSize = 50, status?: string): Promise<Paginado<AjusteEstoque>> {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) qs.set('status', status);
  const res = await fetch(`/api/operacao/estoque/ajustes?${qs}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao listar ajustes'));
  return res.json();
}

export async function criarAjuste(payload: CriarAjustePayload): Promise<AjusteEstoque> {
  const res = await fetch('/api/operacao/estoque/ajustes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao criar ajuste'));
  return res.json();
}

export async function aprovarAjuste(id: string): Promise<AjusteEstoque> {
  const res = await fetch(`/api/operacao/estoque/ajustes/${id}/aprovar`, { method: 'POST' });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao aprovar ajuste'));
  return res.json();
}

export async function rejeitarAjuste(id: string, motivo: string): Promise<AjusteEstoque> {
  const res = await fetch(`/api/operacao/estoque/ajustes/${id}/rejeitar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  });
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao rejeitar ajuste'));
  return res.json();
}
