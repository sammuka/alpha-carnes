'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, Search, Truck } from 'lucide-react';
import type { Caminhao, CaminhaoDetalhe, StatusCaminhao } from '@/lib/operacao';
import { statusCaminhaoVariant } from '@/lib/status-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FILTROS = [
  { id: 'todos', label: 'Todas' },
  { id: 'em_carga', label: 'Carregando' },
  { id: 'em_conferencia', label: 'Conferência' },
  { id: 'fechado', label: 'Fechadas' },
] as const;

function rotuloStatusCaminhao(status: StatusCaminhao): string {
  return status.replace(/_/g, ' ');
}

export function ConferenciaExpedicaoClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);
  const [dataOperacao] = useState(() => new Date().toISOString().slice(0, 10));
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [selecionado, setSelecionado] = useState<CaminhaoDetalhe | null>(null);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['id']>('todos');
  const [busca, setBusca] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const carregarLista = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes?dataOperacao=${encodeURIComponent(dataOperacao)}`);
      if (!res.ok) {
        setErro('Falha ao carregar cargas');
        return;
      }
      setCaminhoes((await res.json()) as Caminhao[]);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [dataOperacao]);

  const carregarDetalhe = useCallback(async (id: string) => {
    setErro(null);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes/${id}`);
      if (!res.ok) {
        setErro('Falha ao carregar detalhe da carga');
        return;
      }
      setSelecionado((await res.json()) as CaminhaoDetalhe);
    } catch {
      setErro('Erro de conexão');
    }
  }, []);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  const listaFiltrada = useMemo(() => {
    return caminhoes.filter((c) => {
      if (filtro !== 'todos' && c.statusCaminhao !== filtro) return false;
      if (busca && !c.placa.toLowerCase().includes(busca.toLowerCase()) && !c.motorista.toLowerCase().includes(busca.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [caminhoes, filtro, busca]);

  async function acao(url: string, body?: object) {
    if (!selecionado) return;
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Operação falhou');
        return;
      }
      await carregarLista();
      await carregarDetalhe(selecionado.caminhao.id);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  const cam = selecionado?.caminhao;
  const totalPrevisto = selecionado?.pedidos.reduce((s, p) => s + p.previsto, 0) ?? 0;
  const totalCarregado = selecionado?.pedidos.reduce((s, p) => s + p.carregado, 0) ?? 0;

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Expedição de Cargas</h1>
        <p className="text-sm text-muted-foreground">Gerenciamento de docas e conferência</p>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col overflow-hidden rounded-lg border bg-card lg:col-span-4">
          <div className="space-y-3 border-b p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar placa ou motorista…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTROS.map((f) => (
                <Badge
                  key={f.id}
                  variant={filtro === f.id ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setFiltro(f.id)}
                >
                  {f.label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-2">
            {loading && <p className="p-2 text-sm text-muted-foreground">Carregando…</p>}
            {!loading &&
              listaFiltrada.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void carregarDetalhe(c.id)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    selecionado?.caminhao.id === c.id ? 'border-primary bg-primary/5' : 'hover:border-primary/30'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{c.placa}</span>
                    <StatusPill
                      variant={statusCaminhaoVariant(c.statusCaminhao)}
                      label={rotuloStatusCaminhao(c.statusCaminhao)}
                    />
                  </div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Truck className="h-3 w-3" />
                    {c.motorista}
                  </p>
                </button>
              ))}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-lg border bg-card lg:col-span-8">
          {!cam ? (
            <p className="p-8 text-sm text-muted-foreground">Selecione uma carga para ver os detalhes.</p>
          ) : (
            <>
              <div className="space-y-4 border-b p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h2 className="text-xl font-bold">{cam.placa}</h2>
                      <StatusPill
                        variant={statusCaminhaoVariant(cam.statusCaminhao)}
                        label={rotuloStatusCaminhao(cam.statusCaminhao)}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">Motorista: {cam.motorista}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pode('EXPEDICAO_GERENCIAR') && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/operacao/expedicao/caminhoes/${cam.id}/romaneio`} target="_blank" rel="noreferrer">
                          <FileText className="mr-2 h-4 w-4" />
                          Romaneio
                        </a>
                      </Button>
                    )}
                    {pode('EXPEDICAO_GERENCIAR') && cam.statusCaminhao === 'em_carga' && (
                      <Button size="sm" disabled={submitting} onClick={() => void acao(`/api/operacao/expedicao/caminhoes/${cam.id}/conferencia/iniciar`)}>
                        Iniciar Conferência
                      </Button>
                    )}
                    {pode('EXPEDICAO_GERENCIAR') && cam.statusCaminhao === 'em_conferencia' && (
                      <Button size="sm" disabled={submitting} onClick={() => void acao(`/api/operacao/expedicao/caminhoes/${cam.id}/conferencia/concluir`)}>
                        Concluir Conferência
                      </Button>
                    )}
                    {pode('EXPEDICAO_GERENCIAR') && cam.statusCaminhao === 'em_conferencia' && (
                      <Button size="sm" variant="default" disabled={submitting} onClick={() => void acao(`/api/operacao/expedicao/caminhoes/${cam.id}/fechar`, { forcado: false })}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Fechar Expedição
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Pedidos</p>
                    <p className="text-lg font-bold">{selecionado?.pedidos.length ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Previsto</p>
                    <p className="text-lg font-bold">{totalPrevisto}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Carregado</p>
                    <p className="text-lg font-bold text-primary">{totalCarregado}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Progresso</p>
                    <p className="text-lg font-bold">
                      {totalPrevisto > 0 ? Math.round((totalCarregado / totalPrevisto) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>

              {pode('EXPEDICAO_GERENCIAR') && cam.statusCaminhao === 'em_conferencia' && (
                <div className="border-b p-4">
                  <Label htmlFor="codigo-bip">Código QR (conferência manual)</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="codigo-bip"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      placeholder="Código da peça/subitem"
                    />
                    <Button
                      disabled={submitting || !codigo.trim()}
                      onClick={() =>
                        void acao(`/api/operacao/expedicao/caminhoes/${cam.id}/conferencia/registrar-item`, {
                          tipoOrigem: 'peca',
                          modoCaptura: 'manual_assistido',
                          codigo: codigo.trim(),
                        }).then(() => setCodigo(''))
                      }
                    >
                      Registrar
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-auto p-6">
                <h3 className="mb-4 text-sm font-semibold">Pedidos Roteirizados</h3>
                <div className="space-y-3">
                  {selecionado?.pedidos.map((p) => (
                    <div key={p.pedidoVendaId} className="rounded-lg border p-4">
                      <p className="font-medium">{p.pedidoVendaId.slice(0, 8)}…</p>
                      <p className="text-xs text-muted-foreground">
                        Carregado {p.carregado} / {p.previsto} itens
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
