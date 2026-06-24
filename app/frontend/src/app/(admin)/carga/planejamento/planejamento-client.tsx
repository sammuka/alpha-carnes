'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, MapPin, MapPinned, MoveRight, Plus, Search, Truck } from 'lucide-react';
import type { PedidoVenda } from '@/lib/comercial';
import type { Caminhao, CaminhaoDetalhe } from '@/lib/operacao';
import { statusCaminhaoVariant } from '@/lib/status-ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusPill } from '@/components/ui/status-pill';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PlanejamentoExpedicaoClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);
  const [dataOperacao, setDataOperacao] = useState(() => new Date().toISOString().slice(0, 10));
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [detalhes, setDetalhes] = useState<CaminhaoDetalhe[]>([]);
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [caminhaoAlvo, setCaminhaoAlvo] = useState<string | null>(null);
  const [novoCaminhao, setNovoCaminhao] = useState({ placa: '', motorista: '', rota: '' });

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [resCam, resPed] = await Promise.all([
        fetch(`/api/operacao/expedicao/caminhoes?dataOperacao=${encodeURIComponent(dataOperacao)}`),
        fetch('/api/comercial/pedidos?pageSize=100'),
      ]);
      if (!resCam.ok || !resPed.ok) {
        setErro('Falha ao carregar dados');
        return;
      }
      const listaCam = (await resCam.json()) as Caminhao[];
      const pagPed = (await resPed.json()) as { data: PedidoVenda[] };
      setCaminhoes(listaCam);
      setPedidos(pagPed.data.filter((p) => p.dataOperacao === dataOperacao && p.status !== 'cancelado'));

      const detalhesCam = await Promise.all(
        listaCam.map(async (c) => {
          const r = await fetch(`/api/operacao/expedicao/caminhoes/${c.id}`);
          if (!r.ok) return null;
          return (await r.json()) as CaminhaoDetalhe;
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
      .filter((p) => !busca || p.id.includes(busca) || (p.rotaPrevista ?? '').toLowerCase().includes(busca.toLowerCase()));
  }, [pedidos, pedidosVinculados, busca]);

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

  const totalRotas = rotasAgrupadas.length;

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
      setCaminhaoAlvo(null);
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  async function criarCaminhao(e: React.FormEvent) {
    e.preventDefault();
    if (!novoCaminhao.placa || !novoCaminhao.motorista) return;
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/operacao/expedicao/caminhoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: novoCaminhao.placa,
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
      setNovoCaminhao({ placa: '', motorista: '', rota: '' });
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planejamento de Expedição</h1>
          <p className="text-sm text-muted-foreground">
            Montagem de carga e vínculo Pedido → Caminhão antes da operação
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="data-op">Data operação</Label>
            <Input
              id="data-op"
              type="date"
              value={dataOperacao}
              onChange={(e) => setDataOperacao(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {pode('EXPEDICAO_GERENCIAR') && (
        <form onSubmit={(e) => void criarCaminhao(e)} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
          <div>
            <Label htmlFor="placa">Placa</Label>
            <Input id="placa" value={novoCaminhao.placa} onChange={(e) => setNovoCaminhao((s) => ({ ...s, placa: e.target.value }))} />
          </div>
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
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label="Caminhões montados" value={caminhoes.length} variant="primary" Icon={Truck} />
            <KpiCard
              label="Pedidos sem caminhão"
              value={pedidosSemCaminhao.length}
              sub={pedidosSemCaminhao.length > 0 ? 'Aguardando vínculo' : 'Todos vinculados'}
              variant="warning"
              Icon={Layers}
            />
            <KpiCard label="Rotas pendentes" value={totalRotas} variant="violet" Icon={MapPinned} />
          </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
                <Layers className="h-4 w-4 text-muted-foreground" />
                Pedidos do Dia (Sem Caminhão)
              </h2>
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar…" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
            <div className="space-y-6 overflow-auto pr-2">
              {rotasAgrupadas.map(([rota, itens]) => (
                <div key={rota} className="space-y-3">
                  <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-bold text-primary">
                    <MapPin className="h-4 w-4" />
                    {rota}
                  </h3>
                  <div className="space-y-2">
                    {itens.map((pedido) => (
                      <Card key={pedido.id} className="transition-colors hover:border-primary/40">
                        <CardContent className="flex items-center justify-between p-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{pedido.id.slice(0, 8)}…</span>
                              <StatusPill variant="pendente" label="S/ Caminhão" />
                            </div>
                            <p className="text-xs text-muted-foreground">Prioridade {pedido.prioridade ?? '—'}</p>
                          </div>
                          {pode('EXPEDICAO_GERENCIAR') && caminhoes.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={submitting}
                              onClick={() => setCaminhaoAlvo(caminhaoAlvo === pedido.id ? null : pedido.id)}
                            >
                              <MoveRight className="h-5 w-5" />
                            </Button>
                          )}
                        </CardContent>
                        {caminhaoAlvo === pedido.id && (
                          <div className="flex flex-wrap gap-2 border-t px-3 py-2">
                            {caminhoes.map((c) => (
                              <Button
                                key={c.id}
                                size="sm"
                                variant="outline"
                                disabled={submitting}
                                onClick={() => void vincularPedido(c.id, pedido.id)}
                              >
                                {c.placa}
                              </Button>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
              {rotasAgrupadas.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum pedido pendente de vínculo.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Caminhões Montados
              </h2>
              <StatusPill variant="recebido" label={`${caminhoes.length} caminhões`} />
            </div>
            <div className="grid grid-cols-1 gap-3 overflow-auto pr-2 sm:grid-cols-2">
              {detalhes.map(({ caminhao, pedidos: peds }) => (
                <Card key={caminhao.id} className="bg-muted/30">
                  <CardHeader className="border-b bg-card px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Truck className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-sm">{caminhao.placa}</CardTitle>
                          <p className="truncate text-xs text-muted-foreground">
                            {caminhao.motorista} · {caminhao.rota ?? '—'}
                          </p>
                        </div>
                      </div>
                      <StatusPill
                        variant={statusCaminhaoVariant(caminhao.statusCaminhao)}
                        label={caminhao.statusCaminhao.replace(/_/g, ' ')}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5 p-2">
                    {peds.length === 0 && (
                      <p className="p-2 text-xs text-muted-foreground">Nenhum pedido vinculado.</p>
                    )}
                    {peds.map((p, idx) => (
                      <div key={p.pedidoVendaId} className="rounded-md border bg-card px-2 py-1.5 text-xs">
                        <span className="font-medium">{idx + 1}. </span>
                        {p.pedidoVendaId.slice(0, 8)}… · previsto {p.previsto} · carregado {p.carregado}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
