'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
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
import { rotuloStatusPedido, statusPedidoVariant } from '@/lib/status-ui';

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
    <div className="space-y-3">
      <PageHeader
        title="Painel Geral da Operação"
        subtitle="Visão executiva da compra, venda, disponibilidade e operação do dia"
        live={status === 'conectado'}
      >
        <SeletorOperacao />
        <Button
          variant="secondary"
          onClick={() => {
            setAtualizando(true);
            void refetch();
          }}
          disabled={atualizando || carregando}
        >
          <RefreshCw className={atualizando ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </PageHeader>

      {semOperacao && (
        <EmptyState
          title="Nenhuma operação cadastrada"
          description="Cadastre ou gere a cadência de operações para visualizar os KPIs."
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/gestao/operacoes">Ir para Operações</Link>
            </Button>
          }
        />
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
          <div className="space-y-2">
            <KpiStrip>
              {(carregando ? ORDEM_KPIS.slice(0, 5) : linha1).map((kpi) => {
                const chave = typeof kpi === 'string' ? kpi : kpi!.chave;
                const ui = MAPA_KPI_UI[chave] ?? MAPA_KPI_UI.compras_programadas!;
                return (
                  <Kpi
                    key={chave}
                    label={ROTULOS_KPI[chave] ?? chave}
                    value={carregando ? '…' : (typeof kpi === 'object' ? kpi!.valor : '—')}
                    hint={carregando ? '' : (typeof kpi === 'object' ? kpi!.detalhe : '')}
                    tone={ui.tone}
                  />
                );
              })}
            </KpiStrip>
            <KpiStrip>
              {(carregando ? ORDEM_KPIS.slice(5, 10) : linha2).map((kpi) => {
                const chave = typeof kpi === 'string' ? kpi : kpi!.chave;
                const ui = MAPA_KPI_UI[chave] ?? MAPA_KPI_UI.recebimentos_aguardados!;
                return (
                  <Kpi
                    key={chave}
                    label={ROTULOS_KPI[chave] ?? chave}
                    value={carregando ? '…' : (typeof kpi === 'object' ? kpi!.valor : '—')}
                    hint={carregando ? '' : (typeof kpi === 'object' ? kpi!.detalhe : '')}
                    tone={ui.tone}
                  />
                );
              })}
            </KpiStrip>
          </div>

          <div className="grid grid-cols-1 items-start gap-2.5 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <Card>
                <CardHeader>
                  <CardTitle>Pedidos em andamento</CardTitle>
                  <BadgeCount>{dados?.pedidosEmAndamento?.length ?? 0}</BadgeCount>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Produto / Corte</TableHead>
                        <TableHead className="text-right">Peso (kg)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {carregando ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                            Carregando pedidos…
                          </TableCell>
                        </TableRow>
                      ) : (dados?.pedidosEmAndamento?.length ?? 0) === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                            Nenhum pedido em andamento no momento.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dados!.pedidosEmAndamento.map((pedido) => (
                          <TableRow key={pedido.pedidoId} className="group">
                            <TableCellCode>{pedido.pedidoId.slice(0, 8).toUpperCase()}</TableCellCode>
                            <TableCell className="text-[13px] font-semibold text-foreground">
                              {pedido.clienteNome}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{pedido.produtoResumo}</TableCell>
                            <TableCellNum>{pedido.pesoTotalKg ?? '—'}</TableCellNum>
                            <TableCell>
                              <StatusPill
                                variant={statusPedidoVariant(pedido.status)}
                                label={rotuloStatusPedido(pedido.status)}
                              />
                            </TableCell>
                            <TableCellNum className="font-data text-[11px] text-fg-secondary">
                              {formatDataOperacao(pedido.dataOperacao)}
                            </TableCellNum>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2.5 xl:col-span-4">
              <Card>
                <CardHeader>
                  <CardTitle>Alertas operacionais</CardTitle>
                  <BadgeCount>{dados?.alertas?.length ?? 0}</BadgeCount>
                </CardHeader>
                <div>
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
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Atividades recentes</CardTitle>
                </CardHeader>
                <div>
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
              </Card>
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
