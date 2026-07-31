'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { EtiquetaDesossaListada } from '@/lib/desossa';

export type PaginadoEtiquetasDesossa = {
  data: EtiquetaDesossaListada[];
  total: number;
  page: number;
  pageSize: number;
};

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
  const label = origem === 'balanca' ? 'Balança' : origem === 'manual' ? 'Manual' : (origem ?? '—');
  return <Badge variant="outline">{label}</Badge>;
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
                    <button type="button" title="Visualizar" onClick={() => setDrawer(e)}>
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet
        open={!!drawer}
        onOpenChange={(v) => {
          if (!v) setDrawer(null);
        }}
      >
        <SheetContent side="right" className="w-[420px] max-w-full">
          <SheetHeader>
            <SheetTitle>Detalhe da etiqueta</SheetTitle>
          </SheetHeader>
          {drawer ? (
            <div className="mt-4 space-y-3 text-sm">
              {drawer.estado === 'invalidada_por_troca' ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                  Invalidada por troca — a peça mãe vinculada permanece rastreável.
                </div>
              ) : null}
              <p>
                <span className="text-muted-foreground">Código:</span> {drawer.codigo}
              </p>
              <p>
                <span className="text-muted-foreground">Parte:</span> {drawer.parteCodigo ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Produto:</span> {drawer.produtoNome}
              </p>
              <p>
                <span className="text-muted-foreground">Peça mãe (TZ):</span>{' '}
                {drawer.pecaMaeCodigo ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Cliente / Pedido:</span>{' '}
                {drawer.clientePedido ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span> {rotuloStatusEtiqueta(drawer)}
              </p>
              {drawer.invalidadaEm ? (
                <p>
                  <span className="text-muted-foreground">Invalidada em:</span>{' '}
                  {new Date(drawer.invalidadaEm).toLocaleString('pt-BR')}
                </p>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
