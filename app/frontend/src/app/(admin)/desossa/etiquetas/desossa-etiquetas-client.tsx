'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Eye,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { SeletorOperacao } from '@/components/gestao/seletor-operacao';
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableCellCode,
  TableCellNum,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
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

/** Variant StatusPill por rótulo (mesma precedência de rotuloStatusEtiqueta). */
function statusEtiquetaDesossaVariant(rotulo: string): StatusPillVariant {
  switch (rotulo) {
    case 'Ativa':
      return 'expedido';
    case 'Pendente de impressão':
      return 'pendente';
    case 'Cancelada':
      return 'bloqueado';
    case 'Invalidada por troca':
      return 'divergencia';
    case 'Reimpressa':
      return 'recebido';
    default:
      return 'pendente';
  }
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isPendente ? 'Imprimir etiqueta pendente' : 'Reimprimir etiqueta'}
          </DialogTitle>
        </DialogHeader>
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
          <FormField label="Motivo da reimpressão" required htmlFor="motivo-reimpressao-desossa">
            <SelectNative
              id="motivo-reimpressao-desossa"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              <option value="">Selecionar...</option>
              {MOTIVOS_REIMPRESSAO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectNative>
          </FormField>
        ) : null}

        <FormField label="Observação" help="opcional" htmlFor="obs-reimpressao-desossa">
          <Textarea
            id="obs-reimpressao-desossa"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={2}
          />
        </FormField>

        <p className="text-[12px] text-fg-secondary">
          A reimpressão não altera pedido, estoque, peso, destino ou disponibilidade.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!isPendente && !motivo}
            onClick={() => {
              onConfirm(motivo, obs);
              onClose();
            }}
          >
            <Printer /> {isPendente ? 'Imprimir' : 'Reimprimir'}
          </Button>
        </DialogFooter>
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar etiqueta e estornar ação</DialogTitle>
        </DialogHeader>
        <p className="text-[12px] text-danger-fg">
          Cancelar esta etiqueta irá invalidá-la e estornar a ação operacional vinculada. O
          pedido, estoque ou destino da parte será recalculado e a saída retorna ao checklist da
          transformação.
        </p>
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
        <FormField label="Motivo do cancelamento" required htmlFor="motivo-cancelar-desossa">
          <SelectNative
            id="motivo-cancelar-desossa"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          >
            <option value="">Selecionar...</option>
            {MOTIVOS_CANCEL.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </SelectNative>
        </FormField>
        <FormField label="Observação" htmlFor="obs-cancelar-desossa">
          <Textarea
            id="obs-cancelar-desossa"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={2}
          />
        </FormField>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={!motivo || (motivo === 'outro' && !obs.trim())}
            onClick={() => {
              onConfirm(motivo, obs);
              onClose();
            }}
          >
            Confirmar cancelamento
          </Button>
        </DialogFooter>
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
            <StatusPill variant={statusEtiquetaDesossaVariant(status)} label={status} />
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
                <X className="mt-0.5 h-4 w-4 text-destructive" />
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
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <div className="flex-1" />
          {reimprimivel(etq) ? (
            <Button variant="secondary" onClick={onReimprimir}>
              <Printer />
              {status === 'Pendente de impressão' ? 'Imprimir' : 'Reimprimir'}
            </Button>
          ) : null}
          {cancelavel(etq) ? (
            <Button variant="destructive" onClick={onCancelar}>
              <X /> Cancelar etiqueta
            </Button>
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
    <div className="space-y-3">
      <PageHeader
        title="Etiquetas — Desossa"
        subtitle="Etiquetas das partes geradas na transformação, com peça mãe e invalidação por troca."
      >
        <SeletorOperacao />
      </PageHeader>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      {!operacaoId ? (
        <p className="text-sm text-muted-foreground">Informe a operação para listar etiquetas.</p>
      ) : null}

      <KpiStrip>
        <Kpi label="Emitidas" value={stats.emitidas} tone="default" />
        <Kpi label="Reimpressões" value={stats.reimpressoes} tone="default" />
        <Kpi label="Canceladas" value={stats.canceladas} tone="danger" />
        <Kpi label="Invalidadas por troca" value={stats.invalidadas} tone="alert" />
        <Kpi label="Pendentes de impressão" value={stats.pendentes} tone="alert" />
      </KpiStrip>

      <Card>
        <CardHeader>
          <CardTitle>Etiquetas</CardTitle>
          <BadgeCount>{filtradas.length}</BadgeCount>
          <CardAction>
            <div className="w-[220px]">
              <Input
                adornLeft={<Search />}
                placeholder="Buscar por etiqueta, parte, cliente, TZ, lote ou NF"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <SelectNative
              aria-label="Produto"
              selectSize="sm"
              className="w-[130px]"
              value={filtroProduto}
              onChange={(e) => setFiltroProduto(e.target.value)}
            >
              {['Todos', 'Coxão-bola', 'Jacaré', 'Coxão-bola com alcatra', 'Filé curto'].map((o) => (
                <option key={o} value={o}>
                  {o === 'Todos' ? 'Produto: Todos' : o}
                </option>
              ))}
            </SelectNative>
            <SelectNative
              aria-label="Destino"
              selectSize="sm"
              className="w-[130px]"
              value={filtroDestino}
              onChange={(e) => setFiltroDestino(e.target.value)}
            >
              {['Todos', 'Pedido', 'Estoque'].map((o) => (
                <option key={o} value={o}>
                  {o === 'Todos' ? 'Destino: Todos' : o}
                </option>
              ))}
            </SelectNative>
            <SelectNative
              aria-label="Status"
              selectSize="sm"
              className="w-[130px]"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
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
            </SelectNative>
            <SelectNative
              aria-label="Período"
              selectSize="sm"
              className="w-[130px]"
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
            >
              {['Todos', 'Hoje', 'Ontem', 'Últimos 7 dias'].map((o) => (
                <option key={o} value={o}>
                  {o === 'Todos' ? 'Período: Todos' : o}
                </option>
              ))}
            </SelectNative>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {filtradas.length === 0 ? (
            <EmptyState title="Nenhuma etiqueta encontrada." className="border-none" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Código</TableHead>
                  <TableHead>Parte</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
                  <TableHead>Origem peso</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Cliente / Pedido</TableHead>
                  <TableHead>Peça mãe (TZ)</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((e) => {
                  const inativa = e.estado === 'cancelada' || e.estado === 'invalidada_por_troca';
                  const isPendente = rotuloStatusEtiqueta(e) === 'Pendente de impressão';
                  const status = rotuloStatusEtiqueta(e);
                  return (
                    <TableRow
                      key={e.id}
                      onClick={() => setDrawer(e)}
                      className={`group cursor-pointer ${inativa ? 'opacity-50' : ''}`}
                    >
                      <TableCellCode className={inativa ? 'line-through' : ''}>{e.codigo}</TableCellCode>
                      <TableCellCode>{e.parteCodigo ?? '—'}</TableCellCode>
                      <TableCell className="font-bold text-violet-800">{e.produtoNome}</TableCell>
                      <TableCellNum>{e.peso ?? '—'}</TableCellNum>
                      <TableCell>
                        <BadgeCount>
                          {e.origemPeso === 'balanca' ? 'Balança' : e.origemPeso === 'manual' ? 'Manual' : (e.origemPeso ?? '—')}
                        </BadgeCount>
                      </TableCell>
                      <TableCell>{e.destino === 'pedido' ? 'Pedido' : 'Estoque'}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-muted-foreground">
                        {e.clientePedido ?? '—'}
                      </TableCell>
                      <TableCellCode className="text-violet-700">
                        {e.pecaMaeCodigo ?? '—'}
                      </TableCellCode>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(e.createdAt).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <StatusPill variant={statusEtiquetaDesossaVariant(status)} label={status} />
                      </TableCell>
                      <TableCell onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button variant="ghost" size="iconSm" onClick={() => setDrawer(e)} aria-label="Visualizar">
                            <Eye />
                          </Button>
                          {reimprimivel(e) ? (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => setModalReimprimir(e)}
                              aria-label={isPendente ? 'Imprimir' : 'Reimprimir'}
                            >
                              <Printer />
                            </Button>
                          ) : null}
                          {cancelavel(e) ? (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => setModalCancelar(e)}
                              aria-label="Cancelar"
                            >
                              <X />
                            </Button>
                          ) : null}
                          {status === 'Bloqueada' ? (
                            <span
                              title="Cancelamento bloqueado"
                              className="flex h-7 w-7 cursor-help items-center justify-center text-muted-foreground"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
