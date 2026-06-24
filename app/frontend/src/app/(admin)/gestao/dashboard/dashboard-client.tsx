'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Calendar,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  Scale,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import type { DashboardDia } from '@/lib/gestao';
import { ActivityItem } from '@/components/ui/activity-item';
import { AlertItem } from '@/components/ui/alert-item';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusPill } from '@/components/ui/status-pill';
import { statusPedidoVariant } from '@/lib/status-ui';

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

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

export function DashboardClient({ permissoes }: { permissoes: string[] }) {
  const podeVer =
    permissoes.includes('COMPRAS_PROGRAMADAS_LER') || permissoes.includes('DISPONIBILIDADE_LER');

  const [dataOperacao] = useState(hojeISO());
  const [dados, setDados] = useState<DashboardDia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');

  const refetch = useCallback(async () => {
    if (!podeVer) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/gestao/dashboard?dataOperacao=${dataOperacao}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Erro ao carregar dashboard');
        return;
      }
      setDados((await res.json()) as DashboardDia);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [dataOperacao, podeVer]);

  const handleAtualizar = () => {
    setAtualizando(true);
    void refetch();
  };

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!podeVer) return;
    const onMessage = (msg: RealtimeMensagem) => {
      if (
        msg.type === 'reserva_disponibilidade_atualizada' ||
        msg.type === 'disponibilidade_virtual_gerada' ||
        msg.type === 'recebimento_registrado' ||
        msg.type === 'divergencia_recebimento_aberta' ||
        msg.type === 'divergencia_recebimento_atualizada' ||
        msg.type === 'pedido_sem_cobertura' ||
        msg.type === 'compra_programada_confirmada'
      ) {
        void refetch();
      }
    };
    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${dataOperacao}`],
      onMessage,
      onReconnect: refetch,
      onStatus: setStatus,
    });
    return desconectar;
  }, [dataOperacao, podeVer, refetch]);

  if (!podeVer) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para visualizar o dashboard operacional.
      </p>
    );
  }

  const pedidosAtivos =
    (dados?.pedidos.total ?? 0) - (dados?.pedidos.porStatus.cancelado ?? 0);
  const pedidosListados = dados?.pedidosEmAndamento?.length ?? 0;
  const porStatus = dados?.pedidos.porStatus ?? {};
  const temStatusExpedicao =
    Object.prototype.hasOwnProperty.call(porStatus, 'expedido') ||
    Object.prototype.hasOwnProperty.call(porStatus, 'em_expedicao');
  const pedidosExpedicao = temStatusExpedicao
    ? (porStatus.expedido ?? 0) + (porStatus.em_expedicao ?? 0)
    : pedidosListados;
  const subtextoPedidos = temStatusExpedicao
    ? `${pedidosExpedicao} em expedição`
    : `${pedidosListados} em andamento`;

  const alertas: Array<{
    key: string;
    title: string;
    description: string;
    time: string;
    variant: 'divergencia' | 'bloqueado' | 'pendente';
    Icon: typeof AlertTriangle;
  }> = [];

  if ((dados?.divergenciasAbertas ?? 0) > 0) {
    alertas.push({
      key: 'divergencias',
      title: 'Divergências abertas',
      description: `${dados?.divergenciasAbertas} divergência(s) aguardando conferência.`,
      time: '—',
      variant: 'divergencia',
      Icon: AlertTriangle,
    });
  }

  if ((dados?.disponibilidade.itensEsgotados ?? 0) > 0) {
    alertas.push({
      key: 'estoque',
      title: 'Estoque baixo',
      description: `${dados?.disponibilidade.itensEsgotados} produto(s) comercial(is) esgotado(s).`,
      time: '—',
      variant: 'pendente',
      Icon: Scale,
    });
  }

  if (!dados?.comprasProgramadas.compraAtiva && !carregando) {
    alertas.push({
      key: 'compra',
      title: 'Compra do dia',
      description: 'Nenhuma compra programada confirmada para hoje.',
      time: '—',
      variant: 'pendente',
      Icon: PackageCheck,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-foreground">Dashboard Operacional</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Visão geral das operações do dia
            {status === 'conectado' && (
              <span className="ml-2 text-xs font-medium text-[var(--color-status-expedido)]">
                · tempo real
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground">
            <Calendar size={16} className="text-muted-foreground" />
            {formatDataOperacao(dataOperacao)}
          </div>
          <button
            type="button"
            onClick={handleAtualizar}
            disabled={atualizando || carregando}
            className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition-colors disabled:opacity-60"
            style={{ background: 'var(--color-primary)' }}
            onMouseEnter={(e) => {
              if (!atualizando && !carregando) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'var(--color-primary-hover)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-primary)';
            }}
          >
            <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} />
            Atualizar dados
          </button>
        </div>
      </div>

      {erro && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {erro}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Itens disponíveis"
          value={carregando ? '…' : (dados?.disponibilidade.itens ?? '—')}
          sub="itens comercializáveis hoje"
          variant="primary"
          Icon={PackageCheck}
        />
        <KpiCard
          label="Saldo virtual livre"
          value={carregando ? '…' : (dados?.disponibilidade.quantidadeDisponivelTotal ?? '—')}
          sub="unidades disponíveis"
          variant="violet"
          Icon={Scale}
        />
        <KpiCard
          label="Pedidos em andamento"
          value={carregando ? '…' : pedidosAtivos}
          sub={subtextoPedidos}
          variant="success"
          Icon={TrendingUp}
        />
        <KpiCard
          label="Divergências abertas"
          value={carregando ? '…' : (dados?.divergenciasAbertas ?? 0)}
          sub={(dados?.divergenciasAbertas ?? 0) > 0 ? 'Requer atenção' : 'Sem ocorrências'}
          variant="warning"
          Icon={AlertTriangle}
        />
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
                    dados!.pedidosEmAndamento!.map((pedido) => (
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
            <div className="flex h-[52px] items-center border-t border-border px-5 text-xs text-muted-foreground">
              {carregando
                ? 'Carregando…'
                : `${dados?.pedidosEmAndamento?.length ?? 0} pedido(s) exibido(s)`}
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
              ) : alertas.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum alerta ativo no momento.
                </p>
              ) : (
                alertas.map((alerta) => (
                  <AlertItem
                    key={alerta.key}
                    title={alerta.title}
                    description={alerta.description}
                    time={alerta.time}
                    variant={alerta.variant}
                    Icon={alerta.Icon}
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
                dados!.atividadesRecentes!.map((atividade) => (
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

          {!carregando && (dados?.caminhoesDoDia ?? 0) > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Caminhões do dia
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">{dados?.caminhoesDoDia}</p>
              <p className="mt-1 text-xs text-muted-foreground">registrados na expedição</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
