'use client';

import type { ReactNode } from 'react';
import { ArrowLeftRight, CheckCircle2, ChevronLeft, ChevronRight, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { cn } from '@/lib/cn';

/** Passos de STEP_TITULOS em src/app/components/TrocaPeca.tsx do protótipo. */
export const PASSOS_TROCA_PECA = [
  'Selecionar pedido',
  'Peça atual associada',
  'Nova peça',
  'Destino da peça retirada',
  'Motivo da troca',
  'Revisão de impactos',
] as const;

export interface ResultadoTrocaPeca {
  novaEtiqueta: string;
  etiquetaInvalidada: string;
  usuario: string;
  dataHora: string;
  motivo: string;
}

interface TrocaPecaModalProps {
  open: boolean;
  /** 1..6 — controlado por quem usa o modal; a base não avança sozinha. */
  passo: number;
  podeAvancar: boolean;
  onFechar: () => void;
  onVoltar: () => void;
  onAvancar: () => void;
  onConfirmar: () => void;
  /** Presente somente após a troca ser efetivada pelo backend (Onda 6). */
  resultado?: ResultadoTrocaPeca;
  children?: ReactNode;
}

function LinhaHistorico({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{rotulo}</span>
      <span className="font-semibold text-text-strong">{valor}</span>
    </div>
  );
}

export function TrocaPecaModal({
  open,
  passo,
  podeAvancar,
  onFechar,
  onVoltar,
  onAvancar,
  onConfirmar,
  resultado,
  children,
}: TrocaPecaModalProps) {
  if (!open) return null;

  const total = PASSOS_TROCA_PECA.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-y-auto bg-card p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold text-text-strong">
            <ArrowLeftRight size={16} className="text-sidebar-gradient-start" aria-hidden="true" />
            Trocar Peça
          </DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-surface">
                <CheckCircle2 size={28} className="text-success-strong" aria-hidden="true" />
              </div>
              <p className="text-[15px] font-bold text-text-strong">Troca realizada com sucesso</p>
              <p className="text-center text-[12px] text-text-secondary">
                A peça foi trocada de forma atômica. O peso original das duas peças foi preservado.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border-2 border-sidebar-gradient-start bg-surface-subtle p-4 font-mono">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-secondary">Nova etiqueta</p>
                <p className="text-[20px] font-black leading-tight text-sidebar-gradient-start">
                  {resultado.novaEtiqueta}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sidebar-gradient-start">
                <QrCode size={32} className="text-white" aria-hidden="true" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg bg-surface-subtle p-3 text-[12px]">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Histórico da troca
              </p>
              <LinhaHistorico rotulo="Usuário" valor={resultado.usuario} />
              <LinhaHistorico rotulo="Data/hora" valor={resultado.dataHora} />
              <LinhaHistorico rotulo="Motivo" valor={resultado.motivo} />
              <LinhaHistorico rotulo="Etiqueta invalidada" valor={resultado.etiquetaInvalidada} />
            </div>

            <button
              type="button"
              onClick={onFechar}
              className="h-8 rounded-md bg-sidebar-gradient-start text-[13px] font-semibold text-white transition-colors hover:bg-action-blue"
            >
              Concluir
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 px-5 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Passo {passo} de {total} · {PASSOS_TROCA_PECA[passo - 1]}
              </p>
              <div className="flex gap-1">
                {PASSOS_TROCA_PECA.map((titulo, index) => (
                  <span
                    key={titulo}
                    className={cn(
                      'h-1.5 flex-1 rounded-full',
                      index < passo ? 'bg-action-blue' : 'bg-border',
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex min-h-[280px] flex-col gap-4 p-5">{children}</div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={onVoltar}
                disabled={passo === 1}
                className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-border text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} aria-hidden="true" /> Voltar
              </button>
              {passo < total ? (
                <button
                  type="button"
                  onClick={onAvancar}
                  disabled={!podeAvancar}
                  className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-sidebar-gradient-start text-[13px] font-semibold text-white transition-colors hover:bg-action-blue disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Avançar <ChevronRight size={14} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onConfirmar}
                  disabled={!podeAvancar}
                  className="h-8 flex-1 rounded-md bg-action-blue text-[13px] font-semibold text-white transition-colors hover:bg-action-blue-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirmar Troca
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
