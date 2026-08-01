'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Info, RefreshCw, Scissors, Tv, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { conectarRealtime } from '@/lib/realtime';
import type { PainelDesossa, PecaElegivelDesossa } from '@/lib/desossa';

const EVENTOS_REFETCH = new Set([
  'faltas_desossa_atualizadas',
  'divergencia_transformacao_aberta',
  'corte_iniciado',
  'subitem_associado',
  'corte_concluido',
]);

function TVMode({
  itens,
  hora,
  alertas,
  onExit,
}: {
  itens: PainelDesossa['itens'];
  hora: string;
  alertas: PainelDesossa['alertas'];
  onExit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-login-panel">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-8 py-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/50">ALFA CARNES</p>
          <h1 className="mt-0.5 text-[28px] font-black tracking-wide text-white">
            DESOSSA — PAINEL OPERACIONAL
          </h1>
          <p className="mt-1 text-[13px] text-white/50">
            O que falta produzir para atender pedidos e cargas
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-white/40">Atualizado às</p>
            <p className="font-mono text-[18px] font-black text-white">{hora}</p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="flex h-9 items-center gap-1.5 rounded-md border border-white/20 px-4 text-[12px] font-medium text-white/70 hover:bg-white/8"
          >
            <X className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-8 py-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {['PRIOR.', 'PRODUTO', 'FALTAM', 'A PRODUZIR', 'ORIGEM', 'CARGA / HORÁRIO', 'STATUS'].map(
                (h) => (
                  <th
                    key={h}
                    className="pb-3 text-left text-[11px] font-black tracking-[0.2em] text-white/40"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.produtoId} className="border-b border-white/[0.07]">
                <td className="py-4 pr-4 text-[11px] font-black text-white">{item.prioridade}</td>
                <td className="py-4 pr-6 text-[22px] font-black text-white">{item.produtoNome}</td>
                <td className="py-4 pr-6 font-mono text-[22px] font-black text-info-ink">{item.faltam}</td>
                <td className="py-4 pr-6 font-mono text-[20px] font-black text-white">
                  {item.aProduzir} <span className="text-[13px] text-white/40">peças</span>
                </td>
                <td className="py-4 pr-6 text-[16px] font-bold text-white/60">{item.origem}</td>
                <td className="py-4 pr-6">
                  <p className="text-[15px] font-bold text-white/80">{item.rota ?? '—'}</p>
                  <p className="mt-0.5 font-mono text-[13px] text-white/40">{item.horarioAlvo ?? ''}</p>
                </td>
                <td className="py-4 text-[12px] font-black text-white">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-shrink-0 items-center gap-6 border-t border-white/[0.08] px-8 py-3">
        {alertas.map((a, i) => (
          <p key={i} className="text-[11px] text-white/50">
            {a.msg}
          </p>
        ))}
        <p className="ml-auto text-[10px] uppercase tracking-widest text-white/30">
          Atualização por eventos em tempo real
        </p>
      </div>
    </div>
  );
}

function DrawerItem({
  item,
  onClose,
}: {
  item: PainelDesossa['itens'][number] | null;
  onClose: () => void;
}) {
  if (!item) return null;
  return (
    <Sheet
      open={!!item}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent side="right" className="flex w-[440px] max-w-full flex-col bg-card p-0">
        <SheetHeader className="flex flex-shrink-0 flex-row items-center justify-between border-b border-border px-6 py-4">
          <SheetTitle className="text-[15px] font-bold">{item.produtoNome}</SheetTitle>
          <button type="button" onClick={onClose}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-surface p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-info-ink" />
            <p className="text-[12px] text-info-ink">
              Painel somente orientativo. A execução ocorre na Pesagem e Destinação da Desossa.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ['Produto', item.produtoNome],
                ['Prioridade', item.prioridade],
                ['Total faltante', `${item.faltam} peças`],
                ['Pronto em estoque', `${item.prontoEstoque} peças`],
                ['A produzir', `${item.aProduzir} peças`],
                ['Origem', item.origem],
                ['Rota / Carga', item.rota ?? '—'],
                ['Representante', item.representante ?? '—'],
                ['Horário alvo', item.horarioAlvo ?? '—'],
                ['Status', item.status],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {k}
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-foreground">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-full rounded-md border border-border text-[13px] font-medium text-muted-foreground"
          >
            Fechar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerRegra({
  regra,
  onClose,
}: {
  regra: PainelDesossa['regras'][number] | null;
  onClose: () => void;
}) {
  if (!regra) return null;
  return (
    <Sheet
      open={!!regra}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent side="right" className="flex w-[440px] max-w-full flex-col bg-card p-0">
        <SheetHeader className="flex flex-shrink-0 flex-row items-center justify-between border-b border-border px-6 py-4">
          <SheetTitle className="text-[14px] font-bold">{regra.nome}</SheetTitle>
          <button type="button" onClick={onClose}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ['Regra', regra.nome],
                ['Produto origem', 'TZ'],
                ['Prioridade', regra.prioridade],
                ['TZs estimados', `${regra.tzsEstimados} peças`],
                ['Saídas esperadas', regra.saidasEsperadas],
                ['Atende', regra.atende],
                ['Sobras previstas', regra.sobras],
                ['Status', regra.status],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className={k === 'Regra' || k === 'Saídas esperadas' ? 'col-span-2' : ''}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {k}
                </p>
                <p className="mt-0.5 text-[13px] font-semibold">{v}</p>
              </div>
            ))}
            <div className="col-span-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Impacto
              </p>
              <p className="mt-0.5 text-[13px] font-semibold">{regra.impacto}</p>
            </div>
          </div>
          {regra.provisorio ? <BadgeProvisorio pendencia="P12" /> : null}
        </div>
        <div className="flex-shrink-0 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-full rounded-md border border-border text-[13px]"
          >
            Fechar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerTZ({
  tz,
  onClose,
}: {
  tz: {
    peca: string;
    peso: string | null;
    lote: string | null;
    origem: string | null;
    entrada: string | null;
    situacao: string;
    caracteristicas: string | null;
    obs: string | null;
  } | null;
  onClose: () => void;
}) {
  if (!tz) return null;
  return (
    <Sheet
      open={!!tz}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent side="right" className="flex w-[400px] max-w-full flex-col bg-card p-0">
        <SheetHeader className="flex flex-shrink-0 flex-row items-center justify-between border-b border-border px-6 py-4">
          <SheetTitle className="text-[15px] font-bold">{tz.peca}</SheetTitle>
          <button type="button" onClick={onClose}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ['Código da peça', tz.peca],
                ['Peso', tz.peso ? `${tz.peso} kg` : '—'],
                ['Lote', tz.lote ?? '—'],
                ['Frigorífico', tz.origem ?? '—'],
                ['Pesagem', tz.entrada ?? '—'],
                ['Situação', tz.situacao],
                ['Características', tz.caracteristicas || '—'],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                className={
                  k === 'Frigorífico' || k === 'Situação' || k === 'Características'
                    ? 'col-span-2'
                    : ''
                }
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {k}
                </p>
                <p className="mt-0.5 text-[13px] font-semibold">{v}</p>
              </div>
            ))}
          </div>
          {tz.obs ? (
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Observação
              </p>
              <p className="text-[12px] text-muted-foreground">{tz.obs}</p>
            </div>
          ) : null}
        </div>
        <div className="flex-shrink-0 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-full rounded-md border border-border text-[13px]"
          >
            Fechar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DesossaDashboardClient() {
  const [painel, setPainel] = useState<PainelDesossa | null>(null);
  const [tzs, setTzs] = useState<PecaElegivelDesossa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [wsStatus, setWsStatus] = useState<'conectado' | 'desconectado'>('desconectado');
  const [modoTV, setModoTV] = useState(false);
  const [hora, setHora] = useState('');
  const [drawerItem, setDrawerItem] = useState<PainelDesossa['itens'][number] | null>(null);
  const [drawerRegra, setDrawerRegra] = useState<PainelDesossa['regras'][number] | null>(null);
  const [drawerTZ, setDrawerTZ] = useState<{
    peca: string;
    peso: string | null;
    lote: string | null;
    origem: string | null;
    entrada: string | null;
    situacao: string;
    caracteristicas: string | null;
    obs: string | null;
  } | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch('/api/desossa/painel', { cache: 'no-store' });
      if (!res.ok) {
        setErro((await res.json().catch(() => ({}))).message ?? 'Erro ao carregar painel');
        return;
      }
      const painelJson = (await res.json()) as PainelDesossa;
      setPainel(painelJson);
      setHora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

      const operacaoId = painelJson.operacaoId;
      if (operacaoId) {
        const tzRes = await fetch(
          `/api/operacao/corte/pecas-elegiveis?operacaoId=${encodeURIComponent(operacaoId)}`,
          { cache: 'no-store' },
        );
        if (tzRes.ok) {
          setTzs((await tzRes.json()) as PecaElegivelDesossa[]);
        } else {
          setTzs([]);
          setErro(
            (await tzRes.json().catch(() => ({}))).message ??
              `Erro ao carregar TZs (${tzRes.status})`,
          );
        }
      }
    } catch {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const off = conectarRealtime({
      rooms: ['desossa', 'dashboard'],
      onMessage: (msg) => {
        if (EVENTOS_REFETCH.has(msg.type)) void carregar();
      },
      onReconnect: () => void carregar(),
      onStatus: setWsStatus,
    });
    return off;
  }, [carregar]);

  if (!painel) {
    return (
      <div className="space-y-4">
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        <p className="text-sm text-muted-foreground">
          {carregando ? 'Carregando painel…' : 'Sem dados'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Desossa
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Painel de Necessidade</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            O que falta produzir para completar os pedidos do dia.
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${wsStatus === 'conectado' ? 'bg-[var(--color-status-expedido)]' : 'animate-pulse bg-primary'}`}
              aria-hidden="true"
            />
            <span>Atualização por eventos em tempo real ({wsStatus})</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => setModoTV(true)}>
            <Tv className="mr-2 h-3.5 w-3.5" /> Modo TV
          </Button>
          <Button asChild size="sm">
            <Link href="/desossa/pesagem-destinacao">
              <Scissors className="mr-2 h-4 w-4" />
              Pesagem e Destinação
            </Link>
          </Button>
        </div>
      </div>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Itens faltantes', value: painel.totais.itensFaltantes, color: 'text-destructive' },
          {
            label: 'Prontos em estoque',
            value: painel.totais.prontoEstoque,
            color: 'text-success-strong',
          },
          { label: 'TZs na desossa', value: painel.totais.tzsNaDesossa, color: 'text-info-ink' },
          { label: 'Regras sugeridas', value: painel.regras.length, color: 'text-violet-700' },
          {
            label: 'Prioridade alta',
            value: painel.itens.filter((i) => i.prioridade === 'Alta').length,
            color: 'text-warning-ink',
          },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3.5">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">{k.label}</p>
            <p className={`text-[32px] font-black leading-none ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-[13px] font-bold text-foreground">Painel de Itens a Produzir</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Lista orientativa dos produtos que faltam para pedidos e cargas. Não representa produção
            em andamento.
          </p>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {[
                'Prior.',
                'Produto',
                'Faltam',
                'Estoque pronto',
                'A produzir',
                'Origem',
                'Rota / Carga',
                'Representante',
                'Alvo',
                'Status',
                '',
              ].map((h) => (
                <th
                  key={h || 'acoes'}
                  className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {painel.itens.map((item) => (
              <tr key={item.produtoId} className="border-b border-border/60">
                <td className="px-3 py-2.5">{item.prioridade}</td>
                <td className="px-3 py-2.5 font-bold">{item.produtoNome}</td>
                <td className="px-3 py-2.5 font-mono font-black">{item.faltam}</td>
                <td className="px-3 py-2.5">{item.prontoEstoque || '—'}</td>
                <td className="px-3 py-2.5 font-mono font-black">{item.aProduzir}</td>
                <td className="px-3 py-2.5 font-semibold text-violet-700">{item.origem}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-muted-foreground">
                  {item.rota ?? '—'}
                </td>
                <td className="max-w-[120px] truncate px-3 py-2.5 text-[11px] text-muted-foreground">
                  {(item.representante ?? '—').split('/')[0]?.trim()}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] font-bold">
                  {item.horarioAlvo ?? '—'}
                </td>
                <td className="px-3 py-2.5">{item.status}</td>
                <td className="px-3 py-2.5">
                  <button type="button" title="Ver detalhes" onClick={() => setDrawerItem(item)}>
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-[13px] font-bold text-foreground">Sugestão por Regra de Transformação</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Agrupamento orientativo para evitar leitura duplicada de produtos que compartilham o
            mesmo TZ.
          </p>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {[
                'Prior.',
                'Regra sugerida',
                'TZs estimados',
                'Saídas esperadas',
                'Atende',
                'Sobras previstas',
                'Impacto',
                'Status',
                '',
              ].map((h) => (
                <th
                  key={h || 'acoes-regra'}
                  className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {painel.regras.map((r) => (
              <tr key={r.regraId} className="border-b border-border/60">
                <td className="px-3 py-2.5">{r.prioridade}</td>
                <td className="px-3 py-2.5 font-bold text-violet-700">
                  {r.nome}
                  {r.provisorio ? (
                    <Badge
                      variant="outline"
                      className="ml-2"
                      title="P12 / v1.1 §16.15 — validar com cliente"
                    >
                      Provisório
                    </Badge>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 font-mono font-black">{r.tzsEstimados}</td>
                <td className="px-3 py-2.5">{r.saidasEsperadas}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-muted-foreground">
                  {r.atende}
                </td>
                <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{r.sobras}</td>
                <td className="max-w-[160px] truncate px-3 py-2.5 text-[11px] text-muted-foreground">
                  {r.impacto}
                </td>
                <td className="px-3 py-2.5">{r.status}</td>
                <td className="px-3 py-2.5">
                  <button type="button" onClick={() => setDrawerRegra(r)}>
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-[13px] font-bold text-foreground">TZs disponíveis para desossa</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Peças encaminhadas pela balança ou disponíveis para transformação.
          </p>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {['Peça', 'Peso', 'Lote', 'Origem', 'Entrada', 'Características', 'Situação', 'Obs.', ''].map(
                (h) => (
                  <th
                    key={h || 'acoes-tz'}
                    className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {tzs.map((tz) => (
              <tr key={tz.pecaId} className="border-b border-border/60 hover:bg-muted/20">
                <td className="px-3 py-2.5 font-mono text-[11px] font-bold">
                  {tz.etiquetaAtual ?? tz.pecaId}
                </td>
                <td className="px-3 py-2.5 font-mono text-muted-foreground">
                  {tz.pesoOriginal
                    ? `${Number(tz.pesoOriginal).toFixed(3).replace('.', ',')} kg`
                    : '—'}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{tz.lote ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-muted-foreground">
                  {(tz.origem ?? '—').replace(/^Frigorífico\s+/i, '')}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-muted-foreground">
                  {tz.entrada ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                  {tz.caracteristicas || '—'}
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold">{tz.situacao}</span>
                </td>
                <td className="max-w-[140px] truncate px-3 py-2.5 text-[11px] text-muted-foreground">
                  {tz.obs ?? '—'}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    title="Ver detalhes"
                    onClick={() =>
                      setDrawerTZ({
                        peca: tz.etiquetaAtual ?? tz.pecaId,
                        peso: tz.pesoOriginal,
                        lote: tz.lote,
                        origem: tz.origem,
                        entrada: tz.entrada,
                        situacao: tz.situacao,
                        caracteristicas: tz.caracteristicas,
                        obs: tz.obs,
                      })
                    }
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modoTV ? (
        <TVMode
          itens={painel.itens}
          hora={hora}
          alertas={painel.alertas}
          onExit={() => setModoTV(false)}
        />
      ) : null}
      <DrawerItem item={drawerItem} onClose={() => setDrawerItem(null)} />
      <DrawerRegra regra={drawerRegra} onClose={() => setDrawerRegra(null)} />
      <DrawerTZ tz={drawerTZ} onClose={() => setDrawerTZ(null)} />
    </div>
  );
}
