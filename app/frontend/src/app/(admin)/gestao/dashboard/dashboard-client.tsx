'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  ClipboardList,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import {
  MAPA_KPI_UI,
  ORDEM_KPIS,
  ROTULOS_KPI,
  variantAlerta,
  type DashboardOperacao,
} from '@/lib/gestao';
import { SeletorOperacao } from '@/components/gestao/seletor-operacao';
import { ActivityItem } from '@/components/ui/activity-item';
import { AlertItem } from '@/components/ui/alert-item';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusPill } from '@/components/ui/status-pill';
import { statusPedidoVariant } from '@/lib/status-ui';

function formatDataOperacao(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatAtividadeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatAlertaTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function iniciaisDe(nome: string): string {
  const limpo = nome.trim();
  if (!limpo) return '—';
  return limpo.slice(0, 2).toUpperCase();
}

function rotuloStatusPedido(status: string): string {
  return status.replace(/_/g, ' ');
}

function formatPesoKg(peso: string | null): string {
  if (peso == null || peso === '') return '—';
  return `${peso} kg`;
}

const EVENTOS_REFETCH = new Set([
  'pendencia_overbooking_aberta',
  'pendencia_overbooking_resolvida',
  'compra_programada_confirmada',
  'compra_programada_alterada_impacto',
  'divergencia_recebimento_aberta',
  'relatorio_sif_gerado',
]);

function DashboardConteudo({ permissoes }: { permissoes: string[] }) {
  const searchParams = useSearchParams();
  const operacaoId = searchParams.get('operacaoId');

  const podeVer =
    permissoes.includes('COMPRAS_PROGRAMADAS_LER') || permissoes.includes('DISPONIBILIDADE_LER');

  const [dados, setDados] = useState<DashboardOperacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semOperacao, setSemOperacao] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');

  const refetch = useCallback(async () => {
    if (!podeVer) return;
    setCarregando(true);
    setErro(null);
    setSemOperacao(false);
    try {
      const qs = operacaoId ? `?operacaoId=${encodeURIComponent(operacaoId)}` : '';
      const res = await fetch(`/api/gestao/dashboard${qs}`, { cache: 'no-store' });
      if (res.status === 404) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { message?: string }).message ?? '';
        if (msg.includes('OPERACAO_INEXISTENTE')) {
          setSemOperacao(true);
          setDados(null);
          return;
        }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Erro ao carregar dashboard');
        return;
      }
      setDados((await res.json()) as DashboardOperacao);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [operacaoId, podeVer]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!podeVer || !operacaoId) return;
    const onMessage = (msg: RealtimeMensagem) => {
      if (EVENTOS_REFETCH.has(msg.type)) void refetch();
    };
    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${operacaoId}`],
      onMessage,
      onReconnect: refetch,
      onStatus: setStatus,
    });
    return desconectar;
  }, [operacaoId, podeVer, refetch]);

  if (!podeVer) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar o dashboard operacional.
      </p>
    );
  }

  const kpisOrdenados = ORDEM_KPIS.map((chave) => dados?.kpis.find((k) => k.chave === chave)).filter(Boolean);
  const linha1 = kpisOrdenados.slice(0, 5);
  const linha2 = kpisOrdenados.slice(5, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-foreground">Painel Geral da Operação</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Visão executiva da compra, venda, disponibilidade e operação do dia
            {status === 'conectado' && (
              <span className="ml-2 text-xs font-medium text-[var(--color-status-expedido)]">· tempo real</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SeletorOperacao />
          <button
            type="button"
            onClick={() => {
              setAtualizando(true);
              void refetch();
            }}
            disabled={atualizando || carregando}
            className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition-colors disabled:opacity-60"
            style={{ background: 'var(--color-primary)' }}
          >
            <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} />
            Atualizar dados
          </button>
        </div>
      </div>

      {semOperacao && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">Nenhuma operação cadastrada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre ou gere a cadência de operações para visualizar os KPIs.
          </p>
          <Link
            href="/gestao/operacoes"
            className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
          >
            Ir para Operações
          </Link>
        </div>
      )}

      {erro && !semOperacao && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{erro}</p>
          <button type="button" onClick={() => void refetch()} className="mt-2 text-sm font-semibold text-primary">
            Tentar novamente
          </button>
        </div>
      )}

      {!semOperacao && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {(carregando ? ORDEM_KPIS.slice(0, 5) : linha1).map((kpi) => {
              const chave = typeof kpi === 'string' ? kpi : kpi!.chave;
              const ui = MAPA_KPI_UI[chave] ?? MAPA_KPI_UI.compras_programadas!;
              const valor = carregando ? '…' : (typeof kpi === 'object' ? kpi!.valor : '—');
              const detalhe = carregando ? '' : (typeof kpi === 'object' ? kpi!.detalhe : '');
              return (
                <KpiCard
                  key={chave}
                  label={ROTULOS_KPI[chave] ?? chave}
                  value={valor}
                  sub={detalhe}
                  variant={ui.variant}
                  Icon={ui.Icon}
                  className={ui.destacado ? 'border-destructive/40 ring-1 ring-destructive/20' : undefined}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {(carregando ? ORDEM_KPIS.slice(5, 10) : linha2).map((kpi) => {
              const chave = typeof kpi === 'string' ? kpi : kpi!.chave;
              const ui = MAPA_KPI_UI[chave] ?? MAPA_KPI_UI.recebimentos_aguardados!;
              const valor = carregando ? '…' : (typeof kpi === 'object' ? kpi!.valor : '—');
              const detalhe = carregando ? '' : (typeof kpi === 'object' ? kpi!.detalhe : '');
              return (
                <KpiCard
                  key={chave}
                  label={ROTULOS_KPI[chave] ?? chave}
                  value={valor}
                  sub={detalhe}
                  variant={ui.variant}
                  Icon={ui.Icon}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex h-14 items-center justify-between border-b border-border px-5">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={18} className="text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground">Pedidos em andamento</h2>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                        <th className="px-5 py-3">Pedido</th>
                        <th className="px-5 py-3">Cliente</th>
                        <th className="px-5 py-3">Produto / Corte</th>
                        <th className="px-5 py-3">Peso</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carregando ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                            Carregando pedidos…
                          </td>
                        </tr>
                      ) : (dados?.pedidosEmAndamento?.length ?? 0) === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                            Nenhum pedido em andamento no momento.
                          </td>
                        </tr>
                      ) : (
                        dados!.pedidosEmAndamento.map((pedido) => (
                          <tr key={pedido.pedidoId} className="border-b border-border last:border-0">
                            <td className="px-5 py-3 font-medium text-foreground">{pedido.pedidoId.slice(0, 8)}</td>
                            <td className="px-5 py-3 text-foreground">{pedido.clienteNome}</td>
                            <td className="px-5 py-3 text-muted-foreground">{pedido.produtoResumo}</td>
                            <td className="px-5 py-3 text-muted-foreground">{formatPesoKg(pedido.pesoTotalKg)}</td>
                            <td className="px-5 py-3">
                              <StatusPill
                                variant={statusPedidoVariant(pedido.status)}
                                label={rotuloStatusPedido(pedido.status)}
                              />
                            </td>
                            <td className="px-5 py-3 text-muted-foreground">
                              {formatDataOperacao(pedido.dataOperacao)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-4 xl:col-span-4">
              <div className="rounded-xl border border-border bg-card">
                <div className="flex h-14 items-center justify-between border-b border-border px-5">
                  <div className="flex items-center gap-2">
                    <Bell size={18} className="text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground">Alertas operacionais</h2>
                  </div>
                </div>
                <div className="divide-y divide-border px-5">
                  {carregando ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Carregando alertas…</p>
                  ) : (dados?.alertas?.length ?? 0) === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum alerta ativo no momento.
                    </p>
                  ) : (
                    dados!.alertas.map((alerta) => (
                      <AlertItem
                        key={alerta.chave}
                        title={alerta.titulo}
                        description={alerta.descricao}
                        time={formatAlertaTime(alerta.ocorridoEm)}
                        variant={variantAlerta(alerta.severidade)}
                        Icon={alerta.chave === 'overbooking_aberto' ? AlertTriangle : AlertTriangle}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card">
                <div className="flex h-14 items-center justify-between border-b border-border px-5">
                  <div className="flex items-center gap-2">
                    <Truck size={18} className="text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground">Atividades recentes</h2>
                  </div>
                </div>
                <div className="divide-y divide-border px-5">
                  {carregando ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Carregando atividades…</p>
                  ) : (dados?.atividadesRecentes?.length ?? 0) === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma atividade recente registrada.
                    </p>
                  ) : (
                    dados!.atividadesRecentes.map((atividade) => (
                      <ActivityItem
                        key={atividade.id}
                        userName={atividade.usuarioNome}
                        initials={iniciaisDe(atividade.usuarioNome)}
                        activity={atividade.descricao}
                        time={formatAtividadeTime(atividade.createdAt)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardClient({ permissoes }: { permissoes: string[] }) {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando painel…</div>
      }
    >
      <DashboardConteudo permissoes={permissoes} />
    </Suspense>
  );
}
