import type { StatusPillVariant } from '@/components/ui/status-pill';
import type { CompraProgramada, DisponibilidadeDia } from '@/lib/comercial';
import { rotuloProduto } from '@/lib/dominios';

export interface CadastroItem {
  id: string;
  codigo: string;
  descricao?: string;
  nome?: string;
  razaoSocial?: string;
}

export interface LinhaItem {
  itemId?: string;
  produtoId: string;
  quantidadeComprada: string;
  observacoes: string;
}

export interface SimulacaoDesdobramento {
  itens: Array<{ produtoId: string; descricao: string; fator: string; total: number }>;
  totalPartes: number;
}

export const ROTULO_COMPRA: Record<string, string> = {
  rascunho: 'Rascunho',
  em_negociacao: 'Em negociação',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
};

export const STATUS_COMPRA = ['rascunho', 'em_negociacao', 'confirmada', 'cancelada'] as const;

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatarDataOperacao(data: string | null | undefined): string {
  if (!data) return 'Sem data de operação';
  const [ano, mes, dia] = data.split('-');
  if (ano && mes && dia) return `${dia}/${mes}/${ano}`;
  return data;
}

export function statusCompraVariant(status: string): StatusPillVariant {
  switch (status) {
    case 'rascunho':
      return 'pendente';
    case 'em_negociacao':
      return 'recebido';
    case 'confirmada':
      return 'expedido';
    case 'cancelada':
      return 'bloqueado';
    default:
      return 'pendente';
  }
}

export function rotuloLote(numeroSequencial: number): string {
  return `Lote ${String(numeroSequencial).padStart(3, '0')}`;
}

export function nomeFornecedor(
  compra: Pick<CompraProgramada, 'fornecedorNomeFantasia' | 'fornecedorRazaoSocial'>,
): string {
  return compra.fornecedorNomeFantasia ?? compra.fornecedorRazaoSocial ?? '—';
}

export function chaveDisponibilidade(item: DisponibilidadeDia): string {
  return item.modo === 'compra' ? item.id : item.produtoId;
}

export function somaQuantidadeDisponivel(itens: DisponibilidadeDia[]): string {
  const total = itens.reduce((acc, item) => acc + Number(item.quantidadeDisponivel), 0);
  return total.toFixed(3);
}

export function rotuloItemDisponibilidade(
  item: DisponibilidadeDia,
  catalogo: CadastroItem[],
): string {
  const it = catalogo.find((p) => p.id === item.produtoId);
  return rotuloProduto({ codigo: it?.codigo, nome: it?.nome, descricao: it?.descricao });
}

export function linhaVazia(): LinhaItem {
  return { produtoId: '', quantidadeComprada: '', observacoes: '' };
}

export const AVISO_EDITAR_CONFIRMADA =
  'Alterar uma compra confirmada recalcula imediatamente a disponibilidade virtual impactada.';
