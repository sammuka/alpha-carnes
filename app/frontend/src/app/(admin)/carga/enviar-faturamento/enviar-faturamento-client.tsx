'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Clock, FileText, Lock, PackageCheck, Search, Truck, User,
} from 'lucide-react';
import type { CargaEnvio } from '@/lib/expedicao-ui';
import { ROTULO_STATUS_CARGA } from '@/lib/expedicao-ui';
import type { StatusCaminhao } from '@/lib/operacao';
import { conectarRealtime } from '@/lib/realtime';
import { PipelineBar } from '@/components/ui/pipeline-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <div className="flex h-full flex-col gap-6">
      <PipelineBar
        etapaAtual="Carga"
        contadores={{ carga: `${emAndamento} Carga${emAndamento !== 1 ? 's' : ''} pendente${emAndamento !== 1 ? 's' : ''}` }}
      />

      <div>
        <p className="mb-0.5 text-xs font-medium text-muted-foreground">Carga / Enviar para Faturamento</p>
        <h1 className="text-xl font-bold text-foreground">Enviar para Faturamento</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Cargas conferidas são liberadas para o faturamento consolidar e emitir a NFS-e.
        </p>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Master */}
        <div className="flex flex-col overflow-hidden rounded-xl border bg-card lg:col-span-4">
          <div className="flex flex-col gap-3 border-b p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por carga, placa ou cliente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {FILTROS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    filtro === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {rotuloFiltro(f)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-2">
            {loading && <p className="p-2 text-sm text-muted-foreground">Carregando…</p>}
            {!loading && cargasFiltradas.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <PackageCheck className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-center text-sm text-muted-foreground">Nenhuma carga encontrada com este filtro.</p>
              </div>
            )}
            {!loading &&
              cargasFiltradas.map((c) => {
                const selecionada = c.id === cargaAtivaId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCargaAtivaId(c.id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selecionada ? 'border-primary/40 bg-primary/5' : 'hover:border-primary/30'
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <span className="text-sm font-bold text-foreground">Carga #{c.id.slice(0, 8)}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {ROTULO_STATUS_CARGA[c.statusCaminhao]}
                      </span>
                    </div>
                    <div className="mb-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> {c.placa}</span>
                      <span>·</span>
                      <span>{c.rota ?? '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {c.totalClientes} cliente{c.totalClientes !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">
                        {c.totalPecas} peças · {fmtKg(c.pesoTotal)}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Detail */}
        <div className="flex flex-col overflow-hidden rounded-xl border bg-card lg:col-span-8">
          {!carga ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <PackageCheck className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Selecione uma carga para visualizar os detalhes.</p>
            </div>
          ) : (
            <>
              <div className="border-b p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-3">
                      <h2 className="text-lg font-bold text-foreground">Carga #{carga.id.slice(0, 8)}</h2>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {rotuloCarga}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Truck className="h-4 w-4" /> Placa: {carga.placa}</span>
                      <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> Motorista: {carga.motorista}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {carga.rota ?? '—'}</span>
                    </div>
                  </div>
                  {pode('EXPEDICAO_GERENCIAR') || pode('FATURAMENTO_GERENCIAR') ? (
                    <Button
                      disabled={rotuloCarga !== 'Conferida' || submitting}
                      title={rotuloCarga !== 'Conferida' ? 'Somente cargas com status Conferida podem ser enviadas ao faturamento.' : undefined}
                      className="shrink-0 bg-emerald-700 hover:bg-emerald-800"
                      onClick={() => void enviarParaFaturamento()}
                    >
                      <PackageCheck className="mr-1.5 h-4 w-4" />
                      Enviar para Faturamento
                    </Button>
                  ) : null}
                </div>

                <div className="grid grid-cols-4 gap-4 rounded-lg border bg-muted/30 p-4">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Pedidos</p>
                    <p className="text-lg font-bold text-foreground">{carga.pedidos.length}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Clientes</p>
                    <p className="text-lg font-bold text-foreground">{carga.totalClientes}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Peças</p>
                    <p className="text-lg font-bold text-primary">{carga.totalPecas}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Peso Total</p>
                    <p className="text-lg font-bold text-foreground">{fmtKg(carga.pesoTotal)}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs leading-snug text-amber-900">
                    Ao enviar para faturamento, a carga entra no marco de fechamento: estornos simples deixam de
                    ocorrer e qualquer alteração exige reabertura autorizada pela gestão.
                  </p>
                </div>

                {rotuloCarga === 'Enviada para Faturamento' || rotuloCarga === 'Faturada' ? (
                  <div className="mt-3 flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
                    <p className="text-xs leading-snug text-violet-900">
                      {rotuloCarga === 'Faturada' ? 'Carga faturada.' : 'Carga já enviada ao faturamento.'}
                      {carga.envio && (
                        <> Enviada em {fmtDataHora(carga.envio.dataHora)} por {carga.envio.responsavelNome ?? '—'}.</>
                      )}
                    </p>
                  </div>
                ) : rotuloCarga === 'Em Conferência' ? (
                  <div className="mt-3 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                    <p className="text-xs leading-snug text-blue-900">
                      Esta carga ainda está em conferência. Finalize a bipagem das peças na tela de Conferência de
                      Carga antes de enviar para faturamento.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="mb-4 text-sm font-bold text-foreground">Pedidos, Clientes e Peças</h3>
                <div className="space-y-4">
                  {carga.pedidos.map((pedido) => (
                    <div key={pedido.pedidoVendaId} className="overflow-hidden rounded-lg border">
                      <div className="flex items-center justify-between bg-muted/30 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{pedido.clienteNome ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">Pedido {pedido.pedidoVendaId.slice(0, 8)}…</p>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{pedido.pecas.length} peças</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            <th className="px-4 py-2">Etiqueta</th>
                            <th className="px-4 py-2">Produto</th>
                            <th className="px-4 py-2 text-right">Peso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {pedido.pecas.map((peca, idx) => (
                            <tr key={`${pedido.pedidoVendaId}-${idx}`}>
                              <td className="px-4 py-2 font-mono text-xs font-bold text-primary">{peca.etiqueta ?? '—'}</td>
                              <td className="px-4 py-2 text-foreground">{peca.produtoNome}</td>
                              <td className="px-4 py-2 text-right font-mono text-muted-foreground">{fmtKg(peca.peso)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Histórico de Envios */}
      <div className="shrink-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">Histórico de Envios</p>
        </div>
        {historico.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhum envio registrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {['Carga', 'Placa', 'Status', 'Data/Hora', 'Responsável', 'Observação'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-bold text-primary">#{c.id.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{c.placa}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {ROTULO_STATUS_CARGA[c.statusCaminhao]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.envio ? fmtDataHora(c.envio.dataHora) : '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.envio?.responsavelNome ?? '—'}</td>
                  <td className="max-w-[260px] truncate px-4 py-2.5 text-muted-foreground/70">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
