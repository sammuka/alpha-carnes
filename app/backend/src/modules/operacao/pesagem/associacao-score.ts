// Motor de sugestão de associação — função PURA (sem I/O), testável isoladamente.
// A sugestão é EFÊMERA: calculada sob demanda, nunca persistida como score volátil.
// Só a DECISÃO (confirmar/redirecionar) grava o snapshot no histórico.

import { compararQtd } from '../../../common/crud/decimal';

export interface PecaParaScore {
  itemComercialBaseId: string;
  /** Peso da peça como string NUMERIC(.,3). */
  pesoOriginal: string;
  /** Flags de pecas.captura_meta (D6.4): mais_pesada, mais_gorda, melhor_acabamento. */
  caracteristicas?: string[];
}

export interface PreferenciasCliente {
  faixaPesoMin?: number;
  faixaPesoMax?: number;
  perfilGordura?: string;
  /** Características preferidas do cliente, mesmos slugs de captura_meta. */
  caracteristicasPreferidas?: string[];
}

export interface CandidatoPedido {
  pedidoVendaId: string;
  pedidoVendaItemId: string;
  itemComercialId: string;
  clienteId: string;
  /** quantidade_pedida − quantidade_atendida (string NUMERIC). */
  saldoPendente: string;
  /** prioridade comercial (menor número = mais prioritário); null = sem prioridade. */
  prioridade: number | null;
  rotaPrevista: string | null;
  preferencias: PreferenciasCliente;
  /** Reserva ativa coberta por disponibilidade da compra de origem da peça. */
  cobertaPeloLote: boolean;
}

export interface SugestaoScored extends CandidatoPedido {
  score: number;
  justificativa: string;
  /**
   * D6.5 — SELO, não peso: interseção entre as características da peça e as preferências do
   * cliente. Não entra no score nem no desempate; o protótipo o usa como badge
   * (PesagemDestinacao.tsx:672). Nenhuma fonte define peso numérico para característica.
   */
  prefCompativel: boolean;
}

// Pesos dos critérios (RF-PS-08/10). Score determinístico e explicável.
const PESO_COMPATIVEL = 50;
const PESO_FAIXA_PESO = 25;
const PESO_PRIORIDADE = 15;
const PESO_SALDO = 10;
const PESO_COBERTURA_LOTE = 5;

/**
 * Calcula e ordena os candidatos compatíveis para uma peça (RF-PS-08).
 * Só entram candidatos com item compatível e saldo > 0. Retorna lista ordenada
 * por score desc, com justificativa transparente (RF-PS-10). NUNCA vincula nada.
 */
export function calcularScores(peca: PecaParaScore, candidatos: CandidatoPedido[]): SugestaoScored[] {
  const peso = Number(peca.pesoOriginal);
  const scored: SugestaoScored[] = [];

  for (const c of candidatos) {
    if (c.itemComercialId !== peca.itemComercialBaseId) continue; // incompatível
    if (compararQtd(c.saldoPendente, '0') <= 0) continue; // sem saldo

    let score = PESO_COMPATIVEL;
    const motivos: string[] = ['item compatível'];

    const { faixaPesoMin, faixaPesoMax } = c.preferencias;
    const temFaixa = faixaPesoMin !== undefined || faixaPesoMax !== undefined;
    if (temFaixa) {
      const dentro = (faixaPesoMin === undefined || peso >= faixaPesoMin) && (faixaPesoMax === undefined || peso <= faixaPesoMax);
      if (dentro) {
        score += PESO_FAIXA_PESO;
        motivos.push('peso na faixa preferida do cliente');
      } else {
        motivos.push('peso fora da faixa preferida');
      }
    }

    if (c.prioridade !== null) {
      // prioridade 1 (alta) → +PESO_PRIORIDADE; decai com o número.
      const bonus = Math.max(0, PESO_PRIORIDADE - (c.prioridade - 1) * 5);
      if (bonus > 0) {
        score += bonus;
        motivos.push(`prioridade comercial ${c.prioridade}`);
      }
    }

    // Saldo pendente: bônus pequeno proporcional (preferir preencher quem tem saldo).
    const saldo = Number(c.saldoPendente);
    if (saldo > 0) {
      score += Math.min(PESO_SALDO, saldo);
      motivos.push(`saldo pendente ${c.saldoPendente}`);
    }

    if (c.cobertaPeloLote) {
      score += PESO_COBERTURA_LOTE;
      motivos.push('reserva coberta pelo lote de origem');
    }

    const preferidas = c.preferencias.caracteristicasPreferidas ?? [];
    const daPeca = peca.caracteristicas ?? [];
    const prefCompativel = preferidas.length > 0 && preferidas.some((p) => daPeca.includes(p));

    scored.push({ ...c, score, justificativa: motivos.join('; '), prefCompativel });
  }

  // Ordena por score desc; desempate por prioridade asc e pedidoVendaItemId estável.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = a.prioridade ?? Number.MAX_SAFE_INTEGER;
    const pb = b.prioridade ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.pedidoVendaItemId.localeCompare(b.pedidoVendaItemId);
  });

  return scored;
}
