'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ItemEstoqueConsulta } from '@/lib/estoque';

function formatarPeso(peso: string | null): string {
  if (!peso) return '—';
  const n = Number.parseFloat(peso);
  return Number.isFinite(n) ? `${n.toFixed(3)} kg` : peso;
}

export function EstoqueConsultaClient() {
  const [itens, setItens] = useState<ItemEstoqueConsulta[]>([]);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch('/api/operacao/estoque/consulta', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Falha ao carregar estoque');
        return;
      }
      setItens((await res.json()) as ItemEstoqueConsulta[]);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter(
      (item) =>
        item.produto.nome.toLowerCase().includes(termo) ||
        item.produto.codigo.toLowerCase().includes(termo) ||
        (item.etiqueta?.toLowerCase().includes(termo) ?? false),
    );
  }, [busca, itens]);

  const totalPecas = itens.filter((i) => i.tipo === 'peca').length;
  const totalSubitens = itens.filter((i) => i.tipo === 'subitem').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Estoque</p>
          <h1 className="text-2xl font-bold text-foreground">Consulta de Estoque</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Peças e subitens com status em sobra, prontos para destinação ou reaproveitamento.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando}>
          <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Itens em estoque</p>
          <p className="text-3xl font-bold tabular-nums">{itens.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Peças inteiras</p>
          <p className="text-3xl font-bold tabular-nums">{totalPecas}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Subitens (desossa)</p>
          <p className="text-3xl font-bold tabular-nums">{totalSubitens}</p>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto, código ou etiqueta…"
          className="pl-9"
        />
      </div>

      {erro && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Peso</TableHead>
              <TableHead>Etiqueta</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando && itens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Carregando estoque…
                </TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  Nenhum item em estoque encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((item) => (
                <TableRow key={`${item.tipo}-${item.id}`}>
                  <TableCell>
                    <div className="font-medium">{item.produto.nome}</div>
                    <div className="text-xs text-muted-foreground">{item.produto.codigo}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.tipo === 'peca' ? 'Peça' : 'Subitem'}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantidade}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarPeso(item.peso)}</TableCell>
                  <TableCell className="font-mono text-xs">{item.etiqueta ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.status}</Badge>
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
