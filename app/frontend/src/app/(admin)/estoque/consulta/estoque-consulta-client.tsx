'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ClipboardList,
  Eye,
  Printer,
  RotateCcw,
  Search,
  SendHorizontal,
} from 'lucide-react';
import { BadgeCount } from '@/components/ui/badge-count';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { conectarRealtime } from '@/lib/realtime';
import {
  compativeisEntrada,
  compativeisPeca,
  compativeisSubitem,
  consultarEstoque,
  destinarItem,
  historicoItem,
  type EventoHistoricoEstoque,
  type ItemEstoqueConsulta,
  type PedidoCompativelEstoque,
  type StatusRotuloEstoque,
} from '@/lib/estoque';

const EVENTOS_REFETCH = new Set([
  'estoque_item_destinado',
  'entrada_itens_registrada',
  'ajuste_estoque_criado',
  'ajuste_estoque_decidido',
  'peca_associada',
  'subitem_associado',
]);

const STATUS_VARIANT: Record<StatusRotuloEstoque, StatusPillVariant> = {
  Disponível: 'expedido',
  'Destinado a pedido': 'recebido',
  'Em desossa': 'pendente',
  'Bloqueado por ocorrência': 'bloqueado',
};

function fmtPeso(peso: string | null): string {
  if (peso === null) return '—';
  const n = Number.parseFloat(peso);
  return Number.isFinite(n) ? `${n.toFixed(3).replace('.', ',')} kg` : '—';
}

// ── Modal: Destinar a pedido ──────────────────────────────────────────────────

function ModalDestinar({
  open,
  onClose,
  item,
  onConfirmado,
}: {
  open: boolean;
  onClose: () => void;
  item: ItemEstoqueConsulta | null;
  onConfirmado: () => void;
}) {
  const [pedidos, setPedidos] = useState<PedidoCompativelEstoque[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!item) return;
    setSelecionado(null);
    setQuantidade(1);
    setErro(null);
    const carregar =
      item.tipo === 'peca'
        ? compativeisPeca(item.id)
        : item.tipo === 'subitem'
          ? compativeisSubitem(item.id)
          : compativeisEntrada(item.id);
    void carregar
      .then(setPedidos)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar pedidos compatíveis'));
  }, [item]);

  if (!item) return null;

  const confirmar = async () => {
    if (!selecionado) return;
    setEnviando(true);
    setErro(null);
    try {
      await destinarItem({
        tipo: item.tipo,
        id: item.id,
        pedidoVendaItemId: selecionado,
        ...(item.tipo === 'entrada' ? { quantidade } : {}),
      });
      onConfirmado();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao destinar item');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Destinar item a pedido</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-surface-2 p-3 text-[12px]">
          <div><span className="text-muted-foreground">Código: </span><span className="font-data font-bold">{item.codigo}</span></div>
          <div><span className="text-muted-foreground">Produto: </span><span className="font-semibold">{item.produto.nome}</span></div>
          <div><span className="text-muted-foreground">Qtd: </span><span className="font-semibold">{item.quantidade} {item.unidade}</span></div>
          <div><span className="text-muted-foreground">Peso: </span><span className="font-semibold">{fmtPeso(item.peso)}</span></div>
          <div className="col-span-2"><span className="text-muted-foreground">Local: </span><span className="font-semibold">{item.local.valor ?? '—'}</span></div>
        </div>

        {item.tipo === 'entrada' && (
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold">Quantidade a destinar</label>
            <Input
              type="number"
              min={1}
              max={Number(item.quantidade)}
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-semibold">Pedidos compatíveis</label>
          {pedidos.length === 0 ? (
            <EmptyState title="Não há pedidos pendentes compatíveis com este produto." />
          ) : (
            <div className="flex max-h-[220px] flex-col overflow-y-auto overflow-x-hidden rounded-md border border-border">
              {pedidos.map((p) => (
                <button
                  key={p.pedidoVendaItemId}
                  type="button"
                  onClick={() => setSelecionado((s) => (s === p.pedidoVendaItemId ? null : p.pedidoVendaItemId))}
                  className={cn(
                    'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 last:border-b-0 hover:bg-surface-2',
                    selecionado === p.pedidoVendaItemId && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                  )}
                >
                  <span className="block truncate text-[13px] font-semibold">{p.clienteNome}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{p.pendencia}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {erro && <p className="text-[12px] text-destructive">{erro}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!selecionado || enviando}
            onClick={() => void confirmar()}
          >
            <SendHorizontal /> Confirmar destinação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Drawer: Histórico ─────────────────────────────────────────────────────────

function DrawerHistorico({ open, onClose, item }: { open: boolean; onClose: () => void; item: ItemEstoqueConsulta | null }) {
  const [eventos, setEventos] = useState<EventoHistoricoEstoque[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setErro(null);
    historicoItem(item.tipo, item.id)
      .then(setEventos)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar histórico'));
  }, [item]);

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="overflow-y-auto sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>Histórico — {item.codigo}</SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            <StatusPill variant={STATUS_VARIANT[item.statusRotulo]} label={item.statusRotulo} />
          </div>
        </SheetHeader>
        <div className="flex flex-col gap-3 p-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dados do item</p>
            <div className="grid grid-cols-2 gap-y-2 rounded-lg bg-surface-2 p-3 text-[12px]">
              <div><span className="text-muted-foreground">Produto: </span><span className="font-semibold">{item.produto.nome}</span></div>
              <div><span className="text-muted-foreground">Tipo: </span><span className="font-semibold">{item.tipo}</span></div>
              <div><span className="text-muted-foreground">Qtd: </span><span className="font-semibold">{item.quantidade} {item.unidade}</span></div>
              <div><span className="text-muted-foreground">Peso: </span><span className="font-semibold">{fmtPeso(item.peso)}</span></div>
              <div><span className="text-muted-foreground">Local: </span><span className="font-semibold">{item.local.valor ?? '—'}</span></div>
              <div><span className="text-muted-foreground">Entrada: </span><span className="font-semibold">{new Date(item.createdAt).toLocaleString('pt-BR')}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">Origem: </span><span className="font-semibold">{item.origem}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">NF/Lote: </span><span>{item.nfLote ?? '—'}</span></div>
              {item.pedidoReservado && (
                <div className="col-span-2"><span className="text-muted-foreground">Pedido: </span><span>{item.pedidoReservado}</span></div>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Linha do tempo</p>
            {erro ? (
              <p className="text-[12px] text-destructive">{erro}</p>
            ) : (
              <div className="flex flex-col gap-0">
                {eventos.map((ev, i) => (
                  <div key={`${ev.dataHora}-${i}`} className="flex items-start gap-3 pb-3">
                    <div className="flex flex-col items-center">
                      <div className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', i === eventos.length - 1 ? 'bg-primary' : 'bg-fg-faint')} />
                      {i < eventos.length - 1 && <div className="mt-1 min-h-[16px] w-px flex-1 bg-border" />}
                    </div>
                    <div>
                      <p className="text-[12px]">{ev.descricao}</p>
                      <p className="font-data text-[10px] text-fg-faint">{new Date(ev.dataHora).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Aba: Consulta de Estoque ──────────────────────────────────────────────────

function AbaConsultaEstoque({
  itens,
  onRefetch,
}: {
  itens: ItemEstoqueConsulta[];
  onRefetch: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [filtroProduto, setFiltroProduto] = useState('Todos');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroLocal, setFiltroLocal] = useState('Todos');
  const [modalDestinar, setModalDestinar] = useState<ItemEstoqueConsulta | null>(null);
  const [drawerHistorico, setDrawerHistorico] = useState<ItemEstoqueConsulta | null>(null);
  const [reimprimindo, setReimprimindo] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const produtos = useMemo(() => ['Todos', ...Array.from(new Set(itens.map((i) => i.produto.nome)))], [itens]);
  const locais = useMemo(() => ['Todos', ...Array.from(new Set(itens.map((i) => i.local.valor).filter((v): v is string => v !== null)))], [itens]);
  // 'Reservado' não tem fonte no modelo (reserva é de disponibilidade virtual, não de peça física):
  // opção mantida por fidelidade ao protótipo (D8.2) — sempre retorna lista vazia.
  const statusList: (StatusRotuloEstoque | 'Todos' | 'Reservado')[] = ['Todos', 'Disponível', 'Reservado', 'Destinado a pedido', 'Em desossa', 'Bloqueado por ocorrência'];

  const limpar = () => { setBusca(''); setFiltroProduto('Todos'); setFiltroStatus('Todos'); setFiltroLocal('Todos'); };

  const filtrados = itens.filter((i) => {
    const q = busca.toLowerCase();
    if (q && ![i.codigo, i.produto.nome, i.origem, i.nfLote ?? ''].some((v) => v.toLowerCase().includes(q))) return false;
    if (filtroProduto !== 'Todos' && i.produto.nome !== filtroProduto) return false;
    if (filtroStatus !== 'Todos' && i.statusRotulo !== filtroStatus) return false;
    if (filtroLocal !== 'Todos' && i.local.valor !== filtroLocal) return false;
    return true;
  });

  const handleReimprimir = async (item: ItemEstoqueConsulta) => {
    setErroAcao(null);
    setReimprimindo(item.id);
    try {
      const rota =
        item.tipo === 'peca'
          ? `/api/operacao/pesagem/pecas/${item.id}/etiqueta/reimprimir`
          : `/api/operacao/corte/subitens/${item.id}/etiqueta/reimprimir`;
      const res = await fetch(rota, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErroAcao((body as { message?: string }).message ?? 'Falha ao reimprimir etiqueta');
      }
    } catch {
      setErroAcao('Erro de conexão ao reimprimir etiqueta');
    } finally {
      setTimeout(() => setReimprimindo(null), 1200);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <Card>
        <CardHeader>
          <CardTitle>Itens em estoque</CardTitle>
          <BadgeCount>{filtrados.length}</BadgeCount>
          <CardAction>
            <div className="w-[240px]">
              <Input
                adornLeft={<Search />}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por código, produto, origem ou NF/lote"
                className="h-7 text-xs"
              />
            </div>
            <SelectNative
              aria-label="Produto"
              selectSize="sm"
              className="w-[140px]"
              value={filtroProduto}
              onChange={(e) => setFiltroProduto(e.target.value)}
            >
              {produtos.map((o) => <option key={o} value={o}>{o === 'Todos' ? 'Produto: Todos' : o}</option>)}
            </SelectNative>
            <SelectNative
              aria-label="Status"
              selectSize="sm"
              className="w-[150px]"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              {statusList.map((o) => <option key={o} value={o}>{o === 'Todos' ? 'Status: Todos' : o}</option>)}
            </SelectNative>
            <SelectNative
              aria-label="Local"
              selectSize="sm"
              className="w-[140px]"
              value={filtroLocal}
              onChange={(e) => setFiltroLocal(e.target.value)}
            >
              {locais.map((o) => <option key={o} value={o}>{o === 'Todos' ? 'Local: Todos' : o}</option>)}
            </SelectNative>
            <Button type="button" variant="ghost" size="sm" onClick={limpar}>
              <RotateCcw /> Limpar
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {erroAcao && <p className="px-3 pt-2 text-[12px] text-destructive">{erroAcao}</p>}
          {filtrados.length === 0 ? (
            <EmptyState icon={<Search />} title="Nenhum item encontrado com os filtros selecionados." className="py-12" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Peso (kg)</TableHead>
                  <TableHead>Origem/Frigorífico</TableHead>
                  <TableHead>NF/Lote</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Características</TableHead>
                  <TableHead>Pedido reservado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((item) => {
                  const bloqueado = item.statusRotulo === 'Bloqueado por ocorrência';
                  const podeDestinar = item.statusRotulo === 'Disponível';
                  const podeReimprimir = item.tipo !== 'entrada';
                  return (
                    <TableRow key={`${item.tipo}-${item.id}`} className="group">
                      <TableCellCode>
                        <div className="flex items-center gap-1.5">
                          {item.codigo}
                          {item.estoqueAnterior && (
                            <span
                              title="Item recebido em dia anterior — consumido antes pela regra FIFO"
                              className="cursor-help whitespace-nowrap rounded-full bg-status-pendente-bg px-1.5 py-0.5 text-[9px] font-bold text-status-pendente"
                            >
                              Estoque anterior
                            </span>
                          )}
                        </div>
                      </TableCellCode>
                      <TableCell className="text-[13px] font-semibold text-foreground">{item.produto.nome}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.tipo === 'peca' ? 'Peça inteira' : item.tipo === 'subitem' ? 'Parte de desossa' : 'Caixa por unidade'}
                      </TableCell>
                      <TableCellNum>{item.quantidade} {item.unidade}</TableCellNum>
                      <TableCellNum>{fmtPeso(item.peso)}</TableCellNum>
                      <TableCell className="max-w-[160px] truncate text-muted-foreground">{item.origem}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">{item.nfLote ?? '—'}</TableCell>
                      <TableCellNum>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</TableCellNum>
                      <TableCell>
                        {item.local.valor ?? '—'}
                        {item.local.provisorio && <BadgeProvisorio codigo="P1" className="ml-1" />}
                      </TableCell>
                      <TableCell><StatusPill variant={STATUS_VARIANT[item.statusRotulo]} label={item.statusRotulo} /></TableCell>
                      <TableCell className="max-w-[140px] truncate text-muted-foreground">
                        {item.caracteristicas.length > 0 ? item.caracteristicas.join(', ') : '—'}
                      </TableCell>
                      <TableCell className="max-w-[170px] truncate text-muted-foreground">{item.pedidoReservado ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          {podeDestinar && (
                            <Button variant="secondary" size="sm" onClick={() => setModalDestinar(item)}>
                              <SendHorizontal /> Destinar
                            </Button>
                          )}
                          {podeReimprimir && (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              aria-label="Reimprimir etiqueta"
                              onClick={() => void handleReimprimir(item)}
                            >
                              <Printer className={reimprimindo === item.id ? 'animate-pulse' : undefined} />
                            </Button>
                          )}
                          <Button variant="ghost" size="iconSm" aria-label="Histórico" onClick={() => setDrawerHistorico(item)}>
                            <Eye />
                          </Button>
                          {bloqueado && (
                            <span title="Item bloqueado por ocorrência aberta" className="flex size-7 cursor-help items-center justify-center text-muted-foreground">
                              <Ban className="size-3.5" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ModalDestinar
        open={!!modalDestinar}
        onClose={() => setModalDestinar(null)}
        item={modalDestinar}
        onConfirmado={onRefetch}
      />
      <DrawerHistorico open={!!drawerHistorico} onClose={() => setDrawerHistorico(null)} item={drawerHistorico} />
    </div>
  );
}

// ── Aba: Sobras & Congelamento ────────────────────────────────────────────────

function AbaSobrasCongelamento({
  itens,
  onDestinar,
}: {
  itens: ItemEstoqueConsulta[];
  onDestinar: (item: ItemEstoqueConsulta) => void;
}) {
  const sobrasCriticas = useMemo(
    () => itens.filter((i) => i.statusRotulo === 'Disponível' && i.estoqueAnterior).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [itens],
  );

  return (
    <div className="grid gap-2.5 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Sobras Críticas</CardTitle>
          <BadgeProvisorio codigo="P3" texto="Validade por lote pendente de modelagem" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sobrasCriticas.length === 0 ? (
            <EmptyState icon={<ClipboardList />} title="Nenhuma sobra crítica no momento." className="py-10" />
          ) : (
            sobrasCriticas.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-[13px] font-bold text-foreground">{item.produto.nome} — {item.codigo}</p>
                  <p className="text-[11px] text-muted-foreground">Validade: <span className="font-bold text-status-pendente">—</span></p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-data text-[13px] font-bold">{item.quantidade} {item.unidade}</span>
                  <Button variant="secondary" size="sm" onClick={() => onDestinar(item)}>
                    Decidir Destino
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Túnel de Congelamento</CardTitle>
          <BadgeProvisorio codigo="P3" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="flex justify-between text-[12px] font-bold">
              <span className="text-muted-foreground">Ocupação Atual</span>
              <span className="font-data">— / 10.000 kg</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-surface-3">
              <div className="h-1 rounded-full bg-primary" style={{ width: '0%' }} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Ocupação real pendente de modelagem (P3).</p>
          </div>

          <Button disabled title="Fluxo de congelamento pendente de modelagem">
            Autorizar Congelamento
          </Button>
          <Button variant="destructiveOutline" asChild>
            <a href="/estoque/ajustes">Apontar Quebra / Descarte</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function EstoqueConsultaClient({ permissoes }: { permissoes: string[] }) {
  void permissoes;
  const [aba, setAba] = useState<'consulta' | 'sobras'>('consulta');
  const [itens, setItens] = useState<ItemEstoqueConsulta[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [destinarSobra, setDestinarSobra] = useState<ItemEstoqueConsulta | null>(null);

  const carregar = useCallback(async () => {
    try {
      setItens(await consultarEstoque());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar estoque');
    }
  }, []);

  useEffect(() => {
    void carregar();
    const off = conectarRealtime({
      rooms: ['dashboard'],
      onMessage: (msg) => {
        if (EVENTOS_REFETCH.has(msg.type)) void carregar();
      },
      onReconnect: () => void carregar(),
    });
    return off;
  }, [carregar]);

  return (
    <div className="space-y-3">
      <PageHeader title="Consulta de Estoque" subtitle="Posição física de itens disponíveis, reservados ou destinados" />

      {erro && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-danger-soft-border bg-danger-soft p-3 text-xs text-danger-fg">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {erro}
        </div>
      )}

      <Tabs value={aba} onValueChange={(v) => setAba(v as 'consulta' | 'sobras')}>
        <TabsList>
          <TabsTrigger value="consulta">Consulta de Estoque</TabsTrigger>
          <TabsTrigger value="sobras">Sobras &amp; Congelamento</TabsTrigger>
        </TabsList>

        <TabsContent value="consulta">
          <AbaConsultaEstoque itens={itens} onRefetch={() => void carregar()} />
        </TabsContent>
        <TabsContent value="sobras">
          <AbaSobrasCongelamento itens={itens} onDestinar={setDestinarSobra} />
        </TabsContent>
      </Tabs>

      <ModalDestinar
        open={!!destinarSobra}
        onClose={() => setDestinarSobra(null)}
        item={destinarSobra}
        onConfirmado={() => void carregar()}
      />
    </div>
  );
}
