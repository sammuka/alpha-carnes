'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Eye,
  Info,
  Printer,
  RefreshCcw,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { EtiquetaDesossaListada } from '@/lib/desossa';

export type PaginadoEtiquetasDesossa = {
  data: EtiquetaDesossaListada[];
  total: number;
  page: number;
  pageSize: number;
};

const MOTIVOS_CANCEL = [
  { value: 'peso_incorreto', label: 'Peso informado incorretamente' },
  { value: 'pedido_incorreto', label: 'Pedido selecionado incorretamente' },
  { value: 'destino_incorreto', label: 'Destino selecionado incorretamente' },
  { value: 'etiqueta_incorreta', label: 'Etiqueta impressa incorretamente' },
  { value: 'peca_incorreta', label: 'Parte identificada incorretamente' },
  { value: 'outro', label: 'Outro' },
] as const;

const MOTIVOS_REIMPRESSAO = [
  'Etiqueta rasgada',
  'Etiqueta molhada/danificada',
  'Falha de impressão',
  'Perda da etiqueta',
  'Outro',
] as const;

/** Wire → rótulo protótipo DesossaEtiquetas.tsx:11 / :623 */
function rotuloStatusEtiqueta(e: EtiquetaDesossaListada): string {
  if (e.bloqueada) return 'Bloqueada';
  if (e.pendenteImpressao) return 'Pendente de impressão';
  const mapa: Record<string, string> = {
    emitida: 'Ativa',
    ativa: 'Ativa',
    reimpressa: 'Reimpressa',
    cancelada: 'Cancelada',
    invalidada_por_troca: 'Invalidada por troca',
  };
  return mapa[e.estado] ?? e.estado;
}

function StatusBadge({ etq }: { etq: EtiquetaDesossaListada }) {
  return <Badge variant="outline">{rotuloStatusEtiqueta(etq)}</Badge>;
}

function OrigemPesoBadge({ origem }: { origem: string | null }) {
  const label =
    origem === 'balanca' ? 'Balança' : origem === 'manual' ? 'Manual' : (origem ?? '—');
  return <Badge variant="outline">{label}</Badge>;
}

function cancelavel(etq: EtiquetaDesossaListada): boolean {
  const r = rotuloStatusEtiqueta(etq);
  return r === 'Ativa' || r === 'Reimpressa' || r === 'Pendente de impressão';
}

function reimprimivel(etq: EtiquetaDesossaListada): boolean {
  const r = rotuloStatusEtiqueta(etq);
  return r !== 'Cancelada' && r !== 'Invalidada por troca';
}

function ModalReimprimir({
  open,
  onClose,
  etq,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  etq: EtiquetaDesossaListada | null;
  onConfirm: (motivo: string, obs: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [obs, setObs] = useState('');
  if (!etq) return null;
  const isPendente = rotuloStatusEtiqueta(etq) === 'Pendente de impressão';

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md gap-0 bg-card p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px] font-bold">
            {isPendente ? 'Imprimir etiqueta pendente' : 'Reimprimir etiqueta'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 p-5">
          <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-muted/40 p-3 text-[12px]">
            <div>
              <span className="text-muted-foreground">Código: </span>
              <span className="font-bold">{etq.codigo ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Produto: </span>
              <span className="font-semibold">{etq.produtoNome}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Peso: </span>
              <span className="font-semibold">{etq.peso ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Destino: </span>
              <span className="font-semibold">
                {etq.destino === 'pedido' ? 'Pedido' : 'Estoque'}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Peça mãe (TZ): </span>
              <span className="font-semibold text-violet-800">{etq.pecaMaeCodigo ?? '—'}</span>
            </div>
            {etq.clientePedido ? (
              <div className="col-span-2">
                <span className="text-muted-foreground">Pedido: </span>
                <span className="font-semibold">{etq.clientePedido}</span>
              </div>
            ) : null}
            <div className="col-span-2">
              <span className="text-muted-foreground">Impressora: </span>
              <span>Balança Desossa — Zebra ZD421</span>
            </div>
          </div>

          {!isPendente ? (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">
                Motivo da reimpressão <span className="text-destructive">*</span>
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="h-8 w-full rounded-md border border-border px-2.5 text-[13px]"
              >
                <option value="">Selecionar...</option>
                {MOTIVOS_REIMPRESSAO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold">
              Observação <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-md border border-border px-2.5 py-2 text-[13px]"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-surface p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-violet-700" />
            <p className="text-[12px] text-violet-900">
              A reimpressão não altera pedido, estoque, peso, destino ou disponibilidade.
            </p>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="h-8 flex-1 rounded-md border border-border text-[13px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!isPendente && !motivo}
            onClick={() => {
              onConfirm(motivo, obs);
              onClose();
            }}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-violet-800 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer className="h-3.5 w-3.5" /> {isPendente ? 'Imprimir' : 'Reimprimir'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModalCancelar({
  open,
  onClose,
  etq,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  etq: EtiquetaDesossaListada | null;
  onConfirm: (motivo: string, obs: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [obs, setObs] = useState('');
  if (!etq) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md gap-0 bg-card p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px] font-bold">
            Cancelar etiqueta e estornar ação
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-surface p-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
            <p className="text-[12px] text-danger-rose leading-snug">
              Cancelar esta etiqueta irá invalidá-la e estornar a ação operacional vinculada. O
              pedido, estoque ou destino da parte será recalculado e a saída retorna ao checklist da
              transformação.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-muted/40 p-3 text-[12px]">
            <div>
              <span className="text-muted-foreground">Código: </span>
              <span className="font-bold">{etq.codigo ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Parte: </span>
              <span className="font-semibold">{etq.parteCodigo ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Produto: </span>
              <span className="font-semibold">{etq.produtoNome}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Peso: </span>
              <span className="font-semibold">{etq.peso ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Destino: </span>
              <span className="font-semibold">
                {etq.destino === 'pedido' ? 'Pedido' : 'Estoque'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Peça mãe (TZ): </span>
              <span className="font-semibold text-violet-800">{etq.pecaMaeCodigo ?? '—'}</span>
            </div>
            {etq.clientePedido ? (
              <div className="col-span-2">
                <span className="text-muted-foreground">Pedido: </span>
                <span className="font-semibold">{etq.clientePedido}</span>
              </div>
            ) : null}
            <div>
              <span className="text-muted-foreground">Emissão: </span>
              <span>{new Date(etq.createdAt).toLocaleString('pt-BR')}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold">
              Motivo do cancelamento <span className="text-destructive">*</span>
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="h-8 w-full rounded-md border border-border px-2.5 text-[13px]"
            >
              <option value="">Selecionar...</option>
              {MOTIVOS_CANCEL.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold">Observação</label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-md border border-border px-2.5 py-2 text-[13px]"
            />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="h-8 flex-1 rounded-md border border-border text-[13px]"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={!motivo || (motivo === 'outro' && !obs.trim())}
            onClick={() => {
              onConfirm(motivo, obs);
              onClose();
            }}
            className="h-8 flex-1 rounded-md bg-destructive text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar cancelamento
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DrawerDetalhe({
  open,
  onClose,
  etq,
  onReimprimir,
  onCancelar,
}: {
  open: boolean;
  onClose: () => void;
  etq: EtiquetaDesossaListada | null;
  onReimprimir: () => void;
  onCancelar: () => void;
}) {
  if (!etq) return null;
  const status = rotuloStatusEtiqueta(etq);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent side="right" className="flex w-[560px] max-w-full flex-col border-l border-border bg-card p-0">
        <SheetHeader className="flex flex-shrink-0 flex-row items-center justify-between border-b border-border px-6 py-4">
          <SheetTitle className="text-[15px] font-bold">Etiqueta {etq.codigo}</SheetTitle>
          <div className="flex items-center gap-2">
            <StatusBadge etq={etq} />
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 p-6">
            {status === 'Cancelada' ? (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <Ban className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p className="text-[12px] text-muted-foreground">
                  Esta etiqueta foi cancelada e não deve ser usada na operação.
                </p>
              </div>
            ) : null}
            {status === 'Invalidada por troca' ? (
              <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-surface p-3">
                <RefreshCcw className="mt-0.5 h-4 w-4 text-destructive" />
                <p className="text-[12px] text-danger-rose">
                  Esta etiqueta foi invalidada em razão de uma troca de peça (v1.1 §10.4). Uma nova
                  etiqueta foi emitida para a peça correta — consulte o histórico.
                </p>
              </div>
            ) : null}
            {status === 'Bloqueada' ? (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <Ban className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p className="text-[12px]">
                  <strong>Cancelamento bloqueado: </strong>
                  etiqueta vinculada a carga fechada ou estado que impede estorno.
                </p>
              </div>
            ) : null}

            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Rastreabilidade
              </p>
              <div className="grid grid-cols-2 gap-y-2 rounded-lg border border-violet-200 bg-violet-surface p-4 text-[12px]">
                <div className="col-span-2">
                  <span className="text-muted-foreground">Peça mãe (TZ): </span>
                  <span className="font-mono font-bold text-violet-800">{etq.pecaMaeCodigo ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Parte: </span>
                  <span className="font-mono">{etq.parteCodigo ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Origem peso: </span>
                  <span>
                    {etq.origemPeso === 'balanca'
                      ? 'Balança'
                      : etq.origemPeso === 'manual'
                        ? 'Manual'
                        : (etq.origemPeso ?? '—')}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Cliente / Pedido: </span>
                  <span className="font-bold">{etq.clientePedido ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Transformação: </span>
                  <span className="font-mono">{etq.transformacaoId}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 border-t border-border bg-card px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-border px-4 text-[13px] font-medium text-muted-foreground"
          >
            Fechar
          </button>
          <div className="flex-1" />
          {reimprimivel(etq) ? (
            <button
              type="button"
              onClick={onReimprimir}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border px-4 text-[13px] font-medium"
            >
              <Printer className="h-3.5 w-3.5" />{' '}
              {status === 'Pendente de impressão' ? 'Imprimir' : 'Reimprimir'}
            </button>
          ) : null}
          {cancelavel(etq) ? (
            <button
              type="button"
              onClick={onCancelar}
              className="flex h-8 items-center gap-1.5 rounded-md bg-destructive px-4 text-[13px] font-semibold text-white"
            >
              <X className="h-3.5 w-3.5" /> Cancelar etiqueta
            </button>
          ) : null}
          {status === 'Bloqueada' ? (
            <span className="flex h-8 cursor-help items-center gap-1.5 rounded-md bg-muted px-4 text-[13px] font-semibold text-muted-foreground">
              <Ban className="h-3.5 w-3.5" /> Bloqueada
            </span>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DesossaEtiquetasClient({ operacaoId }: { operacaoId?: string }) {
  const [etiquetas, setEtiquetas] = useState<EtiquetaDesossaListada[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroProduto, setFiltroProduto] = useState('Todos');
  const [filtroDestino, setFiltroDestino] = useState('Todos');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('Todos');
  const [drawer, setDrawer] = useState<EtiquetaDesossaListada | null>(null);
  const [modalReimprimir, setModalReimprimir] = useState<EtiquetaDesossaListada | null>(null);
  const [modalCancelar, setModalCancelar] = useState<EtiquetaDesossaListada | null>(null);

  const carregar = useCallback(async () => {
    if (!operacaoId) {
      setEtiquetas([]);
      return;
    }
    const res = await fetch(
      `/api/desossa/etiquetas?operacaoId=${encodeURIComponent(operacaoId)}`,
    );
    if (!res.ok) {
      setEtiquetas([]);
      setErro(
        (await res.json().catch(() => ({}))).message ??
          `Erro ao carregar etiquetas (${res.status})`,
      );
      return;
    }
    const json = (await res.json()) as PaginadoEtiquetasDesossa;
    setEtiquetas(json.data);
    setErro(null);
  }, [operacaoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const handleReimprimir = async (etq: EtiquetaDesossaListada) => {
    setErro(null);
    const res = await fetch(
      `/api/operacao/corte/subitens/${etq.subitemId}/etiqueta/reimprimir`,
      { method: 'POST' },
    );
    if (!res.ok) {
      setErro((await res.json().catch(() => ({}))).message ?? 'Erro ao reimprimir');
      return;
    }
    setModalReimprimir(null);
    await carregar();
  };

  const handleCancelar = async (etq: EtiquetaDesossaListada, motivo: string, obs: string) => {
    setErro(null);
    const res = await fetch(`/api/operacao/etiquetas/${etq.id}/cancelar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        motivo,
        ...(motivo === 'outro' && obs.trim() ? { observacoes: obs.trim() } : {}),
      }),
    });
    if (!res.ok) {
      setErro((await res.json().catch(() => ({}))).message ?? 'Erro ao cancelar etiqueta');
      return;
    }
    setModalCancelar(null);
    setDrawer(null);
    await carregar();
  };

  const stats = useMemo(() => {
    return {
      emitidas: etiquetas.filter((e) => e.estado === 'emitida' || e.estado === 'ativa').length,
      reimpressoes: etiquetas.filter((e) => e.estado === 'reimpressa').length,
      canceladas: etiquetas.filter((e) => e.estado === 'cancelada').length,
      invalidadas: etiquetas.filter((e) => e.estado === 'invalidada_por_troca').length,
      pendentes: etiquetas.filter((e) => e.pendenteImpressao).length,
    };
  }, [etiquetas]);

  const filtradas = useMemo(() => {
    return etiquetas.filter((e) => {
      const rotulo = rotuloStatusEtiqueta(e);
      if (filtroStatus !== 'Todos' && rotulo !== filtroStatus) return false;
      if (filtroDestino === 'Pedido' && e.destino !== 'pedido') return false;
      if (filtroDestino === 'Estoque' && e.destino !== 'estoque') return false;
      if (
        filtroProduto !== 'Todos' &&
        !e.produtoNome.toLowerCase().includes(filtroProduto.toLowerCase().replace(' com ', ' c/ '))
      ) {
        return false;
      }
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const blob = [
          e.codigo,
          e.parteCodigo,
          e.clientePedido,
          e.pecaMaeCodigo,
          e.produtoNome,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (filtroPeriodo !== 'Todos') {
        const created = new Date(e.createdAt);
        const hoje = new Date();
        const diffDias = (hoje.getTime() - created.getTime()) / 86_400_000;
        if (filtroPeriodo === 'Hoje' && diffDias >= 1) return false;
        if (filtroPeriodo === 'Ontem' && (diffDias < 1 || diffDias >= 2)) return false;
        if (filtroPeriodo === 'Últimos 7 dias' && diffDias > 7) return false;
      }
      return true;
    });
  }, [etiquetas, filtroStatus, filtroDestino, filtroProduto, busca, filtroPeriodo]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Desossa
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Etiquetas — Desossa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Etiquetas das partes geradas na transformação, com peça mãe e invalidação por troca.
        </p>
      </div>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      {!operacaoId ? (
        <p className="text-sm text-muted-foreground">Informe a operação para listar etiquetas.</p>
      ) : null}

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Emitidas', value: stats.emitidas, color: 'text-violet-800' },
          { label: 'Reimpressões', value: stats.reimpressoes, color: 'text-info-ink' },
          { label: 'Canceladas', value: stats.canceladas, color: 'text-muted-foreground' },
          { label: 'Invalidadas por troca', value: stats.invalidadas, color: 'text-destructive' },
          { label: 'Pendentes de impressão', value: stats.pendentes, color: 'text-warning-ink' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">{k.label}</p>
            <p className={`text-[28px] font-black leading-none ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por etiqueta, parte, cliente, TZ, lote ou NF"
          className="h-8 min-w-[220px] flex-1 rounded-md border border-border bg-card px-3 text-[13px]"
        />
        <select
          value={filtroProduto}
          onChange={(e) => setFiltroProduto(e.target.value)}
          className="h-8 rounded-md border border-border px-2.5 text-[13px]"
        >
          {['Todos', 'Coxão-bola', 'Jacaré', 'Coxão-bola com alcatra', 'Filé curto'].map((o) => (
            <option key={o} value={o}>
              {o === 'Todos' ? 'Produto: Todos' : o}
            </option>
          ))}
        </select>
        <select
          value={filtroDestino}
          onChange={(e) => setFiltroDestino(e.target.value)}
          className="h-8 rounded-md border border-border px-2.5 text-[13px]"
        >
          {['Todos', 'Pedido', 'Estoque'].map((o) => (
            <option key={o} value={o}>
              {o === 'Todos' ? 'Destino: Todos' : o}
            </option>
          ))}
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="h-8 rounded-md border border-border px-2.5 text-[13px]"
        >
          {[
            'Todos',
            'Ativa',
            'Reimpressa',
            'Cancelada',
            'Invalidada por troca',
            'Pendente de impressão',
            'Bloqueada',
          ].map((o) => (
            <option key={o} value={o}>
              {o === 'Todos' ? 'Status: Todos' : o}
            </option>
          ))}
        </select>
        <select
          value={filtroPeriodo}
          onChange={(e) => setFiltroPeriodo(e.target.value)}
          className="h-8 rounded-md border border-border px-2.5 text-[13px]"
        >
          {['Todos', 'Hoje', 'Ontem', 'Últimos 7 dias'].map((o) => (
            <option key={o} value={o}>
              {o === 'Todos' ? 'Período: Todos' : o}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {[
                'Código',
                'Parte',
                'Produto',
                'Peso',
                'Origem peso',
                'Destino',
                'Cliente / Pedido',
                'Peça mãe (TZ)',
                'Emissão',
                'Status',
                '',
              ].map((h) => (
                <th
                  key={h || 'acoes'}
                  className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((e) => {
              const inativa = e.estado === 'cancelada' || e.estado === 'invalidada_por_troca';
              const isPendente = rotuloStatusEtiqueta(e) === 'Pendente de impressão';
              return (
                <tr
                  key={e.id}
                  onClick={() => setDrawer(e)}
                  className={`cursor-pointer border-b border-border/60 hover:bg-violet-surface/40 ${inativa ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded bg-violet-surface px-1.5 py-0.5 font-mono text-[11px] font-bold text-violet-800 ${inativa ? 'line-through' : ''}`}
                    >
                      {e.codigo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                    {e.parteCodigo ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 font-bold text-violet-800">{e.produtoNome}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{e.peso ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <OrigemPesoBadge origem={e.origemPeso} />
                  </td>
                  <td className="px-4 py-2.5">{e.destino === 'pedido' ? 'Pedido' : 'Estoque'}</td>
                  <td className="max-w-[180px] truncate px-4 py-2.5 text-muted-foreground">
                    {e.clientePedido ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-violet-700">
                    {e.pecaMaeCodigo ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge etq={e} />
                  </td>
                  <td className="px-4 py-2.5" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Visualizar"
                        onClick={() => setDrawer(e)}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {reimprimivel(e) ? (
                        <button
                          type="button"
                          title={isPendente ? 'Imprimir' : 'Reimprimir'}
                          onClick={() => setModalReimprimir(e)}
                          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      {cancelavel(e) ? (
                        <button
                          type="button"
                          title="Cancelar"
                          onClick={() => setModalCancelar(e)}
                          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-danger-surface hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      {rotuloStatusEtiqueta(e) === 'Bloqueada' ? (
                        <span
                          title="Cancelamento bloqueado"
                          className="flex h-7 w-7 cursor-help items-center justify-center text-muted-foreground"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DrawerDetalhe
        open={!!drawer}
        onClose={() => setDrawer(null)}
        etq={drawer}
        onReimprimir={() => {
          if (drawer) {
            setModalReimprimir(drawer);
            setDrawer(null);
          }
        }}
        onCancelar={() => {
          if (drawer) {
            setModalCancelar(drawer);
            setDrawer(null);
          }
        }}
      />

      <ModalReimprimir
        open={!!modalReimprimir}
        onClose={() => setModalReimprimir(null)}
        etq={modalReimprimir}
        onConfirm={() => {
          if (modalReimprimir) void handleReimprimir(modalReimprimir);
        }}
      />

      <ModalCancelar
        open={!!modalCancelar}
        onClose={() => setModalCancelar(null)}
        etq={modalCancelar}
        onConfirm={(motivo, obs) => {
          if (modalCancelar) void handleCancelar(modalCancelar, motivo, obs);
        }}
      />
    </div>
  );
}
