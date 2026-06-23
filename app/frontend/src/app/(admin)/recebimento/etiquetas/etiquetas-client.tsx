'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Printer, QrCode, Search } from 'lucide-react';
import type { PaginadoRecebimento, Peca, RecebimentoResumo } from '@/lib/operacao';
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

const ROTULO_DESTINO: Record<string, string> = {
  associada: 'Pedido',
  em_sobra: 'Estoque',
  para_corte: 'Desossa',
  pesada: 'Aguardando destino',
  em_analise: 'Análise',
  divergente: 'Divergência',
};

export function EtiquetasRecebimentoClient({ permissoes }: { permissoes: string[] }) {
  const podeLer = permissoes.includes('ETIQUETA_GERENCIAR') || permissoes.includes('PESAGEM_LER');
  const podeReimprimir = permissoes.includes('ETIQUETA_GERENCIAR');

  const [recebimentos, setRecebimentos] = useState<RecebimentoResumo[]>([]);
  const [recebimentoId, setRecebimentoId] = useState('');
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<Peca | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregarRecebimentos = useCallback(async () => {
    const res = await fetch('/api/operacao/recebimentos?pageSize=30', { cache: 'no-store' });
    if (res.ok) {
      const pag = (await res.json()) as PaginadoRecebimento;
      setRecebimentos(pag.data);
      if (pag.data[0] && !recebimentoId) setRecebimentoId(pag.data[0].id);
    }
  }, [recebimentoId]);

  const carregarPecas = useCallback(async () => {
    if (!recebimentoId || !podeLer) return;
    setCarregando(true);
    setErro(null);
    const res = await fetch(`/api/operacao/pesagem/recebimentos/${recebimentoId}/pecas`, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro((body as { message?: string }).message ?? 'Erro ao carregar peças');
      setCarregando(false);
      return;
    }
    setPecas((await res.json()) as Peca[]);
    setCarregando(false);
  }, [recebimentoId, podeLer]);

  useEffect(() => {
    void carregarRecebimentos();
  }, [carregarRecebimentos]);

  useEffect(() => {
    void carregarPecas();
  }, [carregarPecas]);

  const reimprimir = async (pecaId: string) => {
    if (!podeReimprimir) return;
    setErro(null);
    const res = await fetch(`/api/operacao/pesagem/pecas/${pecaId}/etiqueta/reimprimir`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro((body as { message?: string }).message ?? 'Erro ao reimprimir');
      return;
    }
    await carregarPecas();
  };

  const filtradas = pecas.filter((p) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      p.id.toLowerCase().includes(q) ||
      (p.etiquetaAtual?.toLowerCase().includes(q) ?? false) ||
      p.statusPeca.toLowerCase().includes(q)
    );
  });

  if (!podeLer) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar etiquetas.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Etiquetas — recebimento</h1>
        <p className="text-sm text-muted-foreground">Consulta e reimpressão de etiquetas emitidas na pesagem</p>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="min-w-[240px] flex-1">
            <Label>Recebimento</Label>
            <Select value={recebimentoId} onValueChange={setRecebimentoId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {recebimentos.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.dataOperacao} — {r.id.slice(0, 8)}…
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label>Buscar</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Código, peça, status…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        {carregando ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando peças…</p>
        ) : filtradas.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma peça encontrada para este recebimento.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Peça</TableHead>
                  <TableHead>Peso</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Status peça</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.etiquetaAtual ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs">
                          <QrCode className="h-3 w-3" />
                          {p.etiquetaAtual}
                        </span>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.id.slice(0, 10)}…</TableCell>
                    <TableCell>{p.pesoOriginal} kg</TableCell>
                    <TableCell>{ROTULO_DESTINO[p.statusPeca] ?? p.statusPeca}</TableCell>
                    <TableCell>{p.statusPeca}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setSelecionada(p)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {podeReimprimir && p.etiquetaAtual && (
                          <Button variant="ghost" size="icon" onClick={() => void reimprimir(p.id)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Sheet open={Boolean(selecionada)} onOpenChange={(o) => !o && setSelecionada(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Detalhe da etiqueta</SheetTitle>
          </SheetHeader>
          {selecionada && (
            <dl className="mt-6 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Código</dt>
                <dd className="font-mono">{selecionada.etiquetaAtual ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Peça</dt>
                <dd className="font-mono text-xs">{selecionada.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Peso</dt>
                <dd>{selecionada.pesoOriginal} kg</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Destino</dt>
                <dd>{ROTULO_DESTINO[selecionada.statusPeca] ?? selecionada.statusPeca}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Modo captura</dt>
                <dd>{selecionada.modoCapturaPeso}</dd>
              </div>
              {selecionada.pedidoVendaId && (
                <div>
                  <dt className="text-muted-foreground">Pedido</dt>
                  <dd className="font-mono text-xs">{selecionada.pedidoVendaId}</dd>
                </div>
              )}
            </dl>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
