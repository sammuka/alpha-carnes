'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Info, RefreshCw, Scissors, Tv, X } from 'lucide-react';
import { BadgeCount } from '@/components/ui/badge-count';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
import { conectarRealtime } from '@/lib/realtime';
import type { PainelDesossa, PecaElegivelDesossa } from '@/lib/desossa';

const EVENTOS_REFETCH = new Set([
  'faltas_desossa_atualizadas',
  'divergencia_transformacao_aberta',
  'corte_iniciado',
  'subitem_associado',
  'corte_concluido',
]);

function prioridadeVariant(prioridade: string): StatusPillVariant {
  if (prioridade === 'Alta') return 'bloqueado';
  if (prioridade === 'Média') return 'pendente';
  return 'recebido';
}

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
      <SheetContent side="right" className="flex sm:max-w-[520px] max-w-full flex-col bg-card p-0">
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
      <SheetContent side="right" className="flex sm:max-w-[520px] max-w-full flex-col bg-card p-0">
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
          {regra.provisorio ? <BadgeProvisorio codigo="P12" /> : null}
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
      <SheetContent side="right" className="flex sm:max-w-[520px] max-w-full flex-col bg-card p-0">
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
      <div className="space-y-3">
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        <p className="text-sm text-muted-foreground">
          {carregando ? 'Carregando painel…' : 'Sem dados'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Painel de Necessidade"
        subtitle="O que falta produzir para completar os pedidos do dia."
        live={wsStatus === 'conectado'}
      >
        <Button variant="secondary" size="sm" onClick={() => void carregar()} disabled={carregando}>
          <RefreshCw className={carregando ? 'animate-spin' : ''} />
          Atualizar
        </Button>
        <Button variant="secondary" size="sm" type="button" onClick={() => setModoTV(true)}>
          <Tv /> Modo TV
        </Button>
        <Button asChild size="sm">
          <Link href="/desossa/pesagem-destinacao">
            <Scissors />
            Pesagem e Destinação
          </Link>
        </Button>
      </PageHeader>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

      <KpiStrip>
        <Kpi label="Itens faltantes" value={painel.totais.itensFaltantes} tone="alert" />
        <Kpi label="Prontos em estoque" value={painel.totais.prontoEstoque} tone="ok" />
        <Kpi label="TZs na desossa" value={painel.totais.tzsNaDesossa} tone="default" />
        <Kpi label="Regras sugeridas" value={painel.regras.length} tone="default" />
        <Kpi
          label="Prioridade alta"
          value={painel.itens.filter((i) => i.prioridade === 'Alta').length}
          tone="danger"
        />
      </KpiStrip>

      <Card>
        <CardHeader className="h-auto flex-col items-start gap-0.5 py-2.5">
          <div className="flex w-full items-center gap-2">
            <CardTitle>Painel de Itens a Produzir</CardTitle>
            <BadgeCount>{painel.itens.length}</BadgeCount>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Lista orientativa dos produtos que faltam para pedidos e cargas. Não representa produção
            em andamento.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {painel.itens.length === 0 ? (
            <EmptyState title="Nenhum item faltante." className="border-none" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Prior.</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Faltam</TableHead>
                  <TableHead className="text-right">Estoque pronto</TableHead>
                  <TableHead className="text-right">A produzir</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Rota / Carga</TableHead>
                  <TableHead>Representante</TableHead>
                  <TableHead>Alvo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {painel.itens.map((item) => (
                  <TableRow key={item.produtoId} className="group">
                    <TableCell>
                      <StatusPill variant={prioridadeVariant(item.prioridade)} label={item.prioridade} />
                    </TableCell>
                    <TableCell className="text-[13px] font-semibold text-foreground">
                      {item.produtoNome}
                    </TableCell>
                    <TableCellNum>{item.faltam}</TableCellNum>
                    <TableCellNum>{item.prontoEstoque || '—'}</TableCellNum>
                    <TableCellNum>{item.aProduzir}</TableCellNum>
                    <TableCell className="text-violet-700">{item.origem}</TableCell>
                    <TableCell className="text-muted-foreground">{item.rota ?? '—'}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-muted-foreground">
                      {(item.representante ?? '—').split('/')[0]?.trim()}
                    </TableCell>
                    <TableCellCode>{item.horarioAlvo ?? '—'}</TableCellCode>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="iconSm"
                          aria-label="Ver detalhes"
                          onClick={() => setDrawerItem(item)}
                        >
                          <Eye />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="h-auto flex-col items-start gap-0.5 py-2.5">
          <div className="flex w-full items-center gap-2">
            <CardTitle>Sugestão por Regra de Transformação</CardTitle>
            <BadgeCount>{painel.regras.length}</BadgeCount>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Agrupamento orientativo para evitar leitura duplicada de produtos que compartilham o
            mesmo TZ.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {painel.regras.length === 0 ? (
            <EmptyState title="Nenhuma regra sugerida." className="border-none" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Prior.</TableHead>
                  <TableHead>Regra sugerida</TableHead>
                  <TableHead className="text-right">TZs estimados</TableHead>
                  <TableHead>Saídas esperadas</TableHead>
                  <TableHead>Atende</TableHead>
                  <TableHead>Sobras previstas</TableHead>
                  <TableHead>Impacto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {painel.regras.map((r) => (
                  <TableRow key={r.regraId} className="group">
                    <TableCell>
                      <StatusPill variant={prioridadeVariant(r.prioridade)} label={r.prioridade} />
                    </TableCell>
                    <TableCell className="font-bold text-violet-700">
                      <span className="inline-flex items-center gap-2">
                        {r.nome}
                        {r.provisorio ? <BadgeProvisorio codigo="P12" /> : null}
                      </span>
                    </TableCell>
                    <TableCellNum>{r.tzsEstimados}</TableCellNum>
                    <TableCell>{r.saidasEsperadas}</TableCell>
                    <TableCell className="text-muted-foreground">{r.atende}</TableCell>
                    <TableCell className="text-muted-foreground">{r.sobras}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground">
                      {r.impacto}
                    </TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="iconSm"
                          aria-label="Ver detalhes"
                          onClick={() => setDrawerRegra(r)}
                        >
                          <Eye />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="h-auto flex-col items-start gap-0.5 py-2.5">
          <div className="flex w-full items-center gap-2">
            <CardTitle>TZs disponíveis para desossa</CardTitle>
            <BadgeCount>{tzs.length}</BadgeCount>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Peças encaminhadas pela balança ou disponíveis para transformação.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {tzs.length === 0 ? (
            <EmptyState title="Nenhum TZ disponível para desossa." className="border-none" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Peça</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Características</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Obs.</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tzs.map((tz) => (
                  <TableRow key={tz.pecaId} className="group">
                    <TableCellCode>{tz.etiquetaAtual ?? tz.pecaId}</TableCellCode>
                    <TableCellNum>
                      {tz.pesoOriginal
                        ? `${Number(tz.pesoOriginal).toFixed(3).replace('.', ',')} kg`
                        : '—'}
                    </TableCellNum>
                    <TableCell className="text-muted-foreground">{tz.lote ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(tz.origem ?? '—').replace(/^Frigorífico\s+/i, '')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tz.entrada ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{tz.caracteristicas || '—'}</TableCell>
                    <TableCell>{tz.situacao}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-muted-foreground">
                      {tz.obs ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="iconSm"
                          aria-label="Ver detalhes"
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
                          <Eye />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
