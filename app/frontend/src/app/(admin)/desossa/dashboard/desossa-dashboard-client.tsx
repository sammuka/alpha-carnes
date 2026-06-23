'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Scissors } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
            O que falta produzir para completar os pedidos do dia. Atualização automática a cada minuto.
          </p>
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
        <Card className="border-l-4 border-l-amber-500 p-4">
          <p className="text-sm text-muted-foreground">Produtos com demanda</p>
          <p className="text-3xl font-bold tabular-nums">{faltas.length}</p>
        </Card>
        <Card className="border-l-4 border-l-red-500 p-4">
          <p className="text-sm text-muted-foreground">Total faltante</p>
          <p className="text-3xl font-bold tabular-nums text-red-700">{formatarQuantidade(totalFaltante)}</p>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 p-4">
          <p className="text-sm text-muted-foreground">Prontos em estoque (demanda)</p>
          <p className="text-3xl font-bold tabular-nums text-emerald-700">
            {formatarQuantidade(faltas.reduce((acc, item) => acc + item.quantidadeEstoque, 0))}
          </p>
        </Card>
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
                    <Badge
                      variant={item.quantidadeFaltante > 0 ? 'destructive' : 'secondary'}
                      className="min-w-12 justify-center tabular-nums"
                    >
                      {formatarQuantidade(item.quantidadeFaltante)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-emerald-700">
                    {formatarQuantidade(item.quantidadeEstoque)}
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
