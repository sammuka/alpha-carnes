'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, RefreshCw, Download, Eye, X,
  Search, FileText, Ban, Info, XCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusPill } from '@/components/ui/status-pill';
import { statusNfseVariant } from '@/lib/status-ui';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import type {
  AmbienteFiscal, NotaFiscalListagem, Paginado, RastreabilidadeNota, StatusNfse,
} from '@/lib/faturamento';

// ── Badge de ambiente EISS (mesmo padrão de pre-faturamento-client.tsx — T8) ────

function BadgeAmbiente({ homologacao }: { homologacao: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${
        homologacao
          ? 'bg-[var(--color-warning-surface)] text-[var(--color-warning-ink)] border-[var(--color-provisorio-border)]'
          : 'bg-[var(--color-success-surface)] text-[var(--color-success-strong)] border-[var(--color-success-strong-border)]'
      }`}
    >
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
      {homologacao ? 'Homologação EISS' : 'Produção EISS'}
    </span>
  );
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtKg(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg';
}

function truncChave(chave: string | null) {
  if (!chave) return '—';
  return chave.length > 14 ? `${chave.slice(0, 8)}…${chave.slice(-6)}` : chave;
}

function rotuloStatus(status: StatusNfse): string {
  const rotulos: Record<StatusNfse, string> = {
    pendente: 'Pendente',
    emitida: 'Autorizada',
    erro_emissao: 'Erro',
    cancelada: 'Cancelada',
    erro_cancelamento: 'Erro no cancelamento',
  };
  return rotulos[status];
}

const MOTIVOS_CANCELAMENTO = [
  'Pedido selecionado incorretamente',
  'Peso/preço lançado incorretamente',
  'Cliente incorreto',
  'Solicitação do cliente',
  'Outro',
];

// ── Modal: Cancelar Nota (D10.4) ────────────────────────────────────────────────

function ModalCancelar({ nota, onClose, onConfirm }: {
  nota: NotaFiscalListagem | null;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [obs, setObs] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMotivo('');
    setObs('');
  }, [nota]);

  if (!nota) return null;

  if (nota.caminhaoLiberado) {
    return (
      <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-sm bg-white p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-[var(--color-border)]">
            <DialogTitle className="text-[14px] font-bold text-[var(--color-text-strong)]">Cancelamento bloqueado</DialogTitle>
          </DialogHeader>
          <div className="p-5 flex flex-col gap-3">
            <div className="flex items-start gap-2 bg-[var(--color-danger-surface)] border border-[var(--color-danger-strong-border)] rounded-lg p-3">
              <Ban className="w-4 h-4 text-[var(--color-danger-rose)] flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-[var(--color-danger-strong-text)] leading-snug">
                O caminhão desta carga já foi liberado. Notas só podem ser canceladas antes da liberação do caminhão.
              </p>
            </div>
          </div>
          <div className="px-5 pb-5">
            <button onClick={onClose} className="w-full h-8 rounded-md bg-[var(--color-brand-navy-deep)] text-white text-[12px] font-semibold hover:bg-[var(--color-action-blue)] transition-colors">
              Entendi
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md bg-white p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-[var(--color-border)]">
          <DialogTitle className="text-[14px] font-bold text-[var(--color-text-strong)]">Cancelar Nota {nota.numeroNfse ?? nota.id}</DialogTitle>
        </DialogHeader>
        <div className="p-5 flex flex-col gap-3">
          <div className="bg-[var(--color-surface-subtle)] rounded-lg p-3 grid grid-cols-2 gap-y-1.5 text-[12px]">
            <div><span className="text-[var(--color-text-muted)]">Pedido: </span><span className="font-semibold text-[var(--color-text-strong)]">{nota.pedidoVendaId.slice(0, 8)}</span></div>
            <div><span className="text-[var(--color-text-muted)]">Cliente: </span><span className="font-semibold text-[var(--color-text-strong)]">{nota.clienteNome}</span></div>
            <div className="col-span-2"><span className="text-[var(--color-text-muted)]">Valor: </span><span className="font-semibold text-[var(--color-text-strong)]">{fmtBRL(Number(nota.valor))}</span></div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[var(--color-text-graphite)]">Motivo do cancelamento <span className="text-[var(--color-required-mark)]">*</span></label>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}
              className="h-8 w-full rounded-md border border-[var(--color-border)] px-2.5 text-[12px] text-[var(--color-text-strong)] focus:border-[var(--color-action-blue)] focus:outline-none">
              <option value="">Selecionar...</option>
              {MOTIVOS_CANCELAMENTO.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[var(--color-text-graphite)]">Observação</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
              className="w-full rounded-md border border-[var(--color-border)] px-2.5 py-2 text-[12px] text-[var(--color-text-strong)] resize-none focus:border-[var(--color-action-blue)] focus:outline-none" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 h-8 rounded-md border border-[var(--color-border)] text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors">
            Voltar
          </button>
          <button
            disabled={!motivo || submitting}
            onClick={() => {
              setSubmitting(true);
              void onConfirm(motivo).finally(() => setSubmitting(false));
            }}
            className="flex-1 h-8 rounded-md bg-[var(--color-danger-rose)] text-white text-[12px] font-semibold hover:bg-[var(--color-danger-strong-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Confirmar Cancelamento
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Drawer: rastreabilidade (D10.7) ─────────────────────────────────────────────

function DrawerRastreabilidade({ notaId, onClose }: { notaId: string | null; onClose: () => void }) {
  const [dados, setDados] = useState<RastreabilidadeNota | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!notaId) { setDados(null); return; }
    setCarregando(true);
    fetch(`/api/operacao/faturamento/notas/${notaId}/rastreabilidade`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RastreabilidadeNota | null) => setDados(data))
      .finally(() => setCarregando(false));
  }, [notaId]);

  if (!notaId) return null;
  const nota = dados?.nota;

  return (
    <Sheet open={!!notaId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[560px] max-w-full p-0 flex flex-col bg-white border-l border-[var(--color-border)]">
        <SheetHeader className="flex-shrink-0 px-6 py-4 border-b border-[var(--color-border)] flex flex-row items-center justify-between">
          <SheetTitle className="text-[15px] font-bold text-[var(--color-text-strong)]">
            Nota {nota?.numeroNfse ?? '—'}
          </SheetTitle>
          <button onClick={onClose}><X className="w-4 h-4 text-[var(--color-text-muted)]" /></button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {carregando && <p className="text-[12px] text-[var(--color-text-muted)]">Carregando…</p>}

          {nota && (
            <>
              <div className="flex items-center gap-2">
                <StatusPill variant={statusNfseVariant(nota.statusNfse)} label={rotuloStatus(nota.statusNfse)} />
              </div>

              {nota.statusNfse === 'erro_emissao' && nota.ultimoErroNfse && (
                <div className="flex items-start gap-2 bg-[var(--color-danger-surface)] border border-[var(--color-danger-strong-border)] rounded-lg p-3">
                  <XCircle className="w-3.5 h-3.5 text-[var(--color-danger-rose)] flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[var(--color-danger-strong-text)]">{nota.ultimoErroNfse}</p>
                </div>
              )}

              {/* Vínculo pedido ↔ peças ↔ pesos ↔ item fiscal */}
              <div>
                <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                  Vínculo pedido ↔ peças ↔ pesos ↔ item fiscal
                </p>
                <div className="grid grid-cols-2 gap-3 text-[12px] bg-[var(--color-surface-subtle)] rounded-lg p-3">
                  {[
                    ['Pedido', dados?.pedido?.id?.slice(0, 8) ?? nota.pedidoVendaId.slice(0, 8)],
                    ['Cliente', dados?.pedido?.clienteNome ?? '—'],
                    ['Chave de verificação', nota.codigoVerificacao ?? '—'],
                    ['Data/hora', nota.emitidaEm ?? nota.createdAt],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium">{k}</p>
                      <p className="text-[12px] text-[var(--color-text-strong)] font-semibold mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peças/subitens */}
              <div>
                <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Peças</p>
                <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-muted)]">
                        {['Etiqueta', 'Produto', 'Peso'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(dados?.pecas ?? []).map((p, i) => (
                        <tr key={i} className="border-b border-[var(--color-surface-subtle)] last:border-0">
                          <td className="px-3 py-2 font-mono text-[10px] text-[var(--color-text-muted)]">{p.etiqueta ?? '—'}</td>
                          <td className="px-3 py-2 font-bold text-[var(--color-brand-navy-deep)]">{p.produtoNome}</td>
                          <td className="px-3 py-2 font-mono text-[var(--color-text-slate)] whitespace-nowrap">{fmtKg(Number(p.peso ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--color-surface-subtle)]">
                        <td className="px-3 py-2 font-bold text-[var(--color-text-strong)]" colSpan={2}>Peso total</td>
                        <td className="px-3 py-2 font-mono font-black text-[var(--color-brand-navy-deep)] whitespace-nowrap">{dados ? fmtKg(Number(dados.pesoTotalKg)) : '—'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--color-border)] flex gap-2">
          <a
            href={nota?.linkNfse ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            title={nota?.linkNfse ? 'Baixar XML' : 'Link da nota ainda não disponível'}
            aria-disabled={!nota?.linkNfse}
            className={`h-8 px-3 rounded-md border border-[var(--color-border)] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${nota?.linkNfse ? 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]' : 'text-[var(--color-placeholder)] cursor-not-allowed pointer-events-none'}`}
          >
            <Download className="w-3.5 h-3.5" /> Baixar XML
          </a>
          <a
            href={nota?.linkNfse ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            title={nota?.linkNfse ? 'Ver DANFE' : 'Link da nota ainda não disponível'}
            aria-disabled={!nota?.linkNfse}
            className={`h-8 px-3 rounded-md border border-[var(--color-border)] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${nota?.linkNfse ? 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]' : 'text-[var(--color-placeholder)] cursor-not-allowed pointer-events-none'}`}
          >
            <FileText className="w-3.5 h-3.5" /> Ver DANFE
          </a>
          <button onClick={onClose} className="ml-auto h-8 px-4 rounded-md bg-[var(--color-brand-navy-deep)] text-white text-[12px] font-semibold hover:bg-[var(--color-action-blue)] transition-colors">
            Fechar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function NotasXmlClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);

  const [notas, setNotas] = useState<NotaFiscalListagem[]>([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusNfse | 'Todos'>('Todos');
  const [drawerNotaId, setDrawerNotaId] = useState<string | null>(null);
  const [modalCancelar, setModalCancelar] = useState<NotaFiscalListagem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessandoId, setReprocessandoId] = useState<string | null>(null);
  const [ambiente, setAmbiente] = useState<AmbienteFiscal | null>(null);

  useEffect(() => {
    fetch('/api/operacao/faturamento/ambiente', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AmbienteFiscal | null) => setAmbiente(data))
      .catch(() => setAmbiente(null));
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set('busca', busca.trim());
      if (filtroStatus !== 'Todos') params.set('status', filtroStatus);
      const res = await fetch(`/api/operacao/faturamento/notas?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) { setErro('Falha ao carregar notas'); return; }
      const data = (await res.json()) as Paginado<NotaFiscalListagem>;
      setNotas(data.data);
      setTotal(data.total);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [busca, filtroStatus]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const EVENTOS_RELEVANTES = new Set(['nfse_emitida', 'nfse_cancelada', 'nfse_erro_emissao', 'caminhao_liberado']);
    const onMessage = (msg: RealtimeMensagem) => {
      if (EVENTOS_RELEVANTES.has(msg.type)) void carregar();
    };
    const desconectar = conectarRealtime({ rooms: ['dashboard'], onMessage, onReconnect: () => void carregar() });
    return desconectar;
  }, [carregar]);

  const kpis = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const emitidasHoje = notas.filter((n) => n.emitidaEm?.startsWith(hoje));
    return {
      autorizadasHoje: emitidasHoje.filter((n) => n.statusNfse === 'emitida').length,
      comErro: notas.filter((n) => n.statusNfse === 'erro_emissao').length,
      aguardandoRetorno: notas.filter((n) => n.statusNfse === 'pendente').length,
    };
  }, [notas]);

  async function reprocessar(notaId: string) {
    setReprocessandoId(notaId);
    setErro(null);
    try {
      const res = await fetch(`/api/operacao/faturamento/notas/${notaId}/reprocessar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErro((data as { message?: string }).message ?? 'Falha ao reprocessar'); return; }
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setReprocessandoId(null);
    }
  }

  async function confirmarCancelamento(motivo: string) {
    if (!modalCancelar) return;
    setErro(null);
    try {
      const res = await fetch(`/api/operacao/faturamento/notas/${modalCancelar.id}/cancelar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErro((data as { message?: string }).message ?? 'Falha ao cancelar'); return; }
      setModalCancelar(null);
      await carregar();
    } catch {
      setErro('Erro de conexão');
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] text-[var(--color-text-muted)] font-medium mb-0.5">Faturamento / Notas · XML</p>
          <h1 className="text-[20px] font-bold text-[var(--color-text-strong)]">Notas / XML</h1>
          <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">Consulta das notas emitidas via integração EISS Osasco-SP.</p>
        </div>
        {ambiente && <BadgeAmbiente homologacao={ambiente.homologacao} />}
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Autorizadas hoje', value: `${kpis.autorizadasHoje}`, sub: 'notas autorizadas', color: 'text-[var(--color-success-strong)]', bg: 'bg-[var(--color-success-surface)]' },
          { label: 'Com erro', value: `${kpis.comErro}`, sub: 'aguardando reprocessamento', color: 'text-[var(--color-danger-rose)]', bg: 'bg-[var(--color-danger-surface)]' },
          { label: 'Aguardando retorno', value: `${kpis.aguardandoRetorno}`, sub: 'processando no EISS', color: 'text-[var(--color-action-blue-hover)]', bg: 'bg-[var(--color-action-blue-bg)]' },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} className={`border border-[var(--color-border)] rounded-xl px-4 py-3.5 ${bg}`}>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-medium mb-1">{label}</p>
            <p className={`text-[26px] font-black leading-none ${color}`}>{value}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nota, chave, cliente..."
            className="h-8 w-[280px] rounded-md border border-[var(--color-border)] bg-white pl-8 pr-3 text-[12px] placeholder:text-[var(--color-placeholder)] focus:border-[var(--color-action-blue)] focus:outline-none"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusNfse | 'Todos')}
          className="h-8 rounded-md border border-[var(--color-border)] bg-white px-2.5 text-[12px] text-[var(--color-text-slate)] focus:border-[var(--color-action-blue)] focus:outline-none"
        >
          <option value="Todos">Status: Todos</option>
          <option value="emitida">Autorizada</option>
          <option value="erro_emissao">Erro</option>
          <option value="pendente">Processando</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <span className="ml-auto text-[11px] text-[var(--color-text-muted)]">{total} nota(s)</span>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-[var(--color-border)] rounded-xl flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground p-6" data-testid="loading">Carregando notas…</p>
        ) : notas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <FileText className="w-8 h-8 text-[var(--color-placeholder)]" />
            <p className="text-[13px] text-[var(--color-text-muted)]">Nenhuma nota encontrada para os filtros atuais.</p>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[var(--color-surface-subtle)] z-10">
              <tr className="border-b border-[var(--color-muted)]">
                {['Nº nota', 'Chave / autenticador', 'Pedido / Carga', 'Cliente', 'Valor', 'Status', 'Data/hora', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => (
                <tr key={n.id} className="border-b border-[var(--color-surface-subtle)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="px-4 py-2.5 font-mono font-bold text-[var(--color-brand-navy-deep)] whitespace-nowrap">{n.numeroNfse ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-[var(--color-text-muted)] whitespace-nowrap text-[11px]">{truncChave(n.codigoVerificacao)}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-slate)] whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-semibold text-[var(--color-text-strong)]">{n.pedidoVendaId.slice(0, 8)}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{n.caminhaoId.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-slate)] max-w-[160px] truncate">{n.clienteNome}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[var(--color-text-strong)] whitespace-nowrap">{fmtBRL(Number(n.valor))}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill variant={statusNfseVariant(n.statusNfse)} label={rotuloStatus(n.statusNfse)} />
                    {n.caminhaoLiberado && <p className="text-[9px] text-[var(--color-text-muted)] mt-1">Caminhão liberado</p>}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)] whitespace-nowrap text-[11px]">{n.emitidaEm ?? n.createdAt}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      <a
                        href={n.linkNfse ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={n.linkNfse ? 'Baixar XML' : 'Link da nota ainda não disponível — emissão pendente ou sem retorno do EISS'}
                        aria-disabled={!n.linkNfse}
                        className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${n.linkNfse ? 'hover:bg-[var(--color-muted)] text-[var(--color-text-muted)] hover:text-[var(--color-text-slate)]' : 'text-[var(--color-placeholder)] cursor-not-allowed pointer-events-none'}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={n.linkNfse ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={n.linkNfse ? 'Ver DANFE' : 'Link da nota ainda não disponível — emissão pendente ou sem retorno do EISS'}
                        aria-disabled={!n.linkNfse}
                        className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${n.linkNfse ? 'hover:bg-[var(--color-muted)] text-[var(--color-text-muted)] hover:text-[var(--color-text-slate)]' : 'text-[var(--color-placeholder)] cursor-not-allowed pointer-events-none'}`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </a>
                      <button title="Ver detalhe" onClick={() => setDrawerNotaId(n.id)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-muted)] text-[var(--color-text-muted)] hover:text-[var(--color-text-slate)] transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {n.statusNfse === 'erro_emissao' && pode('NFSE_EMITIR') && (
                        <button title="Reprocessar" disabled={reprocessandoId === n.id} onClick={() => void reprocessar(n.id)}
                          className="h-6 px-2 rounded text-[11px] font-medium text-[var(--color-danger-rose)] hover:bg-[var(--color-danger-surface)] transition-colors border border-[var(--color-danger-strong-border)] flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> {reprocessandoId === n.id ? 'Reprocessando…' : 'Reprocessar'}
                        </button>
                      )}
                      {n.statusNfse === 'emitida' && pode('NFSE_CANCELAR') && (
                        n.caminhaoLiberado ? (
                          <span title="Caminhão já liberado — cancelamento bloqueado"
                            className="w-6 h-6 flex items-center justify-center text-[var(--color-placeholder)] cursor-help">
                            <Ban className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <button title="Cancelar nota" onClick={() => setModalCancelar(n)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-danger-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-danger-rose)] transition-colors">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Rodapé informativo */}
      <div className="bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl px-5 py-3.5 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-[var(--color-text-muted)] leading-snug">
          Número, chave, XML e DANFE são obtidos do retorno da integração EISS Osasco-SP. Cancelamento de nota só é permitido antes da liberação do caminhão.
        </p>
      </div>

      <DrawerRastreabilidade notaId={drawerNotaId} onClose={() => setDrawerNotaId(null)} />
      <ModalCancelar nota={modalCancelar} onClose={() => setModalCancelar(null)} onConfirm={confirmarCancelamento} />
    </div>
  );
}
