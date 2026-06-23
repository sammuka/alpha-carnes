'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  Info,
  PackageCheck,
  PackageOpen,
  Scale,
  Scissors,
  TrendingUp,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import type { DashboardDia } from '@/lib/gestao';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  variant?: 'primary' | 'success' | 'warning' | 'muted';
  Icon: LucideIcon;
}

function KpiCard({ label, value, sub, variant = 'muted', Icon }: KpiCardProps) {
  const styles = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
    muted: 'bg-muted text-muted-foreground',
  };

  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`ml-3 shrink-0 rounded-lg p-2.5 ${styles[variant]}`}>
          <Icon size={20} strokeWidth={1.75} />
        </div>
      </CardContent>
    </Card>
  );
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const ROTULO_STATUS_COMPRA: Record<string, string> = {
  rascunho: 'Rascunho',
  em_negociacao: 'Em negociação',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
};

export function DashboardClient({ permissoes }: { permissoes: string[] }) {
  const podeVer =
    permissoes.includes('COMPRAS_PROGRAMADAS_LER') || permissoes.includes('DISPONIBILIDADE_LER');

  const [dataOperacao] = useState(hojeISO());
  const [dados, setDados] = useState<DashboardDia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');

  const refetch = useCallback(async () => {
    if (!podeVer) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/gestao/dashboard?dataOperacao=${dataOperacao}`, { cache: 'no-store' });
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
    }
  }, [dataOperacao, podeVer]);

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

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (!podeVer) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar o dashboard operacional.</p>;
  }

  const pedidosAtivos =
    (dados?.pedidos.total ?? 0) - (dados?.pedidos.porStatus.cancelado ?? 0);
  const compraAtiva = dados?.comprasProgramadas.compraAtiva;
  const operacaoAtiva = compraAtiva?.status === 'confirmada';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Operacional</h1>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">{hoje}</p>
        </div>
        <Badge variant="outline" className={status === 'conectado' ? 'border-green-200 bg-green-50 text-green-700' : ''}>
          {status === 'conectado' ? '● tempo real' : '○ reconectando'}
        </Badge>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {!compraAtiva && !carregando && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-800">Nenhuma compra programada para hoje</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Os indicadores serão atualizados em tempo real conforme as operações avançam.
            </p>
          </div>
        </div>
      )}

      {compraAtiva && (
        <div className="flex items-start gap-3 rounded-lg border px-4 py-3">
          <Info size={16} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">
              Compra do dia:{' '}
              <Badge variant="outline">{ROTULO_STATUS_COMPRA[compraAtiva.status] ?? compraAtiva.status}</Badge>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground font-mono">{compraAtiva.id}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Itens disponíveis"
          value={carregando ? '…' : (dados?.disponibilidade.itens ?? '—')}
          sub={`${dados?.disponibilidade.quantidadeDisponivelTotal ?? '0'} un. livres`}
          variant="success"
          Icon={PackageCheck}
        />
        <KpiCard
          label="Saldo virtual livre"
          value={carregando ? '…' : (dados?.disponibilidade.quantidadeDisponivelTotal ?? '—')}
          sub="unidades comercializáveis"
          variant="primary"
          Icon={Scale}
        />
        <KpiCard
          label="Pedidos em andamento"
          value={carregando ? '…' : pedidosAtivos}
          sub="Clientes do dia"
          variant="success"
          Icon={TrendingUp}
        />
        <KpiCard
          label="Divergências abertas"
          value={carregando ? '…' : (dados?.divergenciasAbertas ?? 0)}
          sub={dados?.divergenciasAbertas ? 'Requer atenção' : 'Sem ocorrências'}
          variant={(dados?.divergenciasAbertas ?? 0) > 0 ? 'warning' : 'muted'}
          Icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Itens esgotados" value={carregando ? '…' : (dados?.disponibilidade.itensEsgotados ?? 0)} variant="muted" Icon={Scale} />
        <KpiCard label="Compras do dia" value={carregando ? '…' : (dados?.comprasProgramadas.total ?? 0)} variant="muted" Icon={Scissors} />
        <KpiCard label="Caminhões do dia" value={carregando ? '…' : (dados?.caminhoesDoDia ?? 0)} variant="muted" Icon={PackageOpen} />
        <KpiCard
          label="Pedidos reservados"
          value={carregando ? '…' : (dados?.pedidos.porStatus.reservado ?? 0)}
          variant="muted"
          Icon={FileText}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Caminhões do dia</h2>
              <Truck size={15} className="text-muted-foreground" />
            </div>
            {(dados?.caminhoesDoDia ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum caminhão registrado — aparecerão ao serem incluídos na expedição.
              </p>
            ) : (
              <p className="text-2xl font-bold">{dados?.caminhoesDoDia} caminhão(ões)</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Alertas operacionais</h2>
              <AlertTriangle size={15} className="text-muted-foreground" />
            </div>
            {(dados?.divergenciasAbertas ?? 0) === 0 && (dados?.disponibilidade.itensEsgotados ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum alerta ativo no momento.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(dados?.divergenciasAbertas ?? 0) > 0 && (
                  <li className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    {dados?.divergenciasAbertas} divergência(s) de recebimento em aberto
                  </li>
                )}
                {(dados?.disponibilidade.itensEsgotados ?? 0) > 0 && (
                  <li className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                    {dados?.disponibilidade.itensEsgotados} item(ns) comercial(is) esgotado(s)
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {operacaoAtiva && (
        <p className="text-xs text-muted-foreground">Operação ativa — compra confirmada para {dataOperacao}</p>
      )}
    </div>
  );
}
