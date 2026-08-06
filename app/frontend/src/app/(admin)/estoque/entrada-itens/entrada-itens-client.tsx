'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info, PackagePlus, Search, X } from 'lucide-react';
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComboboxField } from '@/components/ui/combobox-field';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChip } from '@/components/ui/filter-chip';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import {
  Table,
  TableBody,
  TableCell,
  TableCellCode,
  TableCellNum,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import {
  compativeisPorProduto,
  criarEntrada,
  listarEntradas,
  type EntradaItem,
  type PedidoCompativelEstoque,
} from '@/lib/estoque';
import { mensagemDeErro } from '@/lib/error-message';
import type { Produto } from '@/lib/produtos';

type Destino = 'estoque' | 'pedido';

const LOCAIS = ['Câmara 1', 'Câmara 2', 'Túnel'];

export function EntradaItensClient({ podeRegistrar }: { podeRegistrar: boolean }) {
  const [produtosCaixaria, setProdutosCaixaria] = useState<Produto[]>([]);
  const [produtoId, setProdutoId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState<'caixa' | 'unidade'>('caixa');
  const [fornecedor, setFornecedor] = useState('');
  const [loteNf, setLoteNf] = useState('');
  const [local, setLocal] = useState('Câmara 1');
  const [destino, setDestino] = useState<Destino>('estoque');
  const [buscaCliente, setBuscaCliente] = useState('');
  const [pedidosCompativeis, setPedidosCompativeis] = useState<PedidoCompativelEstoque[]>([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoCompativelEstoque | null>(null);
  const [observacao, setObservacao] = useState('');
  const [entradas, setEntradas] = useState<EntradaItem[]>([]);
  const [feedback, setFeedback] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregarEntradas = useCallback(async () => {
    try {
      const res = await listarEntradas(1, 50);
      setEntradas(res.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar entradas de hoje');
    }
  }, []);

  useEffect(() => {
    void carregarEntradas();
    void (async () => {
      const res = await fetch('/api/cadastros/produtos?page=1&pageSize=100&status=ativo', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, 'Falha ao carregar produtos'));
        return;
      }
      const body = (await res.json()) as { data: Produto[] };
      setProdutosCaixaria(body.data.filter((p) => p.tipoOperacional === 'entrada_unidade'));
    })();
  }, [carregarEntradas]);

  useEffect(() => {
    if (!produtoId) {
      setPedidosCompativeis([]);
      return;
    }
    compativeisPorProduto(produtoId)
      .then(setPedidosCompativeis)
      .catch(() => setPedidosCompativeis([]));
  }, [produtoId]);

  const pedidosFiltrados = useMemo(
    () =>
      pedidosCompativeis.filter(
        (p) => buscaCliente === '' || p.clienteNome.toLowerCase().includes(buscaCliente.toLowerCase()),
      ),
    [pedidosCompativeis, buscaCliente],
  );

  const qtdNumerica = Number.parseInt(quantidade, 10);
  const podeConfirmar =
    podeRegistrar &&
    produtoId !== '' &&
    !Number.isNaN(qtdNumerica) &&
    qtdNumerica > 0 &&
    fornecedor.trim() !== '' &&
    (destino === 'estoque' || pedidoSelecionado !== null);

  const limparForm = () => {
    setProdutoId('');
    setQuantidade('');
    setUnidade('caixa');
    setFornecedor('');
    setLoteNf('');
    setLocal('Câmara 1');
    setDestino('estoque');
    setBuscaCliente('');
    setPedidoSelecionado(null);
    setObservacao('');
  };

  const handleConfirmar = async () => {
    if (!podeConfirmar) return;
    setEnviando(true);
    setErro(null);
    try {
      await criarEntrada({
        produtoId,
        quantidade: qtdNumerica,
        unidade,
        fornecedorNome: fornecedor.trim(),
        loteNf: loteNf.trim() || undefined,
        local,
        destino,
        pedidoVendaItemId: destino === 'pedido' ? pedidoSelecionado?.pedidoVendaItemId : undefined,
        observacao: observacao.trim() || undefined,
      });
      setFeedback(true);
      setTimeout(() => setFeedback(false), 2500);
      limparForm();
      await carregarEntradas();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao registrar entrada');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Entrada de Itens" subtitle="Registro de entrada de itens que não passam por balança" />

      <div className="flex gap-2 rounded-md border border-primary-soft-border bg-info-soft px-3 py-2 text-xs text-info-fg">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>Caixarias são vendidas por unidade; não passam por balança nem desossa.</span>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-md border border-success-soft-border bg-success-soft px-3 py-2 text-xs text-success-fg">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
          Entrada registrada com sucesso.
        </div>
      )}
      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="grid gap-2.5 lg:grid-cols-[420px_1fr]">
        {podeRegistrar && (
          <Card>
            <CardHeader>
              <CardTitle>Nova entrada</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-x-3.5 gap-y-2.5">
              <FormField label="Produto" required htmlFor="produto-entrada">
                <ComboboxField
                  id="produto-entrada"
                  items={produtosCaixaria.map((p) => ({ id: p.id, label: p.nome, sublabel: p.codigo }))}
                  value={produtoId}
                  onChange={(id) => { setProdutoId(id); setPedidoSelecionado(null); }}
                  placeholder="Selecionar..."
                  searchPlaceholder="Buscar produto…"
                  emptyText="Nenhum produto encontrado."
                />
              </FormField>

              <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
                <FormField label="Quantidade" required htmlFor="qtd-entrada">
                  <Input
                    id="qtd-entrada"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    placeholder="0"
                    className="text-right font-data"
                  />
                </FormField>
                <FormField label="Unidade" htmlFor="unidade-entrada">
                  <SelectNative
                    id="unidade-entrada"
                    className="w-[110px]"
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value as 'caixa' | 'unidade')}
                  >
                    <option value="caixa">Caixa</option>
                    <option value="unidade">Unidade</option>
                  </SelectNative>
                </FormField>
              </div>

              <FormField label="Fornecedor/origem" required htmlFor="fornecedor-entrada">
                <Input
                  id="fornecedor-entrada"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Ex.: Frigorífico Boi Forte"
                />
              </FormField>

              <FormField label="Lote/NF" help="Opcional" htmlFor="lote-entrada">
                <Input
                  id="lote-entrada"
                  value={loteNf}
                  onChange={(e) => setLoteNf(e.target.value)}
                  placeholder="Ex.: NF 129110 / Lote 404"
                />
              </FormField>

              <FormField label="Local/câmara" htmlFor="local-entrada">
                <SelectNative
                  id="local-entrada"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                >
                  {LOCAIS.map((l) => <option key={l} value={l}>{l}</option>)}
                </SelectNative>
              </FormField>

              <FormField label="Destino">
                <div className="flex gap-1.5">
                  <FilterChip active={destino === 'estoque'} onClick={() => { setDestino('estoque'); setPedidoSelecionado(null); }}>
                    Estoque
                  </FilterChip>
                  <FilterChip active={destino === 'pedido'} onClick={() => { setDestino('pedido'); setPedidoSelecionado(null); }}>
                    Pedido
                  </FilterChip>
                </div>
              </FormField>

              {destino === 'pedido' && (
                <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-2.5">
                  <Input
                    adornLeft={<Search />}
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    placeholder="Buscar cliente"
                    className="h-8 text-[13px]"
                  />

                  {produtoId === '' ? (
                    <p className="py-2 text-center text-[12px] text-muted-foreground">Selecione um produto para ver pedidos compatíveis.</p>
                  ) : pedidosFiltrados.length === 0 ? (
                    <p className="py-2 text-center text-[12px] text-muted-foreground">Não há pedidos pendentes compatíveis.</p>
                  ) : (
                    <div className="flex max-h-[160px] flex-col overflow-y-auto overflow-x-hidden rounded-md border border-border">
                      {pedidosFiltrados.map((p) => {
                        const selecionado = pedidoSelecionado?.pedidoVendaItemId === p.pedidoVendaItemId;
                        return (
                          <button
                            key={p.pedidoVendaItemId}
                            type="button"
                            onClick={() => setPedidoSelecionado(selecionado ? null : p)}
                            className={cn(
                              'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 last:border-b-0 hover:bg-surface-2',
                              selecionado && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                            )}
                          >
                            <span className="block truncate text-[13px] font-semibold">{p.clienteNome}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{p.pendencia}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {pedidoSelecionado && (
                    <div className="flex items-center justify-between rounded-md border border-primary-soft-border bg-primary-soft px-2.5 py-1.5 text-[12px] font-medium text-primary-fg">
                      <span>{pedidoSelecionado.clienteNome}</span>
                      <button type="button" onClick={() => setPedidoSelecionado(null)} className="hover:opacity-70">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <FormField label="Observação" htmlFor="obs-entrada">
                <Textarea
                  id="obs-entrada"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                />
              </FormField>

              <div className="mt-1 flex gap-2">
                <Button type="button" variant="ghost" className="flex-1" onClick={limparForm}>
                  Limpar
                </Button>
                <Button
                  type="button"
                  className="flex-[2]"
                  disabled={!podeConfirmar || enviando}
                  onClick={() => void handleConfirmar()}
                >
                  <PackagePlus /> Confirmar entrada
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Entradas de hoje</CardTitle>
            <BadgeCount>{entradas.length}</BadgeCount>
          </CardHeader>
          <CardContent className="p-0">
            {entradas.length === 0 ? (
              <EmptyState icon={<PackagePlus />} title="Nenhuma entrada registrada hoje." className="py-12" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Hora</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Operador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entradas.map((e) => (
                    <TableRow key={e.id}>
                      <TableCellCode>
                        {new Date(e.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </TableCellCode>
                      <TableCell className="text-[13px] font-semibold text-foreground">{e.produtoNome ?? '—'}</TableCell>
                      <TableCellNum>{e.quantidade} {e.unidade}{e.quantidade > 1 ? 's' : ''}</TableCellNum>
                      <TableCell>
                        <BadgeCount>{e.destino === 'estoque' ? 'Estoque' : 'Pedido'}</BadgeCount>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.operadorNome}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
