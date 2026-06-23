'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Filter, PackageSearch } from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import type { DisponibilidadeDia } from '@/lib/comercial';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function soma(linhas: DisponibilidadeDia[], campo: keyof DisponibilidadeDia): number {
  return linhas.reduce((acc, l) => acc + Number(l[campo] as string), 0);
}

export default function DisponibilidadePage() {
  const [dataOperacao, setDataOperacao] = useState(hojeISO());
  const [linhas, setLinhas] = useState<DisponibilidadeDia[]>([]);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');

  const refetch = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/comercial/disponibilidade?dataOperacao=${dataOperacao}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Erro ao carregar disponibilidade');
        return;
      }
      setLinhas((await res.json()) as DisponibilidadeDia[]);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
    }
  }, [dataOperacao]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const onMessage = (msg: RealtimeMensagem) => {
      if (msg.type === 'reserva_disponibilidade_atualizada') {
        const p = msg.payload as {
          disponibilidadeId: string;
          quantidadeReservada: string;
          quantidadeDisponivel: string;
        };
        setLinhas((prev) =>
          prev.map((l) =>
            l.id === p.disponibilidadeId
              ? { ...l, quantidadeReservada: p.quantidadeReservada, quantidadeDisponivel: p.quantidadeDisponivel }
              : l,
          ),
        );
      } else if (msg.type === 'disponibilidade_virtual_gerada' || msg.type === 'recebimento_registrado') {
        void refetch();
      }
    };

    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${dataOperacao}`],
      onMessage,
      onReconnect: () => void refetch(),
      onStatus: setStatus,
    });
    return desconectar;
  }, [dataOperacao, refetch]);

  const filtradas = useMemo(() => {
    if (!busca.trim()) return linhas;
    const q = busca.toLowerCase();
    return linhas.filter((l) => l.itemComercialId.toLowerCase().includes(q) || l.status.toLowerCase().includes(q));
  }, [linhas, busca]);

  const esgotados = linhas.filter((l) => Number(l.quantidadeDisponivel) <= 0);
  const resumo = {
    total: soma(linhas, 'quantidadeTotalGerada'),
    reservado: soma(linhas, 'quantidadeReservada'),
    disponivel: soma(linhas, 'quantidadeDisponivel'),
    recebido: soma(linhas, 'quantidadeRecebida'),
  };

  const cards = [
    { label: 'Total gerado', value: resumo.total.toFixed(0), desc: 'Previsto do dia', border: 'border-l-primary' },
    { label: 'Reservado', value: resumo.reservado.toFixed(0), desc: 'Pedidos confirmados', border: 'border-l-violet-500' },
    { label: 'Disponível (livre)', value: resumo.disponivel.toFixed(0), desc: 'Pronto para venda', border: 'border-l-green-500' },
    { label: 'Recebido', value: resumo.recebido.toFixed(0), desc: 'Em planta', border: 'border-l-amber-500' },
    { label: 'Esgotados', value: `${esgotados.length} itens`, desc: 'Sem cobertura', border: 'border-l-red-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Disponibilidade virtual</h1>
          <p className="text-sm text-muted-foreground">Saldo comercial por item para a data operacional</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={status === 'conectado' ? 'border-green-200 bg-green-50 text-green-700' : ''}>
            {status === 'conectado' ? '● tempo real' : '○ reconectando'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setBusca('')}>
            <Filter className="mr-1 h-4 w-4" />
            Limpar filtros
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="data">Data operacional</Label>
        <Input id="data" type="date" value={dataOperacao} onChange={(e) => setDataOperacao(e.target.value)} className="w-auto" />
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className={`border-l-4 ${c.border}`}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-bold">{carregando ? '…' : c.value}</p>
              <p className="text-xs text-muted-foreground">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              <PackageSearch className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Grade de produtos</h2>
            </div>
            <Input
              placeholder="Buscar item…"
              className="max-w-xs"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          {carregando ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : filtradas.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma disponibilidade para esta data.</p>
          ) : (
            <div className="overflow-x-auto p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item comercial</TableHead>
                    <TableHead className="text-right">Gerado</TableHead>
                    <TableHead className="text-right">Reservado</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                    <TableHead>Ocupação</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((l) => {
                    const total = Number(l.quantidadeTotalGerada);
                    const reservado = Number(l.quantidadeReservada);
                    const disp = Number(l.quantidadeDisponivel);
                    const pct = total > 0 ? Math.min(100, Math.round((reservado / total) * 100)) : 0;
                    return (
                      <TableRow key={l.id} data-testid={`disp-${l.id}`}>
                        <TableCell className="font-mono text-xs">{l.itemComercialId.slice(0, 12)}…</TableCell>
                        <TableCell className="text-right">{l.quantidadeTotalGerada}</TableCell>
                        <TableCell className="text-right">{l.quantidadeReservada}</TableCell>
                        <TableCell
                          className={`text-right font-semibold ${disp <= 0 ? 'text-destructive' : 'text-green-700'}`}
                          data-testid={`disp-${l.id}-disponivel`}
                        >
                          {l.quantidadeDisponivel}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`disp-${l.id}-recebido`}>
                          {l.quantidadeRecebida}
                        </TableCell>
                        <TableCell className="min-w-[140px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{pct}% reservado</span>
                              {disp <= 0 && (
                                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[10px]">
                                  ESGOTADO
                                </Badge>
                              )}
                            </div>
                            <Progress value={pct} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell>{l.status}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="border-t-4 border-t-amber-500 lg:col-span-4">
          <div className="flex items-center gap-2 border-b p-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <h2 className="font-semibold">Alertas & impactos</h2>
          </div>
          <div className="space-y-3 p-4">
            {esgotados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item esgotado no momento.</p>
            ) : (
              esgotados.map((l) => (
                <div key={l.id} className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                  <p className="font-semibold text-red-700">Item esgotado</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{l.itemComercialId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reservado: {l.quantidadeReservada} / Gerado: {l.quantidadeTotalGerada}
                  </p>
                </div>
              ))
            )}
            {linhas.some((l) => Number(l.quantidadeComDivergencia) > 0) && (
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <p className="font-semibold">Divergências no recebimento</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {linhas.filter((l) => Number(l.quantidadeComDivergencia) > 0).length} item(ns) com quantidade divergente registrada.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
