'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  Plus,
  RefreshCw,
  Search,
  Truck,
} from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import {
  TIPOS_DIVERGENCIA,
  type PaginadoRecebimento,
  type RecebimentoDetalhe,
  type RecebimentoResumo,
  type TipoDivergencia,
} from '@/lib/operacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CompraProgramada, Paginado } from '@/lib/comercial';

interface FormDivergencia {
  tipo: TipoDivergencia;
  descricao: string;
  acaoImediata: string;
}

const STATUS_RECEB: Record<string, { label: string; className: string }> = {
  em_andamento: { label: 'Em conferência', className: 'bg-blue-50 text-blue-700' },
  com_divergencia: { label: 'Com divergência', className: 'bg-amber-50 text-amber-700' },
  concluido: { label: 'Finalizado', className: 'bg-green-50 text-green-700' },
};

export function RecebimentoCargaClient({ permissoes }: { permissoes: string[] }) {
  const podeLer = permissoes.includes('RECEBIMENTO_LER');
  const podeGerenciar = permissoes.includes('RECEBIMENTO_GERENCIAR');

  const [lista, setLista] = useState<RecebimentoResumo[]>([]);
  const [compras, setCompras] = useState<CompraProgramada[]>([]);
  const [busca, setBusca] = useState('');
  const [sheetAberto, setSheetAberto] = useState(false);
  const [novoCompraId, setNovoCompraId] = useState('');

  const [recebimentoId, setRecebimentoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<RecebimentoDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [divergencias, setDivergencias] = useState<Record<string, FormDivergencia>>({});

  const carregarLista = useCallback(async () => {
    if (!podeLer) return;
    const res = await fetch('/api/operacao/recebimentos?pageSize=50', { cache: 'no-store' });
    if (res.ok) {
      const pag = (await res.json()) as PaginadoRecebimento;
      setLista(pag.data);
    }
  }, [podeLer]);

  const carregarCompras = useCallback(async () => {
    const res = await fetch('/api/comercial/compras-programadas?pageSize=20', { cache: 'no-store' });
    if (res.ok) {
      const pag = (await res.json()) as Paginado<CompraProgramada>;
      setCompras(pag.data.filter((c) => c.status === 'confirmada'));
    }
  }, []);

  const carregarDetalhe = useCallback(async (id: string) => {
    setErro(null);
    const res = await fetch(`/api/operacao/recebimentos/${id}`, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro((body as { message?: string }).message ?? 'Erro ao carregar recebimento');
      return;
    }
    setDetalhe((await res.json()) as RecebimentoDetalhe);
    setRecebimentoId(id);
  }, []);

  useEffect(() => {
    void carregarLista();
    void carregarCompras();
  }, [carregarLista, carregarCompras]);

  useEffect(() => {
    if (!detalhe) return;
    const onMessage = (msg: RealtimeMensagem) => {
      if (
        msg.type === 'recebimento_registrado' ||
        msg.type === 'divergencia_recebimento_aberta' ||
        msg.type === 'divergencia_recebimento_atualizada'
      ) {
        if (recebimentoId) void carregarDetalhe(recebimentoId);
        void carregarLista();
      }
    };
    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${detalhe.dataOperacao}`],
      onMessage,
      onReconnect: () => {
        if (recebimentoId) void carregarDetalhe(recebimentoId);
        void carregarLista();
      },
      onStatus: setStatus,
    });
    return desconectar;
  }, [detalhe, recebimentoId, carregarDetalhe, carregarLista]);

  const iniciar = async () => {
    if (!podeGerenciar || !novoCompraId) return;
    setErro(null);
    const res = await fetch('/api/operacao/recebimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compraProgramadaId: novoCompraId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao iniciar recebimento');
      return;
    }
    const rec = (body as { recebimento: RecebimentoResumo }).recebimento;
    setSheetAberto(false);
    await carregarLista();
    await carregarDetalhe(rec.id);
  };

  const registrarItem = async (itemComercialId: string) => {
    if (!recebimentoId || !podeGerenciar) return;
    setErro(null);
    const quantidadeRecebida = Number(quantidades[itemComercialId] ?? '');
    const div = divergencias[itemComercialId];
    const payload: Record<string, unknown> = { itemComercialId, quantidadeRecebida };
    if (div) payload.divergencia = div;

    const res = await fetch(`/api/operacao/recebimentos/${recebimentoId}/itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao registrar item');
      return;
    }
    await carregarDetalhe(recebimentoId);
  };

  const concluir = async () => {
    if (!recebimentoId || !podeGerenciar) return;
    setErro(null);
    const res = await fetch(`/api/operacao/recebimentos/${recebimentoId}/concluir`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao concluir recebimento');
      return;
    }
    await carregarDetalhe(recebimentoId);
    await carregarLista();
  };

  const listaFiltrada = lista.filter(
    (r) => !busca || r.id.includes(busca) || r.compraProgramadaId.includes(busca) || r.dataOperacao.includes(busca),
  );

  const temDivergenciaAberta = (detalhe?.divergencias ?? []).some((d) => d.status === 'aberta');
  const concluido = detalhe?.status === 'concluido';
  const progresso =
    detalhe && detalhe.itens.length > 0
      ? Math.round(
          (detalhe.itens.filter((i) => i.statusApuracao !== 'aguardando').length / detalhe.itens.length) * 100,
        )
      : 0;

  if (!podeLer) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar recebimentos.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recebimento de carga</h1>
          <p className="text-sm text-muted-foreground">Conferência física e registro de lotes do dia</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={status === 'conectado' ? 'border-green-200 bg-green-50 text-green-700' : ''}>
            {status === 'conectado' ? '● tempo real' : '○ reconectando'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void carregarLista()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Atualizar
          </Button>
          {podeGerenciar && (
            <Button size="sm" onClick={() => setSheetAberto(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Novo recebimento
            </Button>
          )}
        </div>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <div className="flex items-center gap-2 border-b p-4">
            <Truck className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Lotes / recebimentos</h2>
          </div>
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div className="max-h-[480px] divide-y overflow-y-auto">
            {listaFiltrada.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum recebimento registrado.</p>
            ) : (
              listaFiltrada.map((r) => {
                const st = STATUS_RECEB[r.status] ?? { label: r.status, className: 'bg-muted' };
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => void carregarDetalhe(r.id)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${recebimentoId === r.id ? 'bg-muted/70' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{r.id.slice(0, 8)}…</span>
                      <Badge variant="outline" className={st.className}>
                        {st.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.dataOperacao}</p>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card className="lg:col-span-8">
          {!detalhe ? (
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Selecione um recebimento ou inicie um novo lote.</p>
            </CardContent>
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Status: <strong data-testid="receb-status">{detalhe.status}</strong> — {detalhe.dataOperacao}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{detalhe.id}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Progresso: {progresso}%
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                    <TableHead>Apuração</TableHead>
                    {!concluido && podeGerenciar && <TableHead>Conferir</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalhe.itens.map((item) => {
                    const div = divergencias[item.itemComercialId];
                    return (
                      <TableRow key={item.id} data-testid={`item-${item.itemComercialId}`}>
                        <TableCell className="font-mono text-xs">{item.itemComercialId.slice(0, 10)}…</TableCell>
                        <TableCell className="text-right">{item.quantidadeEsperada}</TableCell>
                        <TableCell className="text-right">{item.quantidadeRecebida}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.statusApuracao}</Badge>
                        </TableCell>
                        {!concluido && podeGerenciar && (
                          <TableCell>
                            <div className="min-w-[200px] space-y-2">
                              <Input
                                type="number"
                                step="0.001"
                                aria-label={`Quantidade ${item.itemComercialId}`}
                                value={quantidades[item.itemComercialId] ?? ''}
                                onChange={(e) =>
                                  setQuantidades((p) => ({ ...p, [item.itemComercialId]: e.target.value }))
                                }
                              />
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={Boolean(div)}
                                  onChange={(e) => {
                                    setDivergencias((p) => {
                                      const next = { ...p };
                                      if (e.target.checked) {
                                        next[item.itemComercialId] = {
                                          tipo: 'quantidade_menor',
                                          descricao: '',
                                          acaoImediata: '',
                                        };
                                      } else delete next[item.itemComercialId];
                                      return next;
                                    });
                                  }}
                                />
                                Divergência
                              </label>
                              {div && (
                                <div className="space-y-1 rounded border p-2">
                                  <select
                                    value={div.tipo}
                                    onChange={(e) =>
                                      setDivergencias((p) => ({
                                        ...p,
                                        [item.itemComercialId]: { ...div, tipo: e.target.value as TipoDivergencia },
                                      }))
                                    }
                                    className="h-8 w-full rounded border px-2 text-xs"
                                  >
                                    {TIPOS_DIVERGENCIA.map((t) => (
                                      <option key={t} value={t}>
                                        {t}
                                      </option>
                                    ))}
                                  </select>
                                  <Input
                                    placeholder="Descrição"
                                    value={div.descricao}
                                    onChange={(e) =>
                                      setDivergencias((p) => ({
                                        ...p,
                                        [item.itemComercialId]: { ...div, descricao: e.target.value },
                                      }))
                                    }
                                  />
                                  <Input
                                    placeholder="Ação imediata"
                                    value={div.acaoImediata}
                                    onChange={(e) =>
                                      setDivergencias((p) => ({
                                        ...p,
                                        [item.itemComercialId]: { ...div, acaoImediata: e.target.value },
                                      }))
                                    }
                                  />
                                </div>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => registrarItem(item.itemComercialId)}
                                disabled={div ? !div.descricao || !div.acaoImediata : false}
                              >
                                Registrar
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {detalhe.divergencias.length > 0 && (
                <div className="rounded-md border p-3">
                  <h3 className="mb-2 flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Divergências
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {detalhe.divergencias.map((d) => (
                      <li key={d.id} data-testid={`diverg-${d.id}`}>
                        <strong>{d.tipo}</strong> — {d.descricao} <em>({d.status})</em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!concluido && podeGerenciar && (
                <div>
                  <Button onClick={concluir} disabled={temDivergenciaAberta} data-testid="btn-concluir">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Concluir recebimento
                  </Button>
                  {temDivergenciaAberta && (
                    <p className="mt-1 text-xs text-destructive">Trate divergências abertas antes de concluir.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Iniciar recebimento</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Compra programada confirmada</Label>
              <Select value={novoCompraId} onValueChange={setNovoCompraId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a compra" />
                </SelectTrigger>
                <SelectContent>
                  {compras.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.dataOperacao} — {c.id.slice(0, 8)}…
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={iniciar} disabled={!novoCompraId} className="w-full">
              Iniciar conferência
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
