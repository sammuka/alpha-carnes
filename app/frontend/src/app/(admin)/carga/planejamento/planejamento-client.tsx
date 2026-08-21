'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft, CheckCircle2, ClipboardCheck, MapPin, PackageCheck, Plus, Search, Truck,
} from 'lucide-react';
import type { PedidoVenda } from '@/lib/comercial';
import type { Caminhao, CaminhaoDetalhe } from '@/lib/operacao';
import { ROTULO_STATUS_CARGA, rotuloPrioridade } from '@/lib/expedicao-ui';
import { mensagemDeErro } from '@/lib/error-message';
import { conectarRealtime } from '@/lib/realtime';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import { BadgeCount } from '@/components/ui/badge-count';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface Cliente {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
}

interface FrotaCaminhaoOpcao {
  id: string;
  placa: string;
  descricao: string | null;
  capacidadeKg: number;
  status: string;
}

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

async function lerJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export function PlanejamentoExpedicaoClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);
  const [dataOperacao] = useState(() => new Date().toISOString().slice(0, 10));
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [detalhes, setDetalhes] = useState<CaminhaoDetalhe[]>([]);
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [frotaOpcoes, setFrotaOpcoes] = useState<FrotaCaminhaoOpcao[]>([]);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalPedido, setModalPedido] = useState<PedidoVenda | null>(null);
  const [novoCaminhao, setNovoCaminhao] = useState({ frotaCaminhaoId: '', placa: '', motorista: '', rota: '' });

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [resCam, resPed, resCli, resFrota] = await Promise.all([
        fetch(`/api/operacao/expedicao/caminhoes?dataOperacao=${encodeURIComponent(dataOperacao)}`),
        fetch('/api/comercial/pedidos?pageSize=100'),
        fetch('/api/cadastros/clientes?pageSize=100'),
        fetch('/api/cadastros/frota-caminhoes?pageSize=100&status=ativo'),
      ]);
      if (!resCam.ok || !resPed.ok) {
        setErro('Falha ao carregar dados');
        return;
      }
      const listaCam = await lerJson<Caminhao[]>(resCam);
      const pagPed = await lerJson<{ data: PedidoVenda[] }>(resPed);
      setCaminhoes(listaCam);
      setPedidos(pagPed.data.filter((p) => p.status !== 'cancelado'));

      if (resCli.ok) {
        const pagCli = await lerJson<{ data: Cliente[] }>(resCli);
        setClientes(pagCli.data);
      }
      if (resFrota.ok) {
        const pagFrota = await lerJson<{ data: FrotaCaminhaoOpcao[] }>(resFrota);
        setFrotaOpcoes(pagFrota.data);
      }

      const detalhesCam = await Promise.all(
        listaCam.map(async (c) => {
          const r = await fetch(`/api/operacao/expedicao/caminhoes/${c.id}`);
          if (!r.ok) return null;
          return lerJson<CaminhaoDetalhe>(r);
        }),
      );
      setDetalhes(detalhesCam.filter(Boolean) as CaminhaoDetalhe[]);
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

  const pedidoPorId = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);

  const nomeCliente = useCallback(
    (clienteId: string) => {
      const c = clientes.find((cl) => cl.id === clienteId);
      return c ? c.nomeFantasia ?? c.razaoSocial : clienteId.slice(0, 8);
    },
    [clientes],
  );

  const pedidosVinculados = useMemo(() => {
    const ids = new Set<string>();
    for (const d of detalhes) {
      for (const p of d.pedidos) ids.add(p.pedidoVendaId);
    }
    return ids;
  }, [detalhes]);

  const pedidosSemCaminhao = useMemo(() => {
    return pedidos
      .filter((p) => !pedidosVinculados.has(p.id))
      .filter(
        (p) =>
          !busca ||
          p.id.toLowerCase().includes(busca.toLowerCase()) ||
          nomeCliente(p.clienteId).toLowerCase().includes(busca.toLowerCase()),
      );
  }, [pedidos, pedidosVinculados, busca, nomeCliente]);

  const rotasAgrupadas = useMemo(() => {
    const map = new Map<string, PedidoVenda[]>();
    for (const p of pedidosSemCaminhao) {
      const rota = p.rotaPrevista ?? 'Sem rota';
      const arr = map.get(rota) ?? [];
      arr.push(p);
      map.set(rota, arr);
    }
    return [...map.entries()];
  }, [pedidosSemCaminhao]);

  async function vincularPedido(caminhaoId: string, pedidoVendaId: string) {
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes/${caminhaoId}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoVendaId }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, 'Falha ao vincular pedido'));
        return;
      }
      setModalPedido(null);
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  async function criarCaminhao(e: React.FormEvent) {
    e.preventDefault();
    if (!novoCaminhao.motorista) return;
    if (!novoCaminhao.frotaCaminhaoId && !novoCaminhao.placa) return;
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/operacao/expedicao/caminhoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frotaCaminhaoId: novoCaminhao.frotaCaminhaoId || undefined,
          placa: novoCaminhao.frotaCaminhaoId ? undefined : novoCaminhao.placa,
          motorista: novoCaminhao.motorista,
          rota: novoCaminhao.rota || undefined,
          dataOperacao,
        }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, 'Falha ao criar caminhão'));
        return;
      }
      setNovoCaminhao({ frotaCaminhaoId: '', placa: '', motorista: '', rota: '' });
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  async function acaoCaminhao(url: string) {
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, 'Operação falhou'));
        return;
      }
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  async function enviarParaConferencia(caminhaoId: string) {
    await acaoCaminhao(`/api/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/iniciar`);
  }

  async function abrirCarga(caminhaoId: string) {
    await acaoCaminhao(`/api/operacao/expedicao/caminhoes/${caminhaoId}/abrir-carga`);
  }

  return (
    <div className="space-y-3">
      <PageHeader title="Planejamento de Expedição" subtitle="Montagem de carga e vínculo Pedido → Caminhão antes da operação">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/cadastros/rotas">
            <MapPin />
            Itinerários
          </Link>
        </Button>
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-md border border-danger-soft-border bg-danger-soft p-3 text-xs text-danger-fg">
          {erro}
        </div>
      )}

      {pode('EXPEDICAO_GERENCIAR') && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-2.5">
            <FormField label="Caminhão da frota" htmlFor="frota-caminhao" className="w-52">
              <SelectNative
                id="frota-caminhao"
                value={novoCaminhao.frotaCaminhaoId}
                onChange={(e) => setNovoCaminhao((s) => ({ ...s, frotaCaminhaoId: e.target.value }))}
              >
                <option value="">Avulso (placa manual)</option>
                {frotaOpcoes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.placa} · {f.capacidadeKg.toLocaleString('pt-BR')} kg
                  </option>
                ))}
              </SelectNative>
            </FormField>
            {!novoCaminhao.frotaCaminhaoId && (
              <FormField label="Placa" htmlFor="placa">
                <Input id="placa" value={novoCaminhao.placa} onChange={(e) => setNovoCaminhao((s) => ({ ...s, placa: e.target.value }))} />
              </FormField>
            )}
            <FormField label="Motorista" htmlFor="motorista">
              <Input id="motorista" value={novoCaminhao.motorista} onChange={(e) => setNovoCaminhao((s) => ({ ...s, motorista: e.target.value }))} />
            </FormField>
            <FormField label="Rota" htmlFor="rota">
              <Input id="rota" value={novoCaminhao.rota} onChange={(e) => setNovoCaminhao((s) => ({ ...s, rota: e.target.value }))} />
            </FormField>
            <Button type="button" disabled={submitting} onClick={(e) => void criarCaminhao(e)}>
              <Plus />
              Novo Caminhão
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {/* Coluna Esquerda: Pedidos do Dia (Sem Caminhão) */}
          <Card>
            <CardContent className="flex flex-col gap-1.5 p-2.5 pb-1.5">
              <Input adornLeft={<Search />} placeholder="Buscar pedido…" className="h-7 text-xs" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </CardContent>
            <div className="max-h-[560px] overflow-y-auto overflow-x-hidden p-2.5 pt-0">
              {rotasAgrupadas.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 />}
                  title="Todos os pedidos do dia já foram alocados a um caminhão."
                  className="py-12"
                />
              ) : (
                <div className="space-y-3">
                  {rotasAgrupadas.map(([rota, itens]) => (
                    <div key={rota} className="space-y-1.5">
                      <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                        <MapPin className="size-3.5" />
                        {rota}
                      </h4>
                      <div className="space-y-1.5">
                        {itens.map((pedido) => {
                          const prioridade = rotuloPrioridade(pedido.prioridade);
                          return (
                            <div
                              key={pedido.id}
                              className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5 text-xs"
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-semibold text-foreground">{nomeCliente(pedido.clienteId)}</span>
                                  <BadgeCount className="bg-warning-soft text-warning-fg">S/ Caminhão</BadgeCount>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                  <span className="font-data">{pedido.id.slice(0, 8)}…</span>
                                  <span title="Peso real apurado na pesagem">— kg</span>
                                  {prioridade && (
                                    <span
                                      className={cn(
                                        'font-bold uppercase',
                                        prioridade === 'ALTA' && 'text-destructive',
                                        prioridade === 'MÉDIA' && 'text-warning-fg',
                                        prioridade === 'BAIXA' && 'text-success-fg',
                                      )}
                                    >
                                      Prioridade {prioridade}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {pode('EXPEDICAO_GERENCIAR') && caminhoes.length > 0 && (
                                <Button size="sm" disabled={submitting} onClick={() => setModalPedido(pedido)}>
                                  <ArrowRightLeft />
                                  Alocar
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Coluna Direita: Caminhões Montados */}
          <Card>
            <CardContent className="flex items-center justify-between p-2.5">
              <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                <Truck className="size-3.5" />
                Caminhões Montados
              </h3>
              <BadgeCount>{caminhoes.length} Caminhão{caminhoes.length !== 1 ? 'ões' : ''}</BadgeCount>
            </CardContent>
            <div className="max-h-[560px] space-y-2.5 overflow-y-auto overflow-x-hidden p-2.5 pt-0">
              {detalhes.map(({ caminhao, pedidos: peds }) => {
                const pronto = caminhao.statusCaminhao === 'em_conferencia';
                const capacidade = caminhao.capacidadeKg;
                const pesoCarregado = Number(caminhao.pesoCarregadoKg);
                const ocupacao = capacidade ? Math.min(100, Math.round((pesoCarregado / capacidade) * 100)) : null;

                return (
                  <div key={caminhao.id} className="overflow-hidden rounded-md border border-border">
                    <div className="border-b border-border bg-surface-2 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-data text-[13px] font-bold text-foreground">{caminhao.placa}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {caminhao.motorista} · {caminhao.rota ?? '—'}
                          </p>
                        </div>
                        <StatusPill
                          variant={pronto ? 'expedido' : 'pendente'}
                          label={ROTULO_STATUS_CARGA[caminhao.statusCaminhao]}
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {peds.length} pedido{peds.length !== 1 ? 's' : ''}
                          {capacidade
                            ? ` · ${pesoCarregado.toFixed(1)} / ${capacidade.toLocaleString('pt-BR')} kg`
                            : ' · — kg'}
                        </span>
                        {capacidade && (
                          <>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                              <div
                                className={cn(
                                  'h-full rounded-full bg-primary',
                                  (ocupacao ?? 0) > 90 && 'bg-warning',
                                  (ocupacao ?? 0) >= 100 && 'bg-destructive',
                                )}
                                style={{ width: `${ocupacao}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-[11px] font-bold text-foreground">{ocupacao}%</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 p-2">
                      {peds.length === 0 ? (
                        <div className="flex items-center justify-center rounded-md border border-dashed border-border-strong p-3 text-[11px] text-muted-foreground">
                          Nenhum pedido alocado. Use &quot;Alocar&quot; na lista à esquerda.
                        </div>
                      ) : (
                        peds.map((p, idx) => {
                          const pedidoOriginal = pedidoPorId.get(p.pedidoVendaId);
                          return (
                            <div key={p.pedidoVendaId} className="flex items-center gap-2.5 rounded-md border border-border bg-surface-2 p-2 text-xs">
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 font-data text-[10px] font-bold text-muted-foreground">
                                {idx + 1}
                              </span>
                              <div>
                                <p className="font-semibold text-foreground">
                                  {pedidoOriginal ? nomeCliente(pedidoOriginal.clienteId) : p.pedidoVendaId.slice(0, 8)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  <span className="font-data">{p.pedidoVendaId.slice(0, 8)}…</span> · previsto {p.previsto} · carregado {p.carregado}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {peds.length > 0 && (
                      <div className="px-2 pb-2">
                        {pronto ? (
                          <div className="flex items-center gap-2 rounded-md border border-success-soft-border bg-success-soft px-3 py-2">
                            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success-fg" />
                            <p className="text-xs text-success-fg">
                              Pronto para conferência. Aguardando início da carga.
                            </p>
                          </div>
                        ) : caminhao.statusCaminhao === 'planejado' || caminhao.statusCaminhao === 'aguardando_carga' ? (
                          <Button
                            className="w-full"
                            size="sm"
                            disabled={submitting}
                            onClick={() => void abrirCarga(caminhao.id)}
                          >
                            Abrir carga
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            size="sm"
                            disabled={submitting}
                            onClick={() => void enviarParaConferencia(caminhao.id)}
                          >
                            <PackageCheck />
                            Enviar para conferência
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {caminhoes.length === 0 && (
                <EmptyState icon={<ClipboardCheck />} title="Nenhum caminhão montado ainda." className="py-12" />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Modal Alocar */}
      <Dialog open={!!modalPedido} onOpenChange={(v) => { if (!v) setModalPedido(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alocar pedido a um caminhão</DialogTitle>
          </DialogHeader>
          {modalPedido && (
            <>
              <div className="rounded-lg bg-surface-2 p-3 text-xs">
                <p className="font-bold text-foreground">{nomeCliente(modalPedido.clienteId)}</p>
                <p className="mt-0.5 text-muted-foreground">
                  <span className="font-data">{modalPedido.id.slice(0, 8)}…</span> · {modalPedido.rotaPrevista ?? 'Sem rota'}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                {caminhoes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum caminhão disponível. Crie um novo caminhão primeiro.
                  </p>
                ) : (
                  caminhoes.map((c) => {
                    const detalhe = detalhes.find((d) => d.caminhao.id === c.id);
                    const nPedidos = detalhe?.pedidos.length ?? 0;
                    const capacidade = c.capacidadeKg;
                    const pesoCarregado = detalhe ? Number(detalhe.caminhao.pesoCarregadoKg) : 0;
                    const ocupacao = capacidade ? Math.min(100, Math.round((pesoCarregado / capacidade) * 100)) : null;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={submitting}
                        onClick={() => void vincularPedido(c.id, modalPedido.id)}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-left transition-colors duration-100 hover:border-primary hover:bg-primary-soft"
                      >
                        <div>
                          <p className="font-data text-[13px] font-bold text-foreground">{c.placa}</p>
                          <p className="text-xs text-muted-foreground">{c.motorista}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-foreground">
                            {nPedidos} pedido{nPedidos !== 1 ? 's' : ''}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {ocupacao === null ? '—' : `${ocupacao}% ocupado`}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
