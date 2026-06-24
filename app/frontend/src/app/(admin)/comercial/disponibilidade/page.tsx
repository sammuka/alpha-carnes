'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Filter, PackageCheck, PackageSearch, Scale, TrendingUp } from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import type { DisponibilidadeDia } from '@/lib/comercial';
import { AlertItem } from '@/components/ui/alert-item';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusPill } from '@/components/ui/status-pill';
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
    { label: 'Total gerado', value: resumo.total.toFixed(0), sub: 'Previsto do dia', variant: 'primary' as const, Icon: PackageCheck },
    { label: 'Reservado', value: resumo.reservado.toFixed(0), sub: 'Pedidos confirmados', variant: 'violet' as const, Icon: Scale },
    { label: 'Disponível (livre)', value: resumo.disponivel.toFixed(0), sub: 'Pronto para venda', variant: 'success' as const, Icon: TrendingUp },
    { label: 'Recebido', value: resumo.recebido.toFixed(0), sub: 'Em planta', variant: 'warning' as const, Icon: PackageSearch },
    { label: 'Esgotados', value: `${esgotados.length} itens`, sub: 'Sem cobertura', variant: 'warning' as const, Icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Disponibilidade virtual</h1>
          <p className="text-sm text-muted-foreground">Saldo comercial por item para a data operacional</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill
            variant={status === 'conectado' ? 'expedido' : 'pendente'}
            label={status === 'conectado' ? 'tempo real' : 'reconectando'}
          />
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
          <KpiCard
            key={c.label}
            label={c.label}
            value={carregando ? '…' : c.value}
            sub={c.sub}
            variant={c.variant}
            Icon={c.Icon}
          />
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
                              {disp <= 0 && <StatusPill variant="divergencia" label="ESGOTADO" />}
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
                <AlertItem
                  key={l.id}
                  title="Item esgotado"
                  description={`Reservado: ${l.quantidadeReservada} / Gerado: ${l.quantidadeTotalGerada} · ${l.itemComercialId.slice(0, 12)}…`}
                  time=""
                  variant="divergencia"
                  Icon={AlertTriangle}
                />
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
