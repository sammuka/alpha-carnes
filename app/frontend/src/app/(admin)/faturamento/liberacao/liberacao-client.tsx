'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Search, Truck } from 'lucide-react';
import type { StatusCaminhao } from '@/lib/operacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CaminhaoLiberacao {
  id: string;
  placa: string;
  motorista: string;
  rota: string | null;
  statusCaminhao: StatusCaminhao;
  dataOperacao: string;
  statusFaturamento: string | null;
}

export function LiberacaoCaminhaoClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);
  const [dataOperacao] = useState(() => new Date().toISOString().slice(0, 10));
  const [lista, setLista] = useState<CaminhaoLiberacao[]>([]);
  const [selecionado, setSelecionado] = useState<CaminhaoLiberacao | null>(null);
  const [busca, setBusca] = useState('');
  const [checklist, setChecklist] = useState({ danfe: false, canhoto: false, seguro: false, temperatura: false });
  const [lacre, setLacre] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacao/expedicao/liberacao?dataOperacao=${encodeURIComponent(dataOperacao)}`);
      if (!res.ok) {
        setErro('Falha ao carregar veículos');
        return;
      }
      const data = (await res.json()) as CaminhaoLiberacao[];
      setLista(data);
      setSelecionado((atual) => (atual ? data.find((c) => c.id === atual.id) ?? null : null));
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [dataOperacao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    return lista.filter(
      (c) =>
        !busca ||
        c.placa.toLowerCase().includes(busca.toLowerCase()) ||
        c.motorista.toLowerCase().includes(busca.toLowerCase()),
    );
  }, [lista, busca]);

  const pronto =
    checklist.danfe &&
    checklist.canhoto &&
    checklist.seguro &&
    checklist.temperatura &&
    lacre.trim().length > 0;

  async function liberarSaida() {
    if (!selecionado || !pronto) return;
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes/${selecionado.id}/liberar-saida`, {
        method: 'POST',
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Falha ao liberar saída');
        return;
      }
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  function statusBadge(c: CaminhaoLiberacao) {
    if (c.statusCaminhao === 'faturado' && c.statusFaturamento === 'concluido') {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">PRONTO</Badge>;
    }
    if (c.statusCaminhao === 'liberado_saida') {
      return <Badge variant="outline">LIBERADO</Badge>;
    }
    return <Badge variant="secondary">PENDENTE</Badge>;
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Liberação de Caminhão (Portaria)</h1>
          <p className="text-sm text-muted-foreground">Conferência final de documentos e liberação de saída</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="min-w-[250px] pl-9" placeholder="Buscar placa…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardContent className="flex h-full flex-col gap-4 p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Truck className="h-5 w-5 text-primary" />
              Veículos no Pátio
            </h2>
            <div className="flex-1 space-y-3 overflow-auto">
              {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {filtrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelecionado(c)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    selecionado?.id === c.id ? 'border-primary bg-primary/5' : 'hover:border-primary/30'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <Badge variant="outline" className="font-mono">
                      {c.placa}
                    </Badge>
                    {statusBadge(c)}
                  </div>
                  <p className="font-semibold">{c.motorista}</p>
                  <p className="text-xs text-muted-foreground">{c.rota ?? '—'}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col lg:col-span-8">
          {!selecionado ? (
            <CardContent className="p-8 text-sm text-muted-foreground">Selecione um veículo.</CardContent>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 p-6">
                <div>
                  <h2 className="text-xl font-bold">
                    {selecionado.motorista} — {selecionado.placa}
                  </h2>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selecionado.statusCaminhao.replace(/_/g, ' ')} · Faturamento:{' '}
                    {selecionado.statusFaturamento?.replace(/_/g, ' ') ?? '—'}
                  </p>
                </div>
                {statusBadge(selecionado)}
              </div>
              <CardContent className="flex flex-1 flex-col gap-6 overflow-auto p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4 rounded-lg border p-5">
                    <h3 className="flex items-center gap-2 text-sm font-bold uppercase">
                      <FileText className="h-4 w-4 text-primary" />
                      Checklist de Documentos
                    </h3>
                    {(
                      [
                        ['danfe', 'DANFEs entregues ao motorista'],
                        ['canhoto', 'Canhoto assinado da transportadora'],
                        ['seguro', 'Averbação de seguro validada'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={checklist[key]}
                          onCheckedChange={(v) => setChecklist((s) => ({ ...s, [key]: v === true }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="space-y-4 rounded-lg border p-5">
                    <h3 className="flex items-center gap-2 text-sm font-bold uppercase">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Lacre e Segurança
                    </h3>
                    <div>
                      <Label htmlFor="lacre">Número do lacre</Label>
                      <Input id="lacre" value={lacre} onChange={(e) => setLacre(e.target.value)} className="mt-1" />
                    </div>
                    <label className="flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={checklist.temperatura}
                        onCheckedChange={(v) => setChecklist((s) => ({ ...s, temperatura: v === true }))}
                      />
                      Temperatura aferida na saída
                    </label>
                  </div>
                </div>
                {pode('FATURAMENTO_GERENCIAR') || pode('EXPEDICAO_GERENCIAR') ? (
                  <div className="mt-auto flex justify-end border-t pt-6">
                    <Button
                      className="gap-2"
                      disabled={
                        submitting ||
                        !pronto ||
                        selecionado.statusCaminhao !== 'faturado' ||
                        selecionado.statusFaturamento !== 'concluido'
                      }
                      onClick={() => void liberarSaida()}
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      {submitting ? 'Liberando…' : 'Confirmar Liberação na Cancelas'}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
