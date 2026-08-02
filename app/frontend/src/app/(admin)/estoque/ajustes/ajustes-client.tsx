'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Info, Search, ShieldAlert, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  aprovarAjuste,
  consultarEstoque,
  criarAjuste,
  listarAjustes,
  rejeitarAjuste,
  type AjusteEstoque,
  type ItemEstoqueConsulta,
} from '@/lib/estoque';

const MOTIVOS: Array<{ value: AjusteEstoque['motivo']; label: string }> = [
  { value: 'quebra', label: 'Quebra' },
  { value: 'perda', label: 'Perda' },
  { value: 'erro_contagem', label: 'Erro de contagem' },
  { value: 'vencimento', label: 'Vencimento' },
  { value: 'outro', label: 'Outro' },
];

const STATUS_STYLE: Record<AjusteEstoque['status'], { bg: string; text: string; label: string }> = {
  aplicado: { bg: 'bg-success-surface', text: 'text-success-strong', label: 'Aplicado' },
  aguardando_aprovacao: { bg: 'bg-warning-surface', text: 'text-warning-ink', label: 'Aguardando aprovação' },
  rejeitado: { bg: 'bg-danger-surface', text: 'text-danger-rose', label: 'Rejeitado' },
};

function StatusBadge({ status }: { status: AjusteEstoque['status'] }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ── Modal: Aprovar/Rejeitar ────────────────────────────────────────────────────

function ModalDecisao({
  open,
  onClose,
  ajuste,
  decisao,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  ajuste: AjusteEstoque | null;
  decisao: 'aprovar' | 'rejeitar' | null;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setMotivo('');
    setErro(null);
  }, [ajuste, decisao]);

  if (!ajuste || !decisao) return null;
  const aprovar = decisao === 'aprovar';
  const podeConfirmar = aprovar || motivo.trim().length >= 5;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md gap-0 bg-card p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px] font-bold">
            {aprovar ? 'Aprovar ajuste de estoque' : 'Rejeitar ajuste de estoque'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 p-5">
          <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-muted/40 p-3 text-[12px]">
            <div><span className="text-muted-foreground">Código: </span><span className="font-bold">{ajuste.itemCodigo}</span></div>
            <div><span className="text-muted-foreground">Ajuste: </span><span className={`font-semibold ${ajuste.quantidadeDelta >= 0 ? 'text-success-strong' : 'text-destructive'}`}>{ajuste.quantidadeDelta >= 0 ? '+' : ''}{ajuste.quantidadeDelta}</span></div>
            <div><span className="text-muted-foreground">Motivo: </span><span className="font-semibold">{MOTIVOS.find((m) => m.value === ajuste.motivo)?.label ?? ajuste.motivo}</span></div>
            <div><span className="text-muted-foreground">Responsável: </span><span className="font-semibold">{ajuste.responsavelNome ?? '—'}</span></div>
          </div>

          {!aprovar && (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Motivo da rejeição (mín. 5 caracteres) <span className="text-destructive">*</span></label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
            </div>
          )}

          <div className={`flex items-start gap-2 rounded-lg p-3 ${aprovar ? 'border border-success-strong/30 bg-success-surface' : 'border border-danger-border bg-danger-surface'}`}>
            {aprovar ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success-strong" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
            )}
            <p className={`text-[12px] leading-snug ${aprovar ? 'text-success-strong' : 'text-danger-rose'}`}>
              {aprovar
                ? 'Ao aprovar, o ajuste será aplicado ao saldo físico do item.'
                : 'Ao rejeitar, o ajuste não será aplicado e o saldo físico permanece inalterado.'}
            </p>
          </div>

          {erro && <p className="text-[12px] text-destructive">{erro}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose} className="h-8 flex-1 rounded-md border border-border text-[13px] font-medium text-muted-foreground hover:bg-muted/40">
            Voltar
          </button>
          <button
            type="button"
            disabled={!podeConfirmar}
            onClick={() => {
              setErro(null);
              onConfirm(motivo.trim());
            }}
            className={`h-8 flex-1 rounded-md text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              aprovar ? 'bg-success-strong hover:bg-success-strong/90' : 'bg-destructive hover:bg-destructive/90'
            }`}
          >
            {aprovar ? 'Confirmar aprovação' : 'Confirmar rejeição'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AjustesEstoqueClient({
  podeAjustar,
  podeAprovar,
  nomeUsuario,
}: {
  podeAjustar: boolean;
  podeAprovar: boolean;
  nomeUsuario: string;
}) {
  const [buscaItem, setBuscaItem] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState<ItemEstoqueConsulta | null>(null);
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemEstoqueConsulta[]>([]);
  const [ajusteValor, setAjusteValor] = useState('');
  const [motivo, setMotivo] = useState<AjusteEstoque['motivo'] | ''>('');
  const [descricao, setDescricao] = useState('');
  const [limiar, setLimiar] = useState(5);

  const [ajustes, setAjustes] = useState<AjusteEstoque[]>([]);
  const [feedback, setFeedback] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [modalDecisao, setModalDecisao] = useState<{ ajuste: AjusteEstoque; decisao: 'aprovar' | 'rejeitar' } | null>(null);

  const carregarAjustes = useCallback(async () => {
    try {
      const res = await listarAjustes(1, 50);
      setAjustes(res.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao listar ajustes');
    }
  }, []);

  useEffect(() => {
    void carregarAjustes();
    void consultarEstoque({ status: 'disponivel' }).then(setItensDisponiveis).catch(() => setItensDisponiveis([]));
    void fetch('/api/admin/parametros/chave/estoque.limiar_aprovacao_ajuste', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((p: { valorJson?: { valor?: number } } | null) => {
        if (typeof p?.valorJson?.valor === 'number') setLimiar(p.valorJson.valor);
      })
      .catch(() => undefined);
  }, [carregarAjustes]);

  const itensFiltrados = useMemo(
    () =>
      itensDisponiveis.filter(
        (i) => buscaItem === '' || i.codigo.toLowerCase().includes(buscaItem.toLowerCase()) || i.produto.nome.toLowerCase().includes(buscaItem.toLowerCase()),
      ),
    [itensDisponiveis, buscaItem],
  );

  const ajusteNumerico = Number.parseInt(ajusteValor, 10);
  const ajusteValido = !Number.isNaN(ajusteNumerico) && ajusteNumerico !== 0;
  const qtdAtual = itemSelecionado ? Number(itemSelecionado.quantidade) : null;
  const qtdAjustada = itemSelecionado && ajusteValido && qtdAtual !== null ? qtdAtual + ajusteNumerico : null;
  const requerAprovacao = ajusteValido && Math.abs(ajusteNumerico) > limiar;
  const podeConfirmar = podeAjustar && itemSelecionado !== null && ajusteValido && motivo !== '';

  const limparForm = () => {
    setItemSelecionado(null);
    setBuscaItem('');
    setAjusteValor('');
    setMotivo('');
    setDescricao('');
  };

  const handleConfirmar = async () => {
    if (!podeConfirmar || !itemSelecionado || !motivo) return;
    setEnviando(true);
    setErro(null);
    try {
      await criarAjuste({
        tipo: itemSelecionado.tipo,
        id: itemSelecionado.id,
        quantidadeDelta: ajusteNumerico,
        motivo,
        descricao: descricao.trim() || undefined,
      });
      setFeedback(true);
      setTimeout(() => setFeedback(false), 2500);
      limparForm();
      await carregarAjustes();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao criar ajuste');
    } finally {
      setEnviando(false);
    }
  };

  const handleDecisao = async (motivoDecisao: string) => {
    if (!modalDecisao) return;
    setErro(null);
    try {
      if (modalDecisao.decisao === 'aprovar') {
        await aprovarAjuste(modalDecisao.ajuste.id);
      } else {
        await rejeitarAjuste(modalDecisao.ajuste.id, motivoDecisao);
      }
      setModalDecisao(null);
      await carregarAjustes();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na decisão do ajuste');
    }
  };

  return (
    <div className="flex h-full max-w-[1664px] flex-col gap-5">
      <div>
        <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">Estoque / Ajustes</p>
        <h2 className="text-2xl font-bold leading-tight text-brand-navy-deep">Ajustes de Estoque</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ajuste controlado de saldo físico, com aprovação quando necessário</p>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-lg border border-success-strong/30 bg-success-surface px-4 py-2.5">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success-strong" />
          <p className="text-[13px] text-success-strong">Ajuste registrado com sucesso.</p>
        </div>
      )}
      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-5">
        {podeAjustar && (
          <div className="col-span-5 flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <h3 className="text-[14px] font-bold">Novo ajuste</h3>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Produto/item <span className="text-destructive">*</span></label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={buscaItem}
                  onChange={(e) => { setBuscaItem(e.target.value); setItemSelecionado(null); }}
                  placeholder="Buscar por código ou produto"
                  className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[13px] placeholder:text-placeholder focus:border-primary focus:outline-none"
                />
              </div>
              {buscaItem !== '' && !itemSelecionado && (
                <div className="mt-1 flex max-h-[160px] flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-muted/40 p-1.5">
                  {itensFiltrados.length === 0 ? (
                    <p className="py-2 text-center text-[12px] text-muted-foreground">Nenhum item encontrado.</p>
                  ) : (
                    itensFiltrados.map((i) => (
                      <button
                        key={`${i.tipo}-${i.id}`}
                        type="button"
                        onClick={() => { setItemSelecionado(i); setBuscaItem(`${i.codigo} — ${i.produto.nome}`); }}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-card"
                      >
                        <span className="text-[12px] font-semibold">{i.codigo} — {i.produto.nome}</span>
                        <span className="text-[11px] text-muted-foreground">{i.quantidade} {i.unidade}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {itemSelecionado && (
              <div className="flex items-center justify-between rounded-lg border border-action-blue-border bg-action-blue-bg px-3 py-2 text-[12px] font-medium text-action-blue-text">
                <span>{itemSelecionado.codigo} — {itemSelecionado.produto.nome}{itemSelecionado.local.valor ? ` • ${itemSelecionado.local.valor}` : ''}</span>
                <button type="button" onClick={() => { setItemSelecionado(null); setBuscaItem(''); }} className="hover:opacity-70">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Quantidade/peso atual</label>
              <input
                readOnly
                value={itemSelecionado ? `${itemSelecionado.quantidade} ${itemSelecionado.unidade}` : '—'}
                className="h-9 w-full rounded-md border border-border bg-muted/40 px-2.5 text-[13px] text-muted-foreground"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Ajuste (+/-) <span className="text-destructive">*</span></label>
              <input
                type="number"
                value={ajusteValor}
                onChange={(e) => setAjusteValor(e.target.value)}
                placeholder="Ex.: -2 ou +3"
                className="h-9 w-full rounded-md border border-border px-2.5 text-[13px] placeholder:text-placeholder focus:border-primary focus:outline-none"
              />
            </div>

            {itemSelecionado && ajusteValido && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px]">
                <span className="text-muted-foreground">Quantidade ajustada:</span>
                <span className={`font-bold ${(qtdAjustada ?? 0) < 0 ? 'text-destructive' : ''}`}>
                  {qtdAjustada} {itemSelecionado.unidade}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Motivo <span className="text-destructive">*</span></label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as AjusteEstoque['motivo'])}
                className="h-9 w-full rounded-md border border-border px-2.5 text-[13px] focus:border-primary focus:outline-none"
              >
                <option value="">Selecionar...</option>
                {MOTIVOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Descrição</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                placeholder="Detalhe o motivo do ajuste"
                className="w-full resize-none rounded-md border border-border px-2.5 py-2 text-[13px] placeholder:text-placeholder focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold">Responsável</label>
              <input readOnly value={nomeUsuario} className="h-9 w-full rounded-md border border-border bg-muted/40 px-2.5 text-[13px] text-muted-foreground" />
            </div>

            <label className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ${requerAprovacao ? 'border-provisorio-border bg-warning-surface' : 'border-border bg-muted/40'}`}>
              <input type="checkbox" checked={requerAprovacao} readOnly className="h-3.5 w-3.5 accent-warning-ink" />
              <span className="flex items-center gap-1.5 text-[12px] font-medium">
                <ShieldAlert className="h-3.5 w-3.5 text-warning-ink" />
                Requer aprovação da gestão
              </span>
            </label>
            {requerAprovacao && (
              <div className="flex items-start gap-2 rounded-lg border border-provisorio-border bg-warning-surface px-3 py-2">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning-ink" />
                <p className="text-[11px] leading-snug text-warning-ink">
                  Ajustes acima de {limiar} unidades exigem aprovação da gestão antes de serem aplicados (parâmetro estoque.limiar_aprovacao_ajuste).
                </p>
              </div>
            )}

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
                <ClipboardList className="h-4 w-4" /> Criar ajuste
              </button>
            </div>
          </div>
        )}

        <div className={`${podeAjustar ? 'col-span-7' : 'col-span-12'} flex flex-col overflow-hidden rounded-xl border border-border bg-card`}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[13px] font-bold">Ajustes recentes</p>
            <span className="text-[12px] text-muted-foreground">{ajustes.length} registro{ajustes.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex-1 overflow-auto">
            {ajustes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <ClipboardList className="h-8 w-8 text-placeholder" />
                <p className="text-[13px] text-muted-foreground">Nenhum ajuste registrado.</p>
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Código', 'Produto', 'Ajuste', 'Qtd ajustada', 'Motivo', 'Responsável', 'Data/hora', 'Status', ''].map((h) => (
                      <th key={h || 'acoes'} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ajustes.map((a, i) => {
                    const pendente = a.status === 'aguardando_aprovacao';
                    const qtdAjustadaLinha = a.quantidadeAnterior + a.quantidadeDelta;
                    return (
                      <tr key={a.id} className={`border-b border-border/60 hover:bg-table-row-hover ${i % 2 !== 0 ? 'bg-table-zebra' : ''}`}>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] font-bold text-brand-navy-deep">{a.itemCodigo}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-semibold">{a.produtoCodigo}</td>
                        <td className={`whitespace-nowrap px-4 py-2.5 font-bold ${a.quantidadeDelta >= 0 ? 'text-success-strong' : 'text-destructive'}`}>
                          {a.quantidadeDelta >= 0 ? '+' : ''}{a.quantidadeDelta}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{qtdAjustadaLinha}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{MOTIVOS.find((m) => m.value === a.motivo)?.label ?? a.motivo}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{a.responsavelNome ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{new Date(a.createdAt).toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                        <td className="px-4 py-2.5">
                          {pendente && podeAprovar ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setModalDecisao({ ajuste: a, decisao: 'aprovar' })}
                                className="h-6 rounded border border-success-strong/30 px-2 text-[11px] font-medium text-success-strong hover:bg-success-surface"
                              >
                                Aprovar
                              </button>
                              <button
                                type="button"
                                onClick={() => setModalDecisao({ ajuste: a, decisao: 'rejeitar' })}
                                className="h-6 rounded border border-danger-border px-2 text-[11px] font-medium text-destructive hover:bg-danger-surface"
                              >
                                Rejeitar
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-placeholder">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <ModalDecisao
        open={!!modalDecisao}
        onClose={() => setModalDecisao(null)}
        ajuste={modalDecisao?.ajuste ?? null}
        decisao={modalDecisao?.decisao ?? null}
        onConfirm={(motivoDecisao) => void handleDecisao(motivoDecisao)}
      />
    </div>
  );
}
