import { ConflictException } from '@nestjs/common';

// Status de peça ELEGÍVEIS para carga (apenas 'associada')
const STATUS_PECA_ELEGIVEIS = ['associada'] as const;

// Status de subitem ELEGÍVEIS para carga (apenas 'associado')
const STATUS_SUBITEM_ELEGIVEIS = ['associado'] as const;

export interface PecaParaElegibilidade {
  id: string;
  statusPeca: string;
  etiquetaAtual: string | null;
  pedidoVendaId: string | null;
  pedidoVendaItemId: string | null;
}

export interface SubitemParaElegibilidade {
  id: string;
  statusSubitem: string;
  etiquetaAtual: string | null;
  pedidoVendaId: string | null;
  pedidoVendaItemId: string | null;
}

/**
 * Valida elegibilidade de peça para carga.
 * Lança ConflictException (409) com motivo explícito se inelegível.
 */
export function validarElegibilidadePeca(peca: PecaParaElegibilidade): void {
  if (!(STATUS_PECA_ELEGIVEIS as readonly string[]).includes(peca.statusPeca)) {
    throw new ConflictException(
      `Peça em status '${peca.statusPeca}' não é elegível para carga. Exigido: associada`,
    );
  }
  if (!peca.etiquetaAtual) {
    throw new ConflictException('Peça sem etiqueta não pode entrar na carga');
  }
  if (!peca.pedidoVendaId || !peca.pedidoVendaItemId) {
    throw new ConflictException('Peça sem vínculo de pedido não pode entrar na carga');
  }
}

/**
 * Valida elegibilidade de subitem para carga.
 * Lança ConflictException (409) com motivo explícito se inelegível.
 */
export function validarElegibilidadeSubitem(subitem: SubitemParaElegibilidade): void {
  if (!(STATUS_SUBITEM_ELEGIVEIS as readonly string[]).includes(subitem.statusSubitem)) {
    throw new ConflictException(
      `Subitem em status '${subitem.statusSubitem}' não é elegível para carga. Exigido: associado`,
    );
  }
  if (!subitem.etiquetaAtual) {
    throw new ConflictException('Subitem sem etiqueta não pode entrar na carga');
  }
  if (!subitem.pedidoVendaId || !subitem.pedidoVendaItemId) {
    throw new ConflictException('Subitem sem vínculo de pedido não pode entrar na carga');
  }
}
