'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Info, Search, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgeCount } from '@/components/ui/badge-count';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
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

const STATUS_MAP: Record<AjusteEstoque['status'], { variant: StatusPillVariant; label: string }> = {
  aplicado: { variant: 'expedido', label: 'Aplicado' },
  aguardando_aprovacao: { variant: 'divergencia', label: 'Aguardando aprovação' },
  rejeitado: { variant: 'bloqueado', label: 'Rejeitado' },
};

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{aprovar ? 'Aprovar ajuste de estoque' : 'Rejeitar ajuste de estoque'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-surface-2 p-3 text-[12px]">
          <div><span className="text-muted-foreground">Código: </span><span className="font-data font-bold">{ajuste.itemCodigo}</span></div>
          <div>
            <span className="text-muted-foreground">Ajuste: </span>
            <span className={cn('font-semibold', ajuste.quantidadeDelta >= 0 ? 'text-success-fg' : 'text-destructive')}>
              {ajuste.quantidadeDelta >= 0 ? '+' : ''}{ajuste.quantidadeDelta}
            </span>
          </div>
          <div><span className="text-muted-foreground">Motivo: </span><span className="font-semibold">{MOTIVOS.find((m) => m.value === ajuste.motivo)?.label ?? ajuste.motivo}</span></div>
          <div><span className="text-muted-foreground">Responsável: </span><span className="font-semibold">{ajuste.responsavelNome ?? '—'}</span></div>
        </div>

        {!aprovar && (
          <FormField label="Motivo da rejeição" required help="Mín. 5 caracteres" htmlFor="motivo-rejeicao">
            <Textarea id="motivo-rejeicao" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </FormField>
        )}

        <div
          className={cn(
            'flex items-start gap-2 rounded-md border p-3 text-[12px]',
            aprovar ? 'border-success-soft-border bg-success-soft text-success-fg' : 'border-danger-soft-border bg-danger-soft text-danger-fg',
          )}
        >
          {aprovar ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
          <p className="leading-snug">
            {aprovar
              ? 'Ao aprovar, o ajuste será aplicado ao saldo físico do item.'
              : 'Ao rejeitar, o ajuste não será aplicado e o saldo físico permanece inalterado.'}
          </p>
        </div>

        {erro && <p className="text-[12px] text-destructive">{erro}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Voltar
          </Button>
          <Button
            type="button"
            variant={aprovar ? 'default' : 'destructive'}
            className="flex-1"
            disabled={!podeConfirmar}
            onClick={() => {
              setErro(null);
              onConfirm(motivo.trim());
            }}
          >
            {aprovar ? 'Confirmar aprovação' : 'Confirmar rejeição'}
          </Button>
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
    <div className="space-y-3">
      <PageHeader title="Ajustes de Estoque" subtitle="Ajuste controlado de saldo físico, com aprovação quando necessário" />

      {feedback && (
        <div className="flex items-center gap-2 rounded-md border border-success-soft-border bg-success-soft px-3 py-2 text-xs text-success-fg">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
          Ajuste registrado com sucesso.
        </div>
      )}
      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="grid gap-2.5 lg:grid-cols-[420px_1fr]">
        {podeAjustar && (
          <Card>
            <CardHeader>
              <CardTitle>Novo ajuste</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-x-3.5 gap-y-2.5">
              <FormField label="Produto/item" required htmlFor="busca-item-ajuste">
                <Input
                  id="busca-item-ajuste"
                  adornLeft={<Search />}
                  value={buscaItem}
                  onChange={(e) => { setBuscaItem(e.target.value); setItemSelecionado(null); }}
                  placeholder="Buscar por código ou produto"
                />
              </FormField>
              {buscaItem !== '' && !itemSelecionado && (
                <div className="max-h-[160px] overflow-y-auto overflow-x-hidden rounded-md border border-border">
                  {itensFiltrados.length === 0 ? (
                    <p className="py-2 text-center text-[12px] text-muted-foreground">Nenhum item encontrado.</p>
                  ) : (
                    itensFiltrados.map((i) => (
                      <button
                        key={`${i.tipo}-${i.id}`}
                        type="button"
                        onClick={() => { setItemSelecionado(i); setBuscaItem(`${i.codigo} — ${i.produto.nome}`); }}
                        className="block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 last:border-b-0 hover:bg-surface-2"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold">{i.codigo} — {i.produto.nome}</span>
                          <span className="shrink-0 font-data text-[11px] text-muted-foreground">{i.quantidade} {i.unidade}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {itemSelecionado && (
                <div className="flex items-center justify-between rounded-md border border-primary-soft-border bg-primary-soft px-2.5 py-1.5 text-[12px] font-medium text-primary-fg">
                  <span>{itemSelecionado.codigo} — {itemSelecionado.produto.nome}{itemSelecionado.local.valor ? ` • ${itemSelecionado.local.valor}` : ''}</span>
                  <button type="button" onClick={() => { setItemSelecionado(null); setBuscaItem(''); }} className="hover:opacity-70">
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              <FormField label="Quantidade/peso atual" htmlFor="qtd-atual-ajuste">
                <Input
                  id="qtd-atual-ajuste"
                  readOnly
                  value={itemSelecionado ? `${itemSelecionado.quantidade} ${itemSelecionado.unidade}` : '—'}
                />
              </FormField>

              <FormField label="Ajuste (+/-)" required htmlFor="valor-ajuste">
                <Input
                  id="valor-ajuste"
                  type="number"
                  inputMode="numeric"
                  value={ajusteValor}
                  onChange={(e) => setAjusteValor(e.target.value)}
                  placeholder="Ex.: -2 ou +3"
                  className="text-right font-data"
                />
              </FormField>

              {itemSelecionado && ajusteValido && (
                <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px]">
                  <span className="text-muted-foreground">Quantidade ajustada:</span>
                  <span className={cn('font-data font-bold', (qtdAjustada ?? 0) < 0 && 'text-destructive')}>
                    {qtdAjustada} {itemSelecionado.unidade}
                  </span>
                </div>
              )}

              <FormField label="Motivo" required htmlFor="motivo-ajuste">
                <SelectNative
                  id="motivo-ajuste"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as AjusteEstoque['motivo'])}
                >
                  <option value="">Selecionar...</option>
                  {MOTIVOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </SelectNative>
              </FormField>

              <FormField label="Descrição" htmlFor="descricao-ajuste">
                <Textarea
                  id="descricao-ajuste"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                  placeholder="Detalhe o motivo do ajuste"
                />
              </FormField>

              <FormField label="Responsável" htmlFor="responsavel-ajuste">
                <Input id="responsavel-ajuste" readOnly value={nomeUsuario} />
              </FormField>

              <label
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2.5 py-2 transition-colors duration-100',
                  requerAprovacao ? 'border-provisorio-border bg-warning-soft' : 'border-border bg-surface-2',
                )}
              >
                <input type="checkbox" checked={requerAprovacao} readOnly className="size-3.5 accent-warning-ink" />
                <span className="flex items-center gap-1.5 text-[12px] font-medium">
                  <ShieldAlert className="size-3.5 text-warning-ink" />
                  Requer aprovação da gestão
                </span>
              </label>
              {requerAprovacao && (
                <div className="flex items-start gap-2 rounded-md border border-warning-soft-border bg-warning-soft p-3 text-xs text-warning-fg">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <p>
                    Ajustes acima de {limiar} unidades exigem aprovação da gestão antes de serem aplicados (parâmetro estoque.limiar_aprovacao_ajuste).
                  </p>
                </div>
              )}

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
                  <ClipboardList /> Criar ajuste
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ajustes recentes</CardTitle>
            <BadgeCount>{ajustes.length}</BadgeCount>
          </CardHeader>
          <CardContent className="p-0">
            {ajustes.length === 0 ? (
              <EmptyState icon={<ClipboardList />} title="Nenhum ajuste registrado." className="py-12" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Código</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Ajuste</TableHead>
                    <TableHead className="text-right">Qtd ajustada</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Data/hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ajustes.map((a) => {
                    const pendente = a.status === 'aguardando_aprovacao';
                    const qtdAjustadaLinha = a.quantidadeAnterior + a.quantidadeDelta;
                    const status = STATUS_MAP[a.status];
                    return (
                      <TableRow key={a.id}>
                        <TableCellCode>{a.itemCodigo}</TableCellCode>
                        <TableCell className="text-[13px] font-semibold text-foreground">{a.produtoCodigo}</TableCell>
                        <TableCellNum className={cn('font-bold', a.quantidadeDelta >= 0 ? 'text-success-fg' : 'text-destructive')}>
                          {a.quantidadeDelta >= 0 ? '+' : ''}{a.quantidadeDelta}
                        </TableCellNum>
                        <TableCellNum>{qtdAjustadaLinha}</TableCellNum>
                        <TableCell className="text-muted-foreground">{MOTIVOS.find((m) => m.value === a.motivo)?.label ?? a.motivo}</TableCell>
                        <TableCell className="text-muted-foreground">{a.responsavelNome ?? '—'}</TableCell>
                        <TableCellNum>{new Date(a.createdAt).toLocaleString('pt-BR')}</TableCellNum>
                        <TableCell><StatusPill variant={status.variant} label={status.label} /></TableCell>
                        <TableCell>
                          {pendente && podeAprovar ? (
                            <div className="flex justify-end gap-1">
                              <Button variant="secondary" size="sm" onClick={() => setModalDecisao({ ajuste: a, decisao: 'aprovar' })}>
                                Aprovar
                              </Button>
                              <Button variant="destructiveOutline" size="sm" onClick={() => setModalDecisao({ ajuste: a, decisao: 'rejeitar' })}>
                                Rejeitar
                              </Button>
                            </div>
                          ) : (
                            <span className="block text-right text-[11px] text-fg-faint">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
