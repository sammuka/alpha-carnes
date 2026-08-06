'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Clock, FileText, Lock, PackageCheck, Search, Truck, User,
} from 'lucide-react';
import type { CargaEnvio } from '@/lib/expedicao-ui';
import { ROTULO_STATUS_CARGA, variantStatusCarga } from '@/lib/expedicao-ui';
import type { StatusCaminhao } from '@/lib/operacao';
import { conectarRealtime } from '@/lib/realtime';
import { cn } from '@/lib/cn';
import { PipelineBar } from '@/components/ui/pipeline-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiStrip, Kpi } from '@/components/ui/kpi-strip';
import { StatusPill } from '@/components/ui/status-pill';
import { FilterChip } from '@/components/ui/filter-chip';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table, TableBody, TableCell, TableCellCode, TableCellNum, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const EVENTOS_REFETCH = new Set([
  'carga_item_adicionado',
  'carga_item_transferido',
  'carga_item_removido',
  'carga_item_divergente',
  'conferencia_concluida',
  'expedicao_fechada',
  'expedicao_reaberta',
  'expedicao_liberada_faturamento',
]);

const FILTROS: Array<StatusCaminhao | 'todas'> = [
  'todas', 'em_conferencia', 'fechado', 'liberado_faturamento', 'faturado',
];

function rotuloFiltro(f: StatusCaminhao | 'todas'): string {
  if (f === 'todas') return 'Todas';
  return ROTULO_STATUS_CARGA[f];
}

function fmtKg(peso: string): string {
  return `${Number(peso).toFixed(3).replace('.', ',')} kg`;
}

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function EnviarFaturamentoClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);
  const [dataOperacao] = useState(() => new Date().toISOString().slice(0, 10));
  const [cargas, setCargas] = useState<CargaEnvio[]>([]);
  const [cargaAtivaId, setCargaAtivaId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<StatusCaminhao | 'todas'>('todas');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacao/expedicao/envio-faturamento?dataOperacao=${encodeURIComponent(dataOperacao)}`);
      if (!res.ok) {
        setErro('Falha ao carregar cargas');
        return;
      }
      const lista = (await res.json()) as CargaEnvio[];
      setCargas(lista);
      setCargaAtivaId((atual) => atual ?? (lista.length > 0 ? lista[0]!.id : null));
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [dataOperacao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const off = conectarRealtime({
      rooms: ['dashboard'],
      onMessage: (msg) => {
        if (EVENTOS_REFETCH.has(msg.type)) void carregar();
      },
      onReconnect: () => void carregar(),
    });
    return off;
  }, [carregar]);

  const cargasFiltradas = useMemo(() => {
    return cargas.filter((c) => {
      if (filtro !== 'todas' && c.statusCaminhao !== filtro) return false;
      const q = busca.toLowerCase();
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q) ||
        c.placa.toLowerCase().includes(q) ||
        c.pedidos.some((p) => (p.clienteNome ?? '').toLowerCase().includes(q))
      );
    });
  }, [cargas, filtro, busca]);

  const carga = cargas.find((c) => c.id === cargaAtivaId) ?? null;
  const rotuloCarga = carga ? ROTULO_STATUS_CARGA[carga.statusCaminhao] : '';

  const historico = useMemo(
    () => cargas.filter((c) => c.envio !== null),
    [cargas],
  );

  const emAndamento = cargas.filter(
    (c) => c.statusCaminhao === 'em_conferencia' || c.statusCaminhao === 'fechado',
  ).length;

  async function enviarParaFaturamento() {
    if (!carga || rotuloCarga !== 'Conferida') return;
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes/${carga.id}/liberar-faturamento`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Falha ao enviar para faturamento');
        return;
      }
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="px-3 py-2">
          <PipelineBar
            etapaAtual="Carga"
            contadores={{ carga: `${emAndamento} Carga${emAndamento !== 1 ? 's' : ''} pendente${emAndamento !== 1 ? 's' : ''}` }}
          />
        </CardContent>
      </Card>

      <PageHeader
        title="Enviar para Faturamento"
        subtitle="Cargas conferidas são liberadas para o faturamento consolidar e emitir a NFS-e."
      />

      {erro && (
        <div role="alert" className="rounded-md border border-danger-soft-border bg-danger-soft p-3 text-xs text-danger-fg">
          {erro}
        </div>
      )}

      <div className="grid items-start gap-2.5 lg:grid-cols-[320px_1fr]">
        {/* Master */}
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-2.5 pb-1.5">
            <Input adornLeft={<Search />} placeholder="Buscar por carga, placa ou cliente..." className="h-7 text-xs" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {FILTROS.map((f) => (
                <FilterChip key={f} active={filtro === f} onClick={() => setFiltro(f)}>
                  {rotuloFiltro(f)}
                </FilterChip>
              ))}
            </div>
          </CardContent>
          <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
            {loading && <p className="p-3 text-xs text-muted-foreground">Carregando…</p>}
            {!loading && cargasFiltradas.length === 0 && (
              <EmptyState icon={<PackageCheck />} title="Nenhuma carga encontrada com este filtro." className="py-12" />
            )}
            {!loading &&
              cargasFiltradas.map((c) => {
                const selecionado = c.id === cargaAtivaId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCargaAtivaId(c.id)}
                    className={cn(
                      'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2',
                      selecionado && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">Carga #{c.id.slice(0, 8)}</b>
                      <StatusPill variant={variantStatusCarga(c.statusCaminhao)} className="h-[17px] text-[10px]" label={ROTULO_STATUS_CARGA[c.statusCaminhao]} />
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      <span className="font-data">{c.placa}</span> · {c.rota ?? '—'}
                    </span>
                    <span className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-foreground">
                        {c.totalClientes} cliente{c.totalClientes !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">
                        {c.totalPecas} peças · {fmtKg(c.pesoTotal)}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        </Card>

        {/* Detail */}
        <Card>
          {!carga ? (
            <CardContent className="p-8">
              <EmptyState icon={<PackageCheck />} title="Selecione uma carga para visualizar os detalhes." />
            </CardContent>
          ) : (
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h2 className="text-[15px] font-bold text-foreground">Carga #{carga.id.slice(0, 8)}</h2>
                    <StatusPill variant={variantStatusCarga(carga.statusCaminhao)} label={rotuloCarga} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Truck className="size-3.5" /> Placa: <span className="font-data">{carga.placa}</span></span>
                    <span className="flex items-center gap-1"><User className="size-3.5" /> Motorista: {carga.motorista}</span>
                    <span className="flex items-center gap-1"><Clock className="size-3.5" /> {carga.rota ?? '—'}</span>
                  </div>
                </div>
                {pode('EXPEDICAO_GERENCIAR') || pode('FATURAMENTO_GERENCIAR') ? (
                  <Button
                    disabled={rotuloCarga !== 'Conferida' || submitting}
                    title={rotuloCarga !== 'Conferida' ? 'Somente cargas com status Conferida podem ser enviadas ao faturamento.' : undefined}
                    className="shrink-0"
                    onClick={() => void enviarParaFaturamento()}
                  >
                    <PackageCheck />
                    Enviar para Faturamento
                  </Button>
                ) : null}
              </div>

              <KpiStrip>
                <Kpi label="Pedidos" value={carga.pedidos.length} />
                <Kpi label="Clientes" value={carga.totalClientes} />
                <Kpi label="Peças" value={carga.totalPecas} />
                <Kpi label="Peso Total" value={fmtKg(carga.pesoTotal)} />
              </KpiStrip>

              <div className="flex items-start gap-2 rounded-md border border-warning-soft-border bg-warning-soft px-3 py-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-fg" />
                <p className="text-xs leading-snug text-warning-fg">
                  Ao enviar para faturamento, a carga entra no marco de fechamento: estornos simples deixam de
                  ocorrer e qualquer alteração exige reabertura autorizada pela gestão.
                </p>
              </div>

              {rotuloCarga === 'Enviada para Faturamento' || rotuloCarga === 'Faturada' ? (
                <div className="flex items-start gap-2 rounded-md border border-border-strong bg-surface-2 px-3 py-2">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-fg-secondary" />
                  <p className="text-xs leading-snug text-fg-secondary">
                    {rotuloCarga === 'Faturada' ? 'Carga faturada.' : 'Carga já enviada ao faturamento.'}
                    {carga.envio && (
                      <> Enviada em {fmtDataHora(carga.envio.dataHora)} por {carga.envio.responsavelNome ?? '—'}.</>
                    )}
                  </p>
                </div>
              ) : rotuloCarga === 'Em Conferência' ? (
                <div className="flex items-start gap-2 rounded-md border border-info-border bg-info-soft px-3 py-2">
                  <Clock className="mt-0.5 size-3.5 shrink-0 text-info-fg" />
                  <p className="text-xs leading-snug text-info-fg">
                    Esta carga ainda está em conferência. Finalize a bipagem das peças na tela de Conferência de
                    Carga antes de enviar para faturamento.
                  </p>
                </div>
              ) : null}

              <div>
                <h3 className="mb-1.5 text-[13px] font-bold text-foreground">Pedidos, Clientes e Peças</h3>
                <div className="space-y-2.5">
                  {carga.pedidos.map((pedido) => (
                    <div key={pedido.pedidoVendaId} className="overflow-hidden rounded-md border border-border">
                      <div className="flex items-center justify-between bg-surface-2 px-3 py-2">
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{pedido.clienteNome ?? '—'}</p>
                          <p className="text-[11px] text-muted-foreground">Pedido {pedido.pedidoVendaId.slice(0, 8)}…</p>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{pedido.pecas.length} peças</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Etiqueta</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">Peso</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pedido.pecas.map((peca, idx) => (
                            <TableRow key={`${pedido.pedidoVendaId}-${idx}`}>
                              <TableCellCode>{peca.etiqueta ?? '—'}</TableCellCode>
                              <TableCell className="text-foreground">{peca.produtoNome}</TableCell>
                              <TableCellNum>{fmtKg(peca.peso)}</TableCellNum>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Histórico de Envios */}
      <Card>
        <CardHeader>
          <FileText className="size-3.5 text-muted-foreground" />
          <CardTitle>Histórico de Envios</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historico.length === 0 ? (
            <EmptyState icon={<FileText />} title="Nenhum envio registrado ainda." className="py-10" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Carga</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((c) => (
                  <TableRow key={c.id}>
                    <TableCellCode>#{c.id.slice(0, 8)}</TableCellCode>
                    <TableCellCode>{c.placa}</TableCellCode>
                    <TableCell><StatusPill variant={variantStatusCarga(c.statusCaminhao)} label={ROTULO_STATUS_CARGA[c.statusCaminhao]} /></TableCell>
                    <TableCellNum>{c.envio ? fmtDataHora(c.envio.dataHora) : '—'}</TableCellNum>
                    <TableCell className="text-muted-foreground">{c.envio?.responsavelNome ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground/70">—</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
