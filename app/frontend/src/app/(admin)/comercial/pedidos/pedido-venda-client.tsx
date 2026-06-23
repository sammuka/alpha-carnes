'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Calendar,
  Info,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  CompraProgramada,
  DisponibilidadeDia,
  Paginado,
  PedidoVenda,
  ResultadoPedido,
} from '@/lib/comercial';

interface CadastroItem {
  id: string;
  codigo?: string;
  nome?: string;
  razaoSocial?: string;
}

interface LinhaPedido {
  itemComercialId: string;
  quantidadePedida: string;
  observacoes: string;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function saldoMap(disponibilidade: DisponibilidadeDia[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const d of disponibilidade) m[d.itemComercialId] = Number(d.quantidadeDisponivel);
  return m;
}

export function PedidoVendaClient({ permissoes, modo }: { permissoes: string[]; modo: 'lista' | 'novo' }) {
  const podeLer = permissoes.includes('PEDIDOS_LER');
  const podeGerenciar = permissoes.includes('PEDIDOS_GERENCIAR');

  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [compras, setCompras] = useState<CompraProgramada[]>([]);
  const [clientes, setClientes] = useState<CadastroItem[]>([]);
  const [itensComerciais, setItensComerciais] = useState<CadastroItem[]>([]);
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeDia[]>([]);

  const [compraProgramadaId, setCompraProgramadaId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [dataOperacao, setDataOperacao] = useState(hojeISO());
  const [rotaPrevista, setRotaPrevista] = useState('');
  const [prioridade, setPrioridade] = useState('50');
  const [linhas, setLinhas] = useState<LinhaPedido[]>([{ itemComercialId: '', quantidadePedida: '', observacoes: '' }]);

  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoPedido | null>(null);
  const [salvando, setSalvando] = useState(false);

  const saldos = saldoMap(disponibilidade);

  const carregarLista = useCallback(async () => {
    if (!podeLer) return;
    const res = await fetch('/api/comercial/pedidos?pageSize=50', { cache: 'no-store' });
    if (res.ok) {
      const pag = (await res.json()) as Paginado<PedidoVenda>;
      setPedidos(pag.data);
    }
  }, [podeLer]);

  const carregarCadastros = useCallback(async () => {
    const [cRes, clRes, icRes] = await Promise.all([
      fetch('/api/comercial/compras-programadas?pageSize=20', { cache: 'no-store' }),
      fetch('/api/cadastros/clientes?pageSize=100', { cache: 'no-store' }),
      fetch('/api/cadastros/itens-comerciais?pageSize=100', { cache: 'no-store' }),
    ]);
    if (cRes.ok) {
      const c = (await cRes.json()) as Paginado<CompraProgramada>;
      const confirmadas = c.data.filter((x) => x.status === 'confirmada');
      setCompras(confirmadas);
      if (confirmadas[0] && !compraProgramadaId) {
        setCompraProgramadaId(confirmadas[0].id);
        setDataOperacao(confirmadas[0].dataOperacao);
      }
    }
    if (clRes.ok) setClientes(((await clRes.json()) as Paginado<CadastroItem>).data);
    if (icRes.ok) setItensComerciais(((await icRes.json()) as Paginado<CadastroItem>).data);
  }, [compraProgramadaId]);

  const carregarDisponibilidade = useCallback(async () => {
    if (!dataOperacao) return;
    const res = await fetch(`/api/comercial/disponibilidade?dataOperacao=${dataOperacao}`, { cache: 'no-store' });
    if (res.ok) setDisponibilidade((await res.json()) as DisponibilidadeDia[]);
  }, [dataOperacao]);

  useEffect(() => {
    void carregarCadastros();
    if (modo === 'lista') void carregarLista();
  }, [carregarCadastros, carregarLista, modo]);

  useEffect(() => {
    void carregarDisponibilidade();
  }, [carregarDisponibilidade]);

  useEffect(() => {
    const compra = compras.find((c) => c.id === compraProgramadaId);
    if (compra) setDataOperacao(compra.dataOperacao);
  }, [compraProgramadaId, compras]);

  const salvar = async () => {
    if (!podeGerenciar) return;
    setSalvando(true);
    setErro(null);
    setResultado(null);
    const itens = linhas
      .filter((l) => l.itemComercialId && Number(l.quantidadePedida) > 0)
      .map((l) => ({
        itemComercialId: l.itemComercialId,
        quantidadePedida: Number(l.quantidadePedida),
        observacoes: l.observacoes || undefined,
      }));
    if (!compraProgramadaId || !clienteId || itens.length === 0) {
      setErro('Preencha compra, cliente e ao menos um item.');
      setSalvando(false);
      return;
    }
    const res = await fetch('/api/comercial/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compraProgramadaId,
        clienteId,
        dataOperacao,
        rotaPrevista: rotaPrevista || undefined,
        prioridade: Number(prioridade),
        itens,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao criar pedido');
      setSalvando(false);
      return;
    }
    setResultado(body as ResultadoPedido);
    await carregarDisponibilidade();
    if (modo === 'lista') await carregarLista();
    setSalvando(false);
  };

  if (!podeLer) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar pedidos.</p>;
  }

  if (modo === 'lista') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pedidos de venda</h1>
            <p className="text-sm text-muted-foreground">Pedidos com reserva virtual do dia</p>
          </div>
          {podeGerenciar && (
            <Button asChild>
              <Link href="/comercial/pedidos/novo">Novo pedido</Link>
            </Button>
          )}
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>Prioridade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum pedido registrado.
                  </TableCell>
                </TableRow>
              ) : (
                pedidos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.id.slice(0, 8)}…</TableCell>
                    <TableCell>{p.dataOperacao}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.status}</Badge>
                    </TableCell>
                    <TableCell>{p.rotaPrevista ?? '—'}</TableCell>
                    <TableCell>{p.prioridade ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Novo pedido de venda</h1>
            <p className="text-sm text-muted-foreground">Criação de pedido com reserva virtual</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/comercial/pedidos">Cancelar</Link>
            </Button>
            {podeGerenciar && (
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? 'Reservando…' : 'Salvar e reservar'}
              </Button>
            )}
          </div>
        </div>

        {erro && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {erro}
          </div>
        )}
        {resultado && (
          <div role="status" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
            Pedido <strong>{resultado.id.slice(0, 8)}…</strong> — status <strong>{resultado.status}</strong>
          </div>
        )}

        <Card>
          <CardContent className="grid gap-4 p-6 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger className="pl-9">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.razaoSocial ?? c.codigo ?? c.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data operacional</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" type="date" value={dataOperacao} readOnly />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lote / Compra</Label>
              <Select value={compraProgramadaId} onValueChange={setCompraProgramadaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Compra confirmada" />
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
            <div className="space-y-2">
              <Label>Prioridade (0–100)</Label>
              <Input type="number" min={0} max={100} value={prioridade} onChange={(e) => setPrioridade(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rota prevista</Label>
              <Input value={rotaPrevista} onChange={(e) => setRotaPrevista(e.target.value)} placeholder="Ex: Centro" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b bg-muted/40 p-4">
            <h2 className="font-semibold">Itens do pedido</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLinhas((p) => [...p, { itemComercialId: '', quantidadePedida: '', observacoes: '' }])}
            >
              <Plus className="mr-1 h-4 w-4" />
              Adicionar linha
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item comercial</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Qtd pedida</TableHead>
                  <TableHead>Reserva</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Obs.</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((linha, idx) => {
                  const saldo = saldos[linha.itemComercialId] ?? 0;
                  const qtd = Number(linha.quantidadePedida) || 0;
                  const reservada = Math.min(qtd, saldo);
                  const parcial = qtd > saldo && qtd > 0;
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select
                          value={linha.itemComercialId}
                          onValueChange={(v) =>
                            setLinhas((p) => p.map((l, i) => (i === idx ? { ...l, itemComercialId: v } : l)))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Item" />
                          </SelectTrigger>
                          <SelectContent>
                            {itensComerciais.map((it) => (
                              <SelectItem key={it.id} value={it.id}>
                                {it.nome ?? it.codigo ?? it.id.slice(0, 8)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{linha.itemComercialId ? `${saldo} un` : '—'}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.001"
                          value={linha.quantidadePedida}
                          className={parcial ? 'border-destructive text-destructive' : ''}
                          onChange={(e) =>
                            setLinhas((p) => p.map((l, i) => (i === idx ? { ...l, quantidadePedida: e.target.value } : l)))
                          }
                        />
                      </TableCell>
                      <TableCell>{qtd > 0 ? `${reservada} un` : '—'}</TableCell>
                      <TableCell>
                        {qtd <= 0 ? (
                          '—'
                        ) : parcial ? (
                          <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Parcial</Badge>
                        ) : (
                          <Badge className="bg-green-50 text-green-700 hover:bg-green-50">Total</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={linha.observacoes}
                          onChange={(e) =>
                            setLinhas((p) => p.map((l, i) => (i === idx ? { ...l, observacoes: e.target.value } : l)))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setLinhas((p) => p.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <div className="w-full shrink-0 lg:w-80">
        <Card>
          <CardHeader className="border-b bg-muted/40">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4 text-primary" />
              Painel de contexto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Saldo virtual</h3>
              {disponibilidade.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem disponibilidade para a data.</p>
              ) : (
                <div className="space-y-3">
                  {disponibilidade.slice(0, 6).map((d) => {
                    const total = Number(d.quantidadeTotalGerada);
                    const disp = Number(d.quantidadeDisponivel);
                    const pct = total > 0 ? Math.round(((total - disp) / total) * 100) : 0;
                    return (
                      <div key={d.id}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-medium font-mono text-xs">{d.itemComercialId.slice(0, 8)}…</span>
                          <span className={disp <= 0 ? 'text-destructive' : 'text-muted-foreground'}>
                            {disp} / {total}
                          </span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {disponibilidade.some((d) => Number(d.quantidadeDisponivel) <= 0) && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Há itens esgotados — pedidos podem ficar parcialmente reservados.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
