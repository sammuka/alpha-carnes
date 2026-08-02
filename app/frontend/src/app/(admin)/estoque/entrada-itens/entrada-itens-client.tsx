'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info, PackagePlus, Search, X } from 'lucide-react';
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
    <div className="flex h-full max-w-[1664px] flex-col gap-5">
      <div>
        <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">Estoque / Entrada de Itens</p>
        <h2 className="text-2xl font-bold leading-tight text-brand-navy-deep">Entrada de Itens</h2>
        <p className="mt-1 text-sm text-muted-foreground">Registro de entrada de itens que não passam por balança</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-surface px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-info-icon" />
        <p className="text-[12px] leading-snug text-info-ink">
          Caixarias são vendidas por unidade; não passam por balança nem desossa.
        </p>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-lg border border-success-strong/30 bg-success-surface px-4 py-2.5">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success-strong" />
          <p className="text-[13px] text-success-strong">Entrada registrada com sucesso.</p>
        </div>
      )}

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-5">
        {podeRegistrar && (
          <div className="col-span-5 flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <h3 className="text-[14px] font-bold">Nova entrada</h3>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Produto <span className="text-destructive">*</span></label>
              <select
                value={produtoId}
                onChange={(e) => { setProdutoId(e.target.value); setPedidoSelecionado(null); }}
                className="h-9 w-full rounded-md border border-border px-2.5 text-[13px] focus:border-primary focus:outline-none"
              >
                <option value="">Selecionar...</option>
                {produtosCaixaria.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-semibold">Quantidade <span className="text-destructive">*</span></label>
                <input
                  type="number"
                  min={1}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="0"
                  className="h-9 w-full rounded-md border border-border px-2.5 text-[13px] placeholder:text-placeholder focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-semibold">Unidade</label>
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value as 'caixa' | 'unidade')}
                  className="h-9 w-full rounded-md border border-border px-2.5 text-[13px] focus:border-primary focus:outline-none"
                >
                  <option value="caixa">Caixa</option>
                  <option value="unidade">Unidade</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Fornecedor/origem <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                placeholder="Ex.: Frigorífico Boi Forte"
                className="h-9 w-full rounded-md border border-border px-2.5 text-[13px] placeholder:text-placeholder focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">
                Lote/NF <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
              </label>
              <input
                type="text"
                value={loteNf}
                onChange={(e) => setLoteNf(e.target.value)}
                placeholder="Ex.: NF 129110 / Lote #404"
                className="h-9 w-full rounded-md border border-border px-2.5 text-[13px] placeholder:text-placeholder focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Local/câmara</label>
              <select
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                className="h-9 w-full rounded-md border border-border px-2.5 text-[13px] focus:border-primary focus:outline-none"
              >
                {LOCAIS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold">Destino</label>
              <div className="flex gap-2">
                {(['estoque', 'pedido'] as Destino[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setDestino(d); setPedidoSelecionado(null); }}
                    className={`h-9 flex-1 rounded-md border text-[12px] font-semibold transition-colors ${
                      destino === d ? 'border-brand-navy-deep bg-brand-navy-deep text-white' : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    {d === 'estoque' ? 'Estoque' : 'Pedido'}
                  </button>
                ))}
              </div>
            </div>

            {destino === 'pedido' && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    placeholder="Buscar cliente"
                    className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[13px] placeholder:text-placeholder focus:border-primary focus:outline-none"
                  />
                </div>

                {produtoId === '' ? (
                  <p className="py-2 text-center text-[12px] text-muted-foreground">Selecione um produto para ver pedidos compatíveis.</p>
                ) : pedidosFiltrados.length === 0 ? (
                  <p className="py-2 text-center text-[12px] text-muted-foreground">Não há pedidos pendentes compatíveis.</p>
                ) : (
                  <div className="flex max-h-[160px] flex-col gap-1.5 overflow-y-auto">
                    {pedidosFiltrados.map((p) => {
                      const selecionado = pedidoSelecionado?.pedidoVendaItemId === p.pedidoVendaItemId;
                      return (
                        <button
                          key={p.pedidoVendaItemId}
                          type="button"
                          onClick={() => setPedidoSelecionado(selecionado ? null : p)}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                            selecionado ? 'border-action-blue bg-action-blue-bg' : 'border-border bg-card hover:border-muted-foreground'
                          }`}
                        >
                          <p className="text-[12px] font-bold">{p.clienteNome}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{p.pendencia}</p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {pedidoSelecionado && (
                  <div className="flex items-center justify-between rounded-lg border border-action-blue-border bg-action-blue-bg px-3 py-2 text-[12px] font-medium text-action-blue-text">
                    <span>{pedidoSelecionado.clienteNome}</span>
                    <button type="button" onClick={() => setPedidoSelecionado(null)} className="hover:opacity-70">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Observação</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-md border border-border px-2.5 py-2 text-[13px] focus:border-primary focus:outline-none"
              />
            </div>

            <div className="mt-2 flex gap-2">
              <button type="button" onClick={limparForm} className="h-9 flex-1 rounded-md border border-border text-[13px] font-medium text-muted-foreground hover:bg-muted/40">
                Limpar
              </button>
              <button
                type="button"
                disabled={!podeConfirmar || enviando}
                onClick={() => void handleConfirmar()}
                className="flex h-9 flex-[2] items-center justify-center gap-1.5 rounded-md bg-action-blue text-[13px] font-semibold text-white transition-colors hover:bg-action-blue-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PackagePlus className="h-4 w-4" /> Confirmar entrada
              </button>
            </div>
          </div>
        )}

        <div className={`${podeRegistrar ? 'col-span-7' : 'col-span-12'} flex flex-col overflow-hidden rounded-xl border border-border bg-card`}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[13px] font-bold">Entradas de hoje</p>
            <span className="text-[12px] text-muted-foreground">{entradas.length} registro{entradas.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex-1 overflow-auto">
            {entradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <PackagePlus className="h-8 w-8 text-placeholder" />
                <p className="text-[13px] text-muted-foreground">Nenhuma entrada registrada hoje.</p>
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Hora', 'Produto', 'Qtd', 'Destino', 'Operador'].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entradas.map((e, i) => (
                    <tr key={e.id} className={`border-b border-border/60 hover:bg-table-row-hover ${i % 2 !== 0 ? 'bg-table-zebra' : ''}`}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-muted-foreground">
                        {new Date(e.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-bold text-brand-navy-deep">{e.produtoNome ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{e.quantidade} {e.unidade}{e.quantidade > 1 ? 's' : ''}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            e.destino === 'estoque' ? 'bg-success-surface text-success-strong' : 'bg-action-blue-bg text-action-blue-strong'
                          }`}
                        >
                          {e.destino === 'estoque' ? 'Estoque' : 'Pedido'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{e.operadorNome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
