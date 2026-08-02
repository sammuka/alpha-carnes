'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ClipboardList,
  Eye,
  Info,
  Printer,
  RotateCcw,
  Search,
  SendHorizontal,
  Snowflake,
  Warehouse,
  X,
} from 'lucide-react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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

const STATUS_STYLE: Record<StatusRotuloEstoque, { bg: string; text: string }> = {
  Disponível: { bg: 'bg-success-surface', text: 'text-success-strong' },
  'Destinado a pedido': { bg: 'bg-action-blue-bg', text: 'text-action-blue-strong' },
  'Em desossa': { bg: 'bg-violet-surface', text: 'text-violet-800' },
  'Bloqueado por ocorrência': { bg: 'bg-danger-surface', text: 'text-danger-rose' },
};

function StatusBadge({ status }: { status: StatusRotuloEstoque }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE['Bloqueado por ocorrência'];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.bg} ${s.text}`}>
      {status}
    </span>
  );
}

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
      <DialogContent className="max-w-md gap-0 bg-card p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px] font-bold">Destinar item a pedido</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 p-5">
          <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-muted/40 p-3 text-[12px]">
            <div><span className="text-muted-foreground">Código: </span><span className="font-bold">{item.codigo}</span></div>
            <div><span className="text-muted-foreground">Produto: </span><span className="font-semibold">{item.produto.nome}</span></div>
            <div><span className="text-muted-foreground">Qtd: </span><span className="font-semibold">{item.quantidade} {item.unidade}</span></div>
            <div><span className="text-muted-foreground">Peso: </span><span className="font-semibold">{fmtPeso(item.peso)}</span></div>
            <div className="col-span-2"><span className="text-muted-foreground">Local: </span><span className="font-semibold">{item.local.valor ?? '—'}</span></div>
          </div>

          {item.tipo === 'entrada' && (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Quantidade a destinar</label>
              <input
                type="number"
                min={1}
                max={Number(item.quantidade)}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-border px-2.5 text-[13px]"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold">Pedidos compatíveis</label>
            {pedidos.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6">
                <Info className="h-6 w-6 text-placeholder" />
                <p className="px-4 text-center text-[12px] text-muted-foreground">Não há pedidos pendentes compatíveis com este produto.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {pedidos.map((p) => (
                  <button
                    key={p.pedidoVendaItemId}
                    type="button"
                    onClick={() => setSelecionado((s) => (s === p.pedidoVendaItemId ? null : p.pedidoVendaItemId))}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      selecionado === p.pedidoVendaItemId ? 'border-action-blue bg-action-blue-bg' : 'border-border bg-card hover:border-muted-foreground'
                    }`}
                  >
                    <p className="text-[12px] font-bold">{p.clienteNome}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{p.pendencia}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {erro && <p className="text-[12px] text-destructive">{erro}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose} className="h-8 flex-1 rounded-md border border-border text-[13px] font-medium text-muted-foreground hover:bg-muted/40">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selecionado || enviando}
            onClick={() => void confirmar()}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-action-blue text-[13px] font-semibold text-white transition-colors hover:bg-action-blue-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendHorizontal className="h-3.5 w-3.5" /> Confirmar destinação
          </button>
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
      <SheetContent side="right" className="flex w-[480px] max-w-full flex-col border-l border-border bg-card p-0">
        <SheetHeader className="flex flex-shrink-0 flex-row items-center justify-between border-b border-border px-6 py-4">
          <SheetTitle className="text-[15px] font-bold">Histórico — {item.codigo}</SheetTitle>
          <div className="flex items-center gap-2">
            <StatusBadge status={item.statusRotulo} />
            <button type="button" onClick={onClose} className="ml-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 p-6">
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dados do item</p>
              <div className="grid grid-cols-2 gap-y-2 rounded-lg bg-muted/40 p-4 text-[12px]">
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
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Linha do tempo</p>
              {erro ? (
                <p className="text-[12px] text-destructive">{erro}</p>
              ) : (
                <div className="flex flex-col gap-0">
                  {eventos.map((ev, i) => (
                    <div key={`${ev.dataHora}-${i}`} className="flex items-start gap-3 pb-3">
                      <div className="flex flex-col items-center">
                        <div className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${i === eventos.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                        {i < eventos.length - 1 && <div className="mt-1 min-h-[16px] w-px flex-1 bg-border" />}
                      </div>
                      <div>
                        <p className="text-[12px]">{ev.descricao}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(ev.dataHora).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 border-t border-border bg-card px-6 py-4">
          <button type="button" onClick={onClose} className="h-8 rounded-md border border-border px-4 text-[13px] font-medium text-muted-foreground hover:bg-muted/40">
            Fechar
          </button>
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
  const statusList: (StatusRotuloEstoque | 'Todos')[] = ['Todos', 'Disponível', 'Destinado a pedido', 'Em desossa', 'Bloqueado por ocorrência'];

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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, produto, origem ou NF/lote"
            className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[13px] placeholder:text-placeholder focus:border-primary focus:outline-none"
          />
        </div>
        {[
          { val: filtroProduto, set: setFiltroProduto, label: 'Produto', opts: produtos },
          { val: filtroStatus, set: setFiltroStatus, label: 'Status', opts: statusList },
          { val: filtroLocal, set: setFiltroLocal, label: 'Local', opts: locais },
        ].map(({ val, set, label, opts }) => (
          <select
            key={label}
            value={val}
            onChange={(e) => set(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2.5 text-[13px] text-muted-foreground focus:border-primary focus:outline-none"
          >
            {opts.map((o) => <option key={o} value={o}>{o === 'Todos' ? `${label}: Todos` : o}</option>)}
          </select>
        ))}
        <button type="button" onClick={limpar} className="flex h-8 items-center gap-1 rounded-md border border-border px-3 text-[12px] font-medium text-muted-foreground hover:bg-muted/40">
          <RotateCcw className="h-3 w-3" /> Limpar
        </button>
        <span className="ml-auto text-[12px] text-muted-foreground">{filtrados.length} item{filtrados.length !== 1 ? 's' : ''}</span>
      </div>

      {erroAcao && <p className="text-[12px] text-destructive">{erroAcao}</p>}

      <div className="flex-1 overflow-hidden rounded-xl border border-border bg-card">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Search className="h-8 w-8 text-placeholder" />
            <p className="text-[13px] text-muted-foreground">Nenhum item encontrado com os filtros selecionados.</p>
            <button type="button" onClick={limpar} className="h-7 rounded-md border border-border px-3 text-[12px] font-medium text-muted-foreground hover:bg-muted/40">
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Código', 'Produto', 'Tipo', 'Qtd', 'Peso', 'Origem/Frigorífico', 'NF/Lote', 'Entrada', 'Local', 'Status', 'Características', 'Pedido reservado', ''].map((h) => (
                    <th key={h || 'acoes'} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item, i) => {
                  const bloqueado = item.statusRotulo === 'Bloqueado por ocorrência';
                  const podeDestinar = item.statusRotulo === 'Disponível';
                  const podeReimprimir = item.tipo !== 'entrada';
                  return (
                    <tr key={`${item.tipo}-${item.id}`} className={`border-b border-border/60 hover:bg-table-row-hover ${i % 2 !== 0 ? 'bg-table-zebra' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-action-blue-bg px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand-navy-deep">{item.codigo}</span>
                          {item.estoqueAnterior && (
                            <span
                              title="Item recebido em dia anterior — consumido antes pela regra FIFO"
                              className="cursor-help whitespace-nowrap rounded-full bg-warning-surface px-1.5 py-0.5 text-[9px] font-bold text-warning-ink"
                            >
                              Estoque anterior
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-bold text-brand-navy-deep">{item.produto.nome}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-muted-foreground">
                        {item.tipo === 'peca' ? 'Peça inteira' : item.tipo === 'subitem' ? 'Parte de desossa' : 'Caixa por unidade'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{item.quantidade} {item.unidade}</td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{fmtPeso(item.peso)}</td>
                      <td className="max-w-[160px] truncate px-4 py-2.5 text-muted-foreground">{item.origem}</td>
                      <td className="max-w-[150px] truncate px-4 py-2.5 text-muted-foreground">{item.nfLote ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {item.local.valor ?? '—'}
                        {item.local.provisorio && <BadgeProvisorio pendencia="P1" className="ml-1" />}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={item.statusRotulo} /></td>
                      <td className="max-w-[140px] truncate px-4 py-2.5 text-muted-foreground">
                        {item.caracteristicas.length > 0 ? item.caracteristicas.join(', ') : '—'}
                      </td>
                      <td className="max-w-[170px] truncate px-4 py-2.5 text-muted-foreground">{item.pedidoReservado ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {podeDestinar && (
                            <button
                              type="button"
                              title="Destinar a pedido"
                              onClick={() => setModalDestinar(item)}
                              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-action-blue-bg hover:text-action-blue"
                            >
                              <SendHorizontal className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {podeReimprimir && (
                            <button
                              type="button"
                              title="Reimprimir etiqueta"
                              onClick={() => void handleReimprimir(item)}
                              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
                            >
                              {reimprimindo === item.id ? (
                                <Printer className="h-3.5 w-3.5 animate-pulse text-action-blue" />
                              ) : (
                                <Printer className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            title="Histórico"
                            onClick={() => setDrawerHistorico(item)}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {bloqueado && (
                            <span title="Item bloqueado por ocorrência aberta" className="flex h-7 w-7 cursor-help items-center justify-center text-muted-foreground">
                              <Ban className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-6">
      <div className="col-span-7 flex flex-col gap-6">
        <Card className="flex h-full flex-col rounded-xl border-t-4 border-t-warning-ink shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-ink" />
              <h3 className="text-[16px] font-bold text-brand-navy-deep">Sobras Críticas</h3>
              <BadgeProvisorio pendencia="P3" texto="Validade por lote pendente de modelagem" />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {sobrasCriticas.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">Nenhuma sobra crítica no momento.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {sobrasCriticas.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-surface">
                        <ClipboardList className="h-5 w-5 text-warning-ink" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h4 className="text-[14px] font-bold text-brand-navy-deep">{item.produto.nome} — {item.codigo}</h4>
                        <p className="text-[12px] text-muted-foreground">
                          Validade: <span className="font-bold text-warning-ink">—</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[16px] font-bold text-brand-navy-deep">{item.quantidade} {item.unidade}</p>
                      </div>
                      <Button variant="outline" className="h-8 border-action-blue text-[12px] text-action-blue" onClick={() => onDestinar(item)}>
                        Decidir Destino
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="col-span-5 flex flex-col gap-6">
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="mb-2 flex items-center gap-2">
              <Snowflake className="h-5 w-5 text-action-blue" />
              <h3 className="text-[16px] font-bold text-brand-navy-deep">Túnel de Congelamento</h3>
              <BadgeProvisorio pendencia="P3" />
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex justify-between text-[13px] font-bold">
                <span className="text-muted-foreground">Ocupação Atual</span>
                <span>— / 10.000 kg</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-action-blue" style={{ width: '0%' }} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Ocupação real pendente de modelagem (P3).</p>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <Button
                disabled
                title="Fluxo de congelamento pendente de modelagem"
                className="h-12 w-full font-bold"
              >
                Autorizar Congelamento
              </Button>
              <Button variant="outline" asChild className="h-12 w-full border-destructive font-medium text-destructive hover:bg-danger-surface">
                <a href="/estoque/ajustes">Apontar Quebra / Descarte</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
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
    <div className="flex h-full max-w-[1664px] flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-tight text-brand-navy-deep">Estoque / Consulta de Estoque</h2>
          <p className="mt-1 text-sm text-muted-foreground">Posição física de itens disponíveis, reservados ou destinados</p>
        </div>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setAba('consulta')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors ${
            aba === 'consulta' ? 'border-primary text-brand-navy-deep' : 'border-transparent text-muted-foreground hover:text-brand-navy-deep'
          }`}
        >
          <Warehouse className="h-4 w-4" /> Consulta de Estoque
        </button>
        <button
          type="button"
          onClick={() => setAba('sobras')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors ${
            aba === 'sobras' ? 'border-primary text-brand-navy-deep' : 'border-transparent text-muted-foreground hover:text-brand-navy-deep'
          }`}
        >
          <ClipboardList className="h-4 w-4" /> Sobras &amp; Congelamento
        </button>
      </div>

      {aba === 'consulta' ? (
        <AbaConsultaEstoque itens={itens} onRefetch={() => void carregar()} />
      ) : (
        <AbaSobrasCongelamento itens={itens} onDestinar={setDestinarSobra} />
      )}

      <ModalDestinar
        open={!!destinarSobra}
        onClose={() => setDestinarSobra(null)}
        item={destinarSobra}
        onConfirmado={() => void carregar()}
      />
    </div>
  );
}
