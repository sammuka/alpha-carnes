'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Package, RefreshCw, Scissors, Warehouse } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FaltaDesossa } from '@/lib/desossa';

function formatarQuantidade(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

export function DesossaDashboardClient() {
  const [faltas, setFaltas] = useState<FaltaDesossa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch('/api/desossa/faltas', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Falha ao carregar faltas');
        return;
      }
      setFaltas((await res.json()) as FaltaDesossa[]);
      setUltimaAtualizacao(new Date());
    } catch {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const intervalo = setInterval(() => void carregar(), 60_000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  const totalFaltante = faltas.reduce((acc, item) => acc + item.quantidadeFaltante, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Desossa</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Painel de Necessidade</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            O que falta produzir para completar os pedidos do dia.
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${carregando ? 'animate-pulse bg-primary' : 'bg-[var(--color-status-expedido)]'}`}
              aria-hidden="true"
            />
            <span>Atualização automática a cada minuto</span>
            {ultimaAtualizacao && (
              <span className="text-muted-foreground/80">
                · Última: {ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button asChild size="sm">
            <Link href="/desossa/pesagem-destinacao">
              <Scissors className="mr-2 h-4 w-4" />
              Pesagem e Destinação
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Produtos com demanda"
          value={faltas.length}
          variant="warning"
          Icon={Package}
        />
        <KpiCard
          label="Total faltante"
          value={formatarQuantidade(totalFaltante)}
          sub={totalFaltante > 0 ? 'Requer produção' : 'Demanda atendida'}
          variant="warning"
          Icon={AlertTriangle}
        />
        <KpiCard
          label="Prontos em estoque (demanda)"
          value={formatarQuantidade(faltas.reduce((acc, item) => acc + item.quantidadeEstoque, 0))}
          variant="success"
          Icon={Warehouse}
        />
      </div>

      {erro && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b bg-muted/40 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Desossa — Painel de Necessidade
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="font-semibold">Produto</TableHead>
              <TableHead className="text-right font-semibold">Faltam</TableHead>
              <TableHead className="text-right font-semibold">Pronto em estoque</TableHead>
              <TableHead className="font-semibold">Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando && faltas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Carregando painel…
                </TableCell>
              </TableRow>
            ) : faltas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Nenhuma demanda pendente de produtos derivados de transformação.
                </TableCell>
              </TableRow>
            ) : (
              faltas.map((item) => (
                <TableRow key={item.produto.id} className={item.quantidadeFaltante > 0 ? 'bg-amber-50/60' : ''}>
                  <TableCell>
                    <div className="font-medium">{item.produto.nome}</div>
                    <div className="text-xs text-muted-foreground">{item.produto.codigo}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`inline-block min-w-[3rem] text-3xl font-bold tabular-nums tracking-tight ${
                        item.quantidadeFaltante > 0
                          ? 'text-[var(--color-status-divergencia)]'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {formatarQuantidade(item.quantidadeFaltante)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xl font-semibold tabular-nums text-[var(--color-status-expedido)]">
                      {formatarQuantidade(item.quantidadeEstoque)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.origem}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
