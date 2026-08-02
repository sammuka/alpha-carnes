'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft, CheckCircle2, ClipboardCheck, Layers, MapPin, PackageCheck, Plus, Search, Truck,
} from 'lucide-react';
import type { PedidoVenda } from '@/lib/comercial';
import type { Caminhao, CaminhaoDetalhe } from '@/lib/operacao';
import { ROTULO_STATUS_CARGA, rotuloPrioridade } from '@/lib/expedicao-ui';
import { conectarRealtime } from '@/lib/realtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Falha ao vincular pedido');
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Falha ao criar caminhão');
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Operação falhou');
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
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Planejamento de Expedição</h2>
          <p className="text-sm text-muted-foreground">
            Montagem de carga e vínculo Pedido → Caminhão antes da operação
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/cadastros/rotas">
            <MapPin className="mr-2 h-4 w-4" />
            Itinerários
          </Link>
        </Button>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {pode('EXPEDICAO_GERENCIAR') && (
        <form onSubmit={(e) => void criarCaminhao(e)} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
          <div>
            <Label htmlFor="frota-caminhao">Caminhão da frota</Label>
            <Select
              value={novoCaminhao.frotaCaminhaoId || 'avulso'}
              onValueChange={(v) => setNovoCaminhao((s) => ({ ...s, frotaCaminhaoId: v === 'avulso' ? '' : v }))}
            >
              <SelectTrigger id="frota-caminhao" className="w-52">
                <SelectValue placeholder="Selecionar…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="avulso">Avulso (placa manual)</SelectItem>
                {frotaOpcoes.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.placa} · {f.capacidadeKg.toLocaleString('pt-BR')} kg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!novoCaminhao.frotaCaminhaoId && (
            <div>
              <Label htmlFor="placa">Placa</Label>
              <Input id="placa" value={novoCaminhao.placa} onChange={(e) => setNovoCaminhao((s) => ({ ...s, placa: e.target.value }))} />
            </div>
          )}
          <div>
            <Label htmlFor="motorista">Motorista</Label>
            <Input id="motorista" value={novoCaminhao.motorista} onChange={(e) => setNovoCaminhao((s) => ({ ...s, motorista: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="rota">Rota</Label>
            <Input id="rota" value={novoCaminhao.rota} onChange={(e) => setNovoCaminhao((s) => ({ ...s, rota: e.target.value }))} />
          </div>
          <Button type="submit" disabled={submitting}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Caminhão
          </Button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Coluna Esquerda: Pedidos do Dia (Sem Caminhão) */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
                <Layers className="h-4 w-4 text-muted-foreground" />
                Pedidos do Dia (Sem Caminhão)
              </h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar pedido…" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
            <div className="flex-1 space-y-6 overflow-auto pr-2">
              {rotasAgrupadas.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card py-16">
                  <CheckCircle2 className="h-8 w-8 text-emerald-300" />
                  <p className="text-sm text-muted-foreground">
                    Todos os pedidos do dia já foram alocados a um caminhão.
                  </p>
                </div>
              ) : (
                rotasAgrupadas.map(([rota, itens]) => (
                  <div key={rota} className="space-y-3">
                    <h4 className="flex items-center gap-2 border-b pb-2 text-sm font-bold text-primary">
                      <MapPin className="h-4 w-4" />
                      {rota}
                    </h4>
                    <div className="space-y-2">
                      {itens.map((pedido) => {
                        const prioridade = rotuloPrioridade(pedido.prioridade);
                        return (
                          <div
                            key={pedido.id}
                            className="flex items-center justify-between rounded-xl border bg-card p-3 transition-colors hover:border-primary/40"
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground">{nomeCliente(pedido.clienteId)}</span>
                                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                                  S/ Caminhão
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{pedido.id.slice(0, 8)}…</span>
                                <span title="Peso real apurado na pesagem">— kg</span>
                                {prioridade && (
                                  <span
                                    className={
                                      prioridade === 'ALTA'
                                        ? 'font-bold uppercase text-destructive'
                                        : prioridade === 'MÉDIA'
                                          ? 'font-bold uppercase text-amber-600'
                                          : 'font-bold uppercase text-emerald-600'
                                    }
                                  >
                                    Prioridade {prioridade}
                                  </span>
                                )}
                              </div>
                            </div>
                            {pode('EXPEDICAO_GERENCIAR') && caminhoes.length > 0 && (
                              <Button size="sm" disabled={submitting} onClick={() => setModalPedido(pedido)}>
                                <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                                Alocar
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Coluna Direita: Caminhões Montados */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Caminhões Montados
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {caminhoes.length} {caminhoes.length === 1 ? 'Caminhão' : 'Caminhões'}
              </span>
            </div>
            <div className="flex-1 space-y-4 overflow-auto pr-2">
              {detalhes.map(({ caminhao, pedidos: peds }) => {
                const pronto = caminhao.statusCaminhao === 'em_conferencia';
                const capacidade = caminhao.capacidadeKg;
                const pesoCarregado = Number(caminhao.pesoCarregadoKg);
                const ocupacao = capacidade ? Math.min(100, Math.round((pesoCarregado / capacidade) * 100)) : null;

                return (
                  <div key={caminhao.id} className="overflow-hidden rounded-xl border bg-card">
                    <div className="border-b bg-muted/30 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Truck className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{caminhao.placa}</p>
                            <p className="text-xs text-muted-foreground">
                              {caminhao.motorista} · {caminhao.rota ?? '—'}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            pronto ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${pronto ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {ROTULO_STATUS_CARGA[caminhao.statusCaminhao]}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {peds.length} pedido{peds.length !== 1 ? 's' : ''}
                          {capacidade
                            ? ` · ${pesoCarregado.toFixed(1)} / ${capacidade.toLocaleString('pt-BR')} kg`
                            : ' · — kg'}
                        </span>
                        {capacidade && (
                          <>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full ${(ocupacao ?? 0) >= 100 ? 'bg-destructive' : 'bg-primary'}`}
                                style={{ width: `${ocupacao}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-xs font-bold text-foreground">{ocupacao}%</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 p-3">
                      {peds.length === 0 ? (
                        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-4 text-xs text-muted-foreground">
                          Nenhum pedido alocado. Use &quot;Alocar&quot; na lista à esquerda.
                        </div>
                      ) : (
                        peds.map((p, idx) => {
                          const pedidoOriginal = pedidoPorId.get(p.pedidoVendaId);
                          return (
                            <div key={p.pedidoVendaId} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2.5 text-xs">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                                {idx + 1}
                              </span>
                              <div>
                                <p className="font-bold text-foreground">
                                  {pedidoOriginal ? nomeCliente(pedidoOriginal.clienteId) : p.pedidoVendaId.slice(0, 8)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {p.pedidoVendaId.slice(0, 8)}… · previsto {p.previsto} · carregado {p.carregado}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {peds.length > 0 && (
                      <div className="px-3 pb-3">
                        {pronto ? (
                          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                            <p className="text-xs text-emerald-900">
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
                            className="w-full bg-emerald-700 hover:bg-emerald-800"
                            size="sm"
                            disabled={submitting}
                            onClick={() => void enviarParaConferencia(caminhao.id)}
                          >
                            <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
                            Enviar para conferência
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {caminhoes.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card py-16">
                  <ClipboardCheck className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nenhum caminhão montado ainda.</p>
                </div>
              )}
            </div>
          </div>
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
              <div className="rounded-lg bg-muted/30 p-3 text-xs">
                <p className="font-bold text-foreground">{nomeCliente(modalPedido.clienteId)}</p>
                <p className="mt-0.5 text-muted-foreground">
                  {modalPedido.id.slice(0, 8)}… · {modalPedido.rotaPrevista ?? 'Sem rota'}
                </p>
              </div>
              <div className="flex flex-col gap-2">
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
                        className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Truck className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{c.placa}</p>
                            <p className="text-xs text-muted-foreground">{c.motorista}</p>
                          </div>
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
