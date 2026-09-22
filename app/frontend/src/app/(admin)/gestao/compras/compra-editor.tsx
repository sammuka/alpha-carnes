'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, History, Info, Plus, Save, Trash2 } from 'lucide-react';
import { PainelImpacto } from '@/components/gestao/painel-impacto';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ComboboxField } from '@/components/ui/combobox-field';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableCellNum,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { labelCodigoDescricao } from '@/lib/dominios';
import { extrairCodigoErro, extrairMensagemErro, mensagemDeErro } from '@/lib/error-message';
import type {
  CompraProgramada,
  CompraProgramadaDetalhe,
  ConfirmacaoCompraProgramada,
  CriarCompraProgramadaDto,
  DisponibilidadeDia,
  HistoricoCompraItem,
  ImpactoCompra,
} from '@/lib/comercial';
import {
  AVISO_EDITAR_CONFIRMADA,
  type CadastroItem,
  type LinhaItem,
  type SimulacaoDesdobramento,
  chaveDisponibilidade,
  linhaVazia,
  nomeFornecedor,
  ROTULO_COMPRA,
  rotuloItemDisponibilidade,
  rotuloLote,
  somaQuantidadeDisponivel,
  statusCompraVariant,
} from './compras-shared';

export interface CompraEditorProps {
  modo: 'criar' | 'visualizar';
  compra: CompraProgramadaDetalhe | null;
  lotes: CompraProgramada[];
  fornecedores: CadastroItem[];
  itensCompra: CadastroItem[];
  dataOperacao: string;
  disponibilidade: DisponibilidadeDia[];
  disponibilidadeTotal: DisponibilidadeDia[];
  podeGerenciar: boolean;
  onBack: () => void;
  onChanged: (compraId?: string) => Promise<void> | void;
  onSelectLote: (compraId: string) => void;
  onMudarData: (data: string) => void;
  onNovo: () => void;
}

function ListaDisponibilidade({
  itens,
  vazio,
  rotulo,
}: {
  itens: DisponibilidadeDia[];
  vazio: string;
  rotulo: (item: DisponibilidadeDia) => string;
}) {
  if (itens.length === 0) {
    return <p className="text-xs text-muted-foreground">{vazio}</p>;
  }
  return (
    <ul className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
      {itens.map((d) => (
        <li key={chaveDisponibilidade(d)} className="flex justify-between text-xs">
          <span className="font-data text-[11px]">{rotulo(d)}</span>
          <span className="font-data font-semibold text-primary">{d.quantidadeDisponivel} disp.</span>
        </li>
      ))}
    </ul>
  );
}

function itensValidos(linhas: LinhaItem[]) {
  return linhas
    .filter((l) => l.produtoId && Number(l.quantidadeComprada) > 0)
    .map((l) => ({
      itemId: l.itemId,
      produtoId: l.produtoId,
      quantidadeComprada: Number(l.quantidadeComprada),
      observacoes: l.observacoes || undefined,
    }));
}

function impactoDoCorpo(body: unknown): ImpactoCompra | null {
  if (!body || typeof body !== 'object') return null;
  const direto = (body as { impacto?: ImpactoCompra }).impacto;
  if (direto) return direto;
  const aninhado = (body as { message?: { impacto?: ImpactoCompra } }).message?.impacto;
  return aninhado ?? null;
}

function montarDescricaoHistorico(h: HistoricoCompraItem): string {
  const ant = h.dadosAnteriores as { quantidadeComprada?: string } | null;
  const novo = h.dadosNovos as { quantidadeComprada?: string } | null;
  if (ant?.quantidadeComprada && novo?.quantidadeComprada) {
    return `Quantidade alterada de ${ant.quantidadeComprada} para ${novo.quantidadeComprada}`;
  }
  return `${h.operacao} em ${h.tabela}`;
}

export function CompraEditor({
  modo,
  compra,
  lotes,
  fornecedores,
  itensCompra,
  dataOperacao,
  disponibilidade,
  disponibilidadeTotal,
  podeGerenciar,
  onBack,
  onChanged,
  onSelectLote,
  onMudarData,
  onNovo,
}: CompraEditorProps) {
  const [dataLocal, setDataLocal] = useState(dataOperacao);
  const [fornecedorId, setFornecedorId] = useState(compra?.fornecedorId ?? '');
  const [referenciaExterna, setReferenciaExterna] = useState(compra?.referenciaExterna ?? '');
  const [observacoes, setObservacoes] = useState(compra?.observacoes ?? '');
  const [linhas, setLinhas] = useState<LinhaItem[]>(
    compra?.itens.length
      ? compra.itens.map((it) => ({
          itemId: it.id,
          produtoId: it.produtoId,
          quantidadeComprada: it.quantidadeComprada,
          observacoes: it.observacoes ?? '',
        }))
      : [linhaVazia()],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [avisoEditar, setAvisoEditar] = useState(false);
  const [editandoConfirmada, setEditandoConfirmada] = useState(false);
  const [impacto, setImpacto] = useState<ImpactoCompra | null>(null);
  const [confirmarDeficit, setConfirmarDeficit] = useState(false);
  const [historico, setHistorico] = useState<HistoricoCompraItem[]>([]);
  const [simulacoes, setSimulacoes] = useState<Map<string, SimulacaoDesdobramento>>(new Map());

  const editavel = compra
    ? ['rascunho', 'em_negociacao'].includes(compra.status) || editandoConfirmada
    : true;
  const simularDesdobramento = !compra || compra.status !== 'confirmada' || editandoConfirmada;
  const podeSimular = !compra || compra.status === 'rascunho';
  const mostrarLaterais = modo === 'visualizar';
  const rascunhoEditavel = editavel && compra?.status !== 'confirmada';

  const aplicarDetalhe = useCallback((det: CompraProgramadaDetalhe) => {
    setDataLocal(det.dataOperacao);
    setFornecedorId(det.fornecedorId);
    setReferenciaExterna(det.referenciaExterna ?? '');
    setObservacoes(det.observacoes ?? '');
    setLinhas(
      det.itens.map((it) => ({
        itemId: it.id,
        produtoId: it.produtoId,
        quantidadeComprada: it.quantidadeComprada,
        observacoes: it.observacoes ?? '',
      })),
    );
  }, []);

  useEffect(() => {
    if (compra) aplicarDetalhe(compra);
  }, [aplicarDetalhe, compra]);

  useEffect(() => {
    setEditandoConfirmada(false);
    setImpacto(null);
    setConfirmarDeficit(false);
    setHistorico([]);
  }, [compra?.id]);

  useEffect(() => {
    setDataLocal(dataOperacao);
  }, [dataOperacao]);

  useEffect(() => {
    if (!editandoConfirmada || !compra) return;
    void fetch(`/api/comercial/compras-programadas/${compra.id}/historico`)
      .then((r) => (r.ok ? r.json() : []))
      .then((linhas: HistoricoCompraItem[]) => setHistorico(linhas));
  }, [editandoConfirmada, compra]);

  useEffect(() => {
    if (!editandoConfirmada || !compra) {
      if (!editandoConfirmada) setImpacto(null);
      return;
    }
    const mapa = new Map<string, number>();
    for (const item of compra.itens) mapa.set(item.produtoId, 0);
    for (const linha of itensValidos(linhas)) {
      mapa.set(linha.produtoId, (mapa.get(linha.produtoId) ?? 0) + linha.quantidadeComprada);
    }
    const partes = [...mapa.entries()].map(([id, qtd]) => `${id}:${qtd.toFixed(3)}`).join(',');
    if (!partes) {
      setImpacto(null);
      return;
    }
    const timer = setTimeout(() => {
      void fetch(
        `/api/comercial/compras-programadas/${compra.id}/impacto?simulacao=${encodeURIComponent(partes)}`,
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((proximo: ImpactoCompra | null) => {
          setImpacto(proximo);
          setConfirmarDeficit(Boolean(proximo?.exigeConfirmacao));
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [editandoConfirmada, compra, linhas]);

  useEffect(() => {
    if (!simularDesdobramento) return;
    const candidatas = linhas.filter((l) => l.produtoId && Number(l.quantidadeComprada) > 0);
    if (candidatas.length === 0) {
      setSimulacoes(new Map());
      return;
    }
    const timer = setTimeout(() => {
      void Promise.all(
        candidatas.map((l) =>
          fetch('/api/cadastros/regras-desdobramento/simular', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              produtoId: l.produtoId,
              quantidade: Math.round(Number(l.quantidadeComprada)),
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((s: SimulacaoDesdobramento | null) => [l.produtoId, s] as const),
        ),
      ).then((resultados) => {
        const proximo = new Map<string, SimulacaoDesdobramento>();
        for (const [id, s] of resultados) if (s) proximo.set(id, s);
        setSimulacoes(proximo);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [linhas, simularDesdobramento]);

  async function persistirItens(
    compraId: string,
    atuais: ReturnType<typeof itensValidos>,
    forcarDeficit: boolean,
  ) {
    const persistidos = compra?.id === compraId ? compra.itens : [];
    const idsMantidos = new Set<string>();

    const falharSeImpacto = async (res: Response) => {
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && extrairCodigoErro(body) === 'IMPACTO_CONFIRMACAO_NECESSARIA') {
        const projetado = impactoDoCorpo(body);
        setImpacto(projetado);
        setConfirmarDeficit(true);
        throw new Error('A alteração projeta déficit; confirme para prosseguir.');
      }
      throw new Error(extrairMensagemErro(body, 'Erro ao salvar item'));
    };

    for (const linha of atuais) {
      const original = linha.itemId ? persistidos.find((item) => item.id === linha.itemId) : undefined;
      if (original && original.produtoId === linha.produtoId) {
        idsMantidos.add(original.id);
        const qtdIgual = Number(original.quantidadeComprada) === linha.quantidadeComprada;
        const obsIgual = (original.observacoes ?? '') === (linha.observacoes ?? '');
        if (qtdIgual && obsIgual) continue;
        const res = await fetch(`/api/comercial/compras-programadas/${compraId}/itens/${original.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantidadeComprada: linha.quantidadeComprada,
            observacoes: linha.observacoes,
            confirmarDeficit: forcarDeficit,
          }),
        });
        if (!res.ok) await falharSeImpacto(res);
        continue;
      }

      const res = await fetch(`/api/comercial/compras-programadas/${compraId}/itens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produtoId: linha.produtoId,
          quantidadeComprada: linha.quantidadeComprada,
          observacoes: linha.observacoes,
          confirmarDeficit: forcarDeficit,
        }),
      });
      if (!res.ok) await falharSeImpacto(res);
    }

    for (const original of persistidos) {
      if (idsMantidos.has(original.id)) continue;
      const qs = forcarDeficit ? '?confirmarDeficit=true' : '';
      const res = await fetch(`/api/comercial/compras-programadas/${compraId}/itens/${original.id}${qs}`, {
        method: 'DELETE',
      });
      if (!res.ok) await falharSeImpacto(res);
    }
  }

  const salvar = async () => {
    if (!podeGerenciar) return;
    setSalvando(true);
    setErro(null);
    const atuais = itensValidos(linhas);
    if (!fornecedorId || atuais.length === 0) {
      setErro('Informe fornecedor e ao menos um item com quantidade.');
      setSalvando(false);
      return;
    }
    const produtos = atuais.map((item) => item.produtoId);
    if (new Set(produtos).size !== produtos.length) {
      setErro('Cada item de compra só pode aparecer uma vez no pedido.');
      setSalvando(false);
      return;
    }

    try {
      if (compra) {
        const cabecalho = await fetch(`/api/comercial/compras-programadas/${compra.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fornecedorId, referenciaExterna, observacoes }),
        });
        if (!cabecalho.ok) throw new Error(await mensagemDeErro(cabecalho, 'Erro ao salvar compra'));
        await persistirItens(compra.id, atuais, confirmarDeficit || Boolean(impacto?.exigeConfirmacao));
        setEditandoConfirmada(false);
        setConfirmarDeficit(false);
        setImpacto(null);
        await onChanged(compra.id);
      } else {
        const payload: CriarCompraProgramadaDto = {
          dataOperacao: dataLocal,
          fornecedorId,
          referenciaExterna: referenciaExterna || undefined,
          observacoes: observacoes || undefined,
          itens: atuais.map(({ produtoId, quantidadeComprada, observacoes: obs }) => ({
            produtoId,
            quantidadeComprada,
            observacoes: obs,
          })),
        };
        const res = await fetch('/api/comercial/compras-programadas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setErro(await mensagemDeErro(res, 'Erro ao salvar compra'));
          return;
        }
        const criada = (await res.json()) as CompraProgramadaDetalhe;
        await onChanged(criada.id);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro de conexão');
    } finally {
      setSalvando(false);
    }
  };

  const confirmar = async () => {
    if (!compra || !podeGerenciar) return;
    setSalvando(true);
    setErro(null);
    const res = await fetch(`/api/comercial/compras-programadas/${compra.id}/confirmar`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(extrairMensagemErro(body, 'Erro ao confirmar compra'));
      setSalvando(false);
      return;
    }
    const confirmacao = body as ConfirmacaoCompraProgramada;
    aplicarDetalhe(confirmacao.compra);
    await onChanged(confirmacao.compra.id);
    setSalvando(false);
  };

  const cancelarEdicao = () => {
    if (compra) aplicarDetalhe(compra);
    setEditandoConfirmada(false);
    setImpacto(null);
    setConfirmarDeficit(false);
    setErro(null);
  };

  return (
    <div className="space-y-3">
      <div className="mb-3 flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Voltar para pedidos de compra">
          <ArrowLeft />
        </Button>
        <PageHeader
          className="mb-0 flex-1"
          title={modo === 'criar' ? 'Novo pedido de compra' : 'Compra Programada (Pedido de Compra)'}
          subtitle={
            modo === 'criar'
              ? 'Informe fornecedor, itens e quantidades do pedido'
              : 'Planejamento de compra e geração de disponibilidade virtual'
          }
          badge={
            modo === 'visualizar' ? (
              <StatusPill
                variant={statusCompraVariant(compra?.status ?? 'rascunho')}
                label={ROTULO_COMPRA[compra?.status ?? 'rascunho'] ?? compra?.status ?? 'Rascunho'}
              />
            ) : undefined
          }
        >
          {podeGerenciar && compra?.status === 'confirmada' && !editandoConfirmada && (
            <Button variant="secondary" onClick={() => setAvisoEditar(true)}>
              Editar compra confirmada
            </Button>
          )}
          {podeGerenciar && editandoConfirmada && (
            <>
              <Button variant="ghost" onClick={cancelarEdicao} disabled={salvando}>
                Cancelar edição
              </Button>
              <Button onClick={() => void salvar()} disabled={salvando}>
                <Save />
                {confirmarDeficit || impacto?.exigeConfirmacao ? 'Salvar mesmo assim' : 'Salvar alterações'}
              </Button>
            </>
          )}
          {podeGerenciar && rascunhoEditavel && (
            <>
              <Button variant="secondary" onClick={() => void salvar()} disabled={salvando}>
                <Save />
                Salvar rascunho
              </Button>
              {compra && (
                <Button onClick={() => void confirmar()} disabled={salvando}>
                  <CheckCircle />
                  Confirmar compra
                </Button>
              )}
            </>
          )}
        </PageHeader>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className={mostrarLaterais ? 'grid grid-cols-1 items-start gap-2.5 lg:grid-cols-[1fr_320px]' : undefined}>
        <div className="space-y-2.5">
          <Card>
            <CardContent className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-4">
              <FormField label="Data operacional" required htmlFor="data">
                <DatePickerField
                  id="data"
                  value={dataLocal}
                  onChange={(proxima) => {
                    setDataLocal(proxima);
                    if (modo === 'visualizar') onMudarData(proxima);
                  }}
                  disabled={editandoConfirmada}
                />
              </FormField>
              <FormField label="Fornecedor" required className="sm:col-span-2" htmlFor="fornecedor">
                <ComboboxField
                  id="fornecedor"
                  items={fornecedores.map((f) => ({ id: f.id, label: f.razaoSocial ?? f.codigo ?? '—', sublabel: f.codigo }))}
                  value={fornecedorId}
                  onChange={setFornecedorId}
                  placeholder="Selecione o fornecedor"
                  searchPlaceholder="Buscar fornecedor…"
                  emptyText="Nenhum fornecedor encontrado."
                  disabled={!editavel}
                />
              </FormField>
              <FormField label="Referência externa" htmlFor="ref">
                <Input
                  id="ref"
                  value={referenciaExterna}
                  onChange={(e) => setReferenciaExterna(e.target.value)}
                  disabled={!editavel}
                />
              </FormField>
              <FormField label="Status">
                <div className="flex h-8 items-center">
                  <StatusPill
                    variant={statusCompraVariant(compra?.status ?? 'rascunho')}
                    label={ROTULO_COMPRA[compra?.status ?? 'rascunho'] ?? compra?.status ?? 'Rascunho'}
                  />
                </div>
              </FormField>
              <FormField label="Observações" className="sm:col-span-2 xl:col-span-4" htmlFor="obs">
                <Textarea id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={!editavel} />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Itens da compra</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Item de compra</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead>Regra de Desdobramento</TableHead>
                    <TableHead className="text-right">Previsão (kg)</TableHead>
                    {editavel && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((linha, idx) => {
                    const simulacao = simulacoes.get(linha.produtoId);
                    const regraDesdobramento = simulacao?.itens?.length
                      ? simulacao.itens.map((i) => `${i.fator}× ${i.descricao}`).join(' + ')
                      : '—';
                    const ocupados = new Set(
                      linhas.filter((_, i) => i !== idx).map((l) => l.produtoId).filter(Boolean),
                    );
                    const opcoesItem = itensCompra.filter((it) => it.id === linha.produtoId || !ocupados.has(it.id));
                    return (
                      <TableRow key={linha.itemId ?? `novo-${idx}`} className="group">
                        <TableCell>
                          <label className="sr-only" htmlFor={`item-compra-${idx}`}>Item de compra</label>
                          <ComboboxField
                            id={`item-compra-${idx}`}
                            items={opcoesItem.map((it) => ({
                              id: it.id,
                              label: labelCodigoDescricao(it.codigo, it.descricao ?? it.nome ?? ''),
                            }))}
                            value={linha.produtoId}
                            onChange={(id) =>
                              setLinhas((p) => p.map((l, i) => (i === idx ? { ...l, produtoId: id } : l)))
                            }
                            placeholder="Item"
                            searchPlaceholder="Buscar item de compra..."
                            emptyText="Nenhum item disponível."
                            disabled={!editavel}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.001"
                            value={linha.quantidadeComprada}
                            onChange={(e) =>
                              setLinhas((p) => p.map((l, i) => (i === idx ? { ...l, quantidadeComprada: e.target.value } : l)))
                            }
                            disabled={!editavel}
                            className="h-7 w-24 text-right font-data"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={linha.observacoes}
                            onChange={(e) =>
                              setLinhas((p) => p.map((l, i) => (i === idx ? { ...l, observacoes: e.target.value } : l)))
                            }
                            disabled={!editavel}
                            className="h-7"
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{regraDesdobramento}</TableCell>
                        <TableCellNum
                          className="text-muted-foreground"
                          title="Previsão de peso depende de cadastro de peso médio por item — pendente"
                        >
                          —
                        </TableCellNum>
                        {editavel && (
                          <TableCell>
                            <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="iconSm"
                                aria-label={`Remover item ${idx + 1}`}
                                onClick={() => setLinhas((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== idx)))}
                                disabled={linhas.length <= 1}
                              >
                                <Trash2 className="text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
            {editavel && podeGerenciar && (
              <CardFooter>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setLinhas((p) => [...p, linhaVazia()])}
                  disabled={
                    itensCompra.length > 0
                    && itensCompra.every((it) => linhas.some((l) => l.produtoId === it.id))
                  }
                >
                  <Plus />
                  Adicionar item
                </Button>
              </CardFooter>
            )}
          </Card>

          {editandoConfirmada && impacto && <PainelImpacto impacto={impacto} />}

          {editandoConfirmada && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <History className="size-3.5 text-muted-foreground" />
                  Histórico de alterações desta compra
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historico.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma alteração registrada ainda.</p>
                ) : (
                  <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-md border border-border text-xs">
                    {historico.map((h) => (
                      <li key={h.id} className="px-3 py-2">
                        <div className="flex justify-between">
                          <span className="font-semibold">{h.usuarioNome ?? '—'}</span>
                          <span className="text-muted-foreground">{new Date(h.dataHora).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-muted-foreground">{montarDescricaoHistorico(h)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {mostrarLaterais && (
          <div className="space-y-2.5">
            <Card>
              <CardHeader>
                <CardTitle>Lotes da operação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2">
                {lotes.length === 0 ? (
                  <div className="space-y-2 p-2">
                    <p>Nenhum pedido de compra para esta operação.</p>
                    {podeGerenciar && (
                      <Button variant="secondary" size="sm" onClick={onNovo}>
                        <Plus />
                        Novo pedido de compra
                      </Button>
                    )}
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {lotes.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-xs ${
                            compra?.id === item.id ? 'bg-primary-soft text-primary-fg' : 'hover:bg-surface-2'
                          }`}
                          onClick={() => onSelectLote(item.id)}
                        >
                          <span className="font-data font-semibold">{rotuloLote(item.numeroSequencial)}</span>
                          <span>{nomeFornecedor(item)}</span>
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <StatusPill variant={statusCompraVariant(item.status)} label={ROTULO_COMPRA[item.status] ?? item.status} />
                            <span className="font-data">{item.totalItens} itens</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Disponibilidade gerada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {podeSimular ? (
                  simulacoes.size === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      A disponibilidade estimada aparecerá conforme itens e quantidades forem informados.
                    </p>
                  ) : (
                    (() => {
                      const agregado = new Map<string, { descricao: string; total: number }>();
                      for (const sim of simulacoes.values()) {
                        for (const item of sim.itens ?? []) {
                          const atual = agregado.get(item.produtoId);
                          agregado.set(item.produtoId, {
                            descricao: item.descricao,
                            total: (atual?.total ?? 0) + item.total,
                          });
                        }
                      }
                      const linhasAgregadas = [...agregado.values()];
                      return (
                        <>
                          <p className="text-xs text-muted-foreground">
                            A confirmação deste pedido irá gerar saldo para vendas nas seguintes proporções estimadas:
                          </p>
                          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
                            {linhasAgregadas.map((l) => (
                              <div key={l.descricao} className="flex justify-between text-xs">
                                <span className="font-medium">{l.descricao}</span>
                                <span className="font-data font-bold text-primary">{l.total.toLocaleString('pt-BR')} peças</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-start gap-2 rounded-md bg-primary-soft p-3 text-xs text-primary-fg">
                            <span>Os itens comerciais ficarão disponíveis para a equipe de vendas imediatamente após a confirmação da compra.</span>
                          </div>
                        </>
                      );
                    })()
                  )
                ) : disponibilidade.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    A disponibilidade aparecerá após confirmar a compra programada.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
                    {disponibilidade.map((d) => (
                      <li key={d.modo === 'compra' ? d.id : d.produtoId} className="flex justify-between text-xs">
                        <span className="font-data text-[11px]">
                          {(() => {
                            const it = itensCompra.find((p) => p.id === d.produtoId);
                            return it ? labelCodigoDescricao(it.codigo, it.descricao ?? it.nome ?? '') : '—';
                          })()}
                        </span>
                        <span className="font-data font-semibold text-primary">{d.quantidadeDisponivel} disp.</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
              {podeSimular && simulacoes.size > 0 && (
                <CardFooter className="justify-between">
                  <span className="text-xs text-muted-foreground">Total Estimado</span>
                  <span className="font-data text-sm font-bold">
                    {[...simulacoes.values()].reduce((acc, s) => acc + s.totalPartes, 0).toLocaleString('pt-BR')} partes
                  </span>
                </CardFooter>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Disponibilidade total</CardTitle>
              </CardHeader>
              <CardContent>
                <ListaDisponibilidade
                  itens={disponibilidadeTotal}
                  vazio="A somatória aparece quando houver lotes confirmados nesta operação."
                  rotulo={(item) => rotuloItemDisponibilidade(item, itensCompra)}
                />
              </CardContent>
              {disponibilidadeTotal.length > 0 && (
                <CardFooter className="justify-between">
                  <span className="text-xs text-muted-foreground">Todos os lotes</span>
                  <span className="font-data text-sm font-bold">{somaQuantidadeDisponivel(disponibilidadeTotal)} disp.</span>
                </CardFooter>
              )}
            </Card>
          </div>
        )}
      </div>

      <AlertDialog open={avisoEditar} onOpenChange={setAvisoEditar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="size-4 text-primary" />
              Atenção
            </AlertDialogTitle>
            <AlertDialogDescription>{AVISO_EDITAR_CONFIRMADA}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setEditandoConfirmada(true)}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
