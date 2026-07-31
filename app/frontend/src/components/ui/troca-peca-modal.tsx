'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeftRight, CheckCircle2, ChevronLeft, ChevronRight, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { cn } from '@/lib/cn';
import {
  ROTULOS_MOTIVO_TROCA_PECA,
  type DestinoRetirada,
  type ExecutarTrocaPayload,
  type MotivoTrocaPeca,
  type ResultadoTroca,
} from '@/lib/operacao';
import { rotuloDestinoPeca } from '@/lib/status-ui';

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

/** Casca controlada (Onda 2) — testes de chrome e consumidores externos. */
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

// ── Fluxo completo ligado ao backend (Task 11.1) ──────────────────────────────

export interface PecaTrocaOpcao {
  id: string;
  codigo: string;
  peso: string;
  etiqueta?: string | null;
}

export interface PedidoTrocaOpcao {
  pedidoVendaId: string;
  pedidoVendaItemId: string;
  clienteNome: string;
  produtoLabel: string;
  pecasAssociadas: PecaTrocaOpcao[];
}

export interface TrocaPecaFluxoProps {
  open: boolean;
  onFechar: () => void;
  onTrocaConcluida?: () => void;
  pedidos: PedidoTrocaOpcao[];
  pecasDisponiveis: PecaTrocaOpcao[];
}

export function TrocaPecaFluxo({
  open,
  onFechar,
  onTrocaConcluida,
  pedidos,
  pecasDisponiveis,
}: TrocaPecaFluxoProps) {
  const [passo, setPasso] = useState(1);
  const [pedidoSel, setPedidoSel] = useState<PedidoTrocaOpcao | null>(null);
  const [pecaRetirada, setPecaRetirada] = useState<PecaTrocaOpcao | null>(null);
  const [pecaInserida, setPecaInserida] = useState<PecaTrocaOpcao | null>(null);
  const [destinoRetirada, setDestinoRetirada] = useState<DestinoRetirada | null>(null);
  const [motivo, setMotivo] = useState<MotivoTrocaPeca | ''>('');
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoTroca | null>(null);

  useEffect(() => {
    if (!open) return;
    setPasso(1);
    setPedidoSel(null);
    setPecaRetirada(null);
    setPecaInserida(null);
    setDestinoRetirada(null);
    setMotivo('');
    setObservacoes('');
    setEnviando(false);
    setErro(null);
    setResultado(null);
  }, [open]);

  const podeAvancar =
    (passo === 1 && !!pedidoSel) ||
    (passo === 2 && !!pecaRetirada) ||
    (passo === 3 && !!pecaInserida) ||
    (passo === 4 && !!destinoRetirada) ||
    (passo === 5 && !!motivo && (motivo !== 'outro' || observacoes.trim().length > 0)) ||
    passo === 6;

  const confirmar = async () => {
    if (!pecaRetirada || !pecaInserida || !pedidoSel || !destinoRetirada || !motivo) return;
    setEnviando(true);
    setErro(null);
    const res = await fetch('/api/operacao/pesagem/trocas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pecaRetiradaId: pecaRetirada.id,
        pecaInseridaId: pecaInserida.id,
        pedidoVendaItemId: pedidoSel.pedidoVendaItemId,
        destinoRetirada,
        motivo,
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
      } satisfies ExecutarTrocaPayload),
    });
    setEnviando(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setErro(body.message ?? 'Não foi possível concluir a troca');
      return;
    }
    setResultado((await res.json()) as ResultadoTroca);
    setPasso(6);
    onTrocaConcluida?.();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-y-auto bg-card p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold text-text-strong">
            <ArrowLeftRight size={16} className="text-sidebar-gradient-start" aria-hidden="true" />
            Trocar Peça
          </DialogTitle>
        </DialogHeader>

        {passo === 6 && resultado ? (
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-[13px] font-semibold">Troca concluída</span>
            </div>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Etiqueta invalidada</dt>
                <dd className="font-mono">
                  {resultado.etiquetaInvalidada
                    ? resultado.etiquetaInvalidada.id.slice(0, 8)
                    : 'nenhuma'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Nova etiqueta</dt>
                <dd className="font-mono">{resultado.etiquetaEmitida.id.slice(0, 8)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Peça retirada</dt>
                <dd>{rotuloDestinoPeca(resultado.pecaRetirada.statusPeca)}</dd>
              </div>
            </dl>
            {resultado.etiquetaEmitida.statusImpressao !== 'impressa' && (
              <p role="alert" className="text-[12px] text-amber-700">
                Nova etiqueta registrada, mas a impressora não confirmou — reimprima pela tela de
                Etiquetas.
              </p>
            )}
            <button
              type="button"
              onClick={onFechar}
              className="h-8 w-full rounded-md bg-sidebar-gradient-start text-[13px] font-semibold text-white"
            >
              Concluir
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 px-5 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Passo {passo} de 6 · {PASSOS_TROCA_PECA[passo - 1]}
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

            <div className="flex min-h-[280px] flex-col gap-3 p-5">
              {erro && (
                <p role="alert" className="text-[12px] text-destructive">{erro}</p>
              )}

              {passo === 1 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] text-muted-foreground">Selecione o pedido com a peça a ser trocada.</p>
                  {pedidos.map((p) => (
                    <button
                      key={p.pedidoVendaItemId}
                      type="button"
                      onClick={() => { setPedidoSel(p); setPecaRetirada(null); }}
                      className={cn(
                        'rounded-lg border p-3 text-left text-[13px]',
                        pedidoSel?.pedidoVendaItemId === p.pedidoVendaItemId
                          ? 'border-action-blue bg-blue-50'
                          : 'border-border',
                      )}
                    >
                      <p className="font-semibold">{p.clienteNome}</p>
                      <p className="text-muted-foreground">{p.produtoLabel}</p>
                    </button>
                  ))}
                </div>
              )}

              {passo === 2 && pedidoSel && (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] text-muted-foreground">Peça atual associada ao pedido.</p>
                  {pedidoSel.pecasAssociadas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPecaRetirada(p)}
                      className={cn(
                        'rounded-lg border p-3 text-left font-mono text-[13px]',
                        pecaRetirada?.id === p.id ? 'border-action-blue bg-blue-50' : 'border-border',
                      )}
                    >
                      {p.codigo} · {p.peso} kg
                    </button>
                  ))}
                </div>
              )}

              {passo === 3 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] text-muted-foreground">Nova peça que entrará no pedido.</p>
                  {pecasDisponiveis.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPecaInserida(p)}
                      className={cn(
                        'rounded-lg border p-3 text-left font-mono text-[13px]',
                        pecaInserida?.id === p.id ? 'border-action-blue bg-blue-50' : 'border-border',
                      )}
                    >
                      {p.codigo} · {p.peso} kg
                    </button>
                  ))}
                </div>
              )}

              {passo === 4 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] text-muted-foreground">Destino da peça retirada.</p>
                  {(['estoque', 'desossa'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDestinoRetirada(d)}
                      className={cn(
                        'rounded-lg border p-3 text-left text-[13px] capitalize',
                        destinoRetirada === d ? 'border-action-blue bg-blue-50' : 'border-border',
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}

              {passo === 5 && (
                <div className="flex flex-col gap-2">
                  <label className="text-[12px] font-semibold" htmlFor="motivo-troca">Motivo da troca</label>
                  <select
                    id="motivo-troca"
                    aria-label="Motivo da troca"
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value as MotivoTrocaPeca)}
                  >
                    <option value="">Selecione…</option>
                    {(Object.entries(ROTULOS_MOTIVO_TROCA_PECA) as [MotivoTrocaPeca, string][]).map(
                      ([slug, rotulo]) => (
                        <option key={slug} value={slug}>{rotulo}</option>
                      ),
                    )}
                  </select>
                  {motivo === 'outro' && (
                    <input
                      className="h-9 rounded-md border border-input px-2 text-sm"
                      placeholder="Observações"
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                    />
                  )}
                </div>
              )}

              {passo === 6 && !resultado && (
                <div className="space-y-2 text-[13px]">
                  <p className="font-semibold">Revisão de impactos</p>
                  <p>Retirada: {pecaRetirada?.codigo} → {destinoRetirada}</p>
                  <p>Inserida: {pecaInserida?.codigo}</p>
                  <p>Motivo: {motivo ? ROTULOS_MOTIVO_TROCA_PECA[motivo] : '—'}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={() => setPasso((s) => Math.max(1, s - 1))}
                disabled={passo === 1 || enviando}
                className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-border text-[13px] font-medium disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Voltar
              </button>
              {passo < 6 ? (
                <button
                  type="button"
                  onClick={() => setPasso((s) => s + 1)}
                  disabled={!podeAvancar}
                  className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-sidebar-gradient-start text-[13px] font-semibold text-white disabled:opacity-40"
                >
                  Avançar <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void confirmar()}
                  disabled={!podeAvancar || enviando}
                  className="h-8 flex-1 rounded-md bg-action-blue text-[13px] font-semibold text-white disabled:opacity-40"
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
