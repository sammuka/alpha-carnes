'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ComboboxField } from '@/components/ui/combobox-field';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
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
import type {
  CompraProgramadaDetalhe,
  CriarCompraProgramadaDto,
  DisponibilidadeDia,
  Paginado,
} from '@/lib/comercial';
import { ComprasEditModal } from './compras-edit-modal';

interface CadastroItem {
  id: string;
  codigo?: string;
  nome?: string;
  razaoSocial?: string;
}

interface LinhaItem {
  itemCompraId: string;
  quantidadeComprada: string;
  observacoes: string;
}

interface SimulacaoDesdobramento {
  itens: Array<{ itemComercialId: string; descricao: string; fator: string; total: number }>;
  totalPartes: number;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const ROTULO_COMPRA: Record<string, string> = {
  rascunho: 'Rascunho',
  em_negociacao: 'Em negociação',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
};

function statusCompraVariant(status: string): StatusPillVariant {
  switch (status) {
    case 'rascunho':
      return 'pendente';
    case 'em_negociacao':
      return 'recebido';
    case 'confirmada':
      return 'expedido';
    case 'cancelada':
      return 'bloqueado';
    default:
      return 'pendente';
  }
}

export function ComprasClient({ permissoes }: { permissoes: string[] }) {
  const podeLer = permissoes.includes('COMPRAS_PROGRAMADAS_LER');
  const podeGerenciar = permissoes.includes('COMPRAS_PROGRAMADAS_GERENCIAR');

  const searchParams = useSearchParams();
  const dataDaUrl = searchParams.get('data');
  const [dataOperacao, setDataOperacao] = useState(
    dataDaUrl && /^\d{4}-\d{2}-\d{2}$/.test(dataDaUrl) ? dataDaUrl : hojeISO(),
  );
  const [fornecedorId, setFornecedorId] = useState('');
  const [referenciaExterna, setReferenciaExterna] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [linhas, setLinhas] = useState<LinhaItem[]>([{ itemCompraId: '', quantidadeComprada: '', observacoes: '' }]);

  const [compra, setCompra] = useState<CompraProgramadaDetalhe | null>(null);
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeDia[]>([]);
  const [fornecedores, setFornecedores] = useState<CadastroItem[]>([]);
  const [itensCompra, setItensCompra] = useState<CadastroItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [simulacoes, setSimulacoes] = useState<Map<string, SimulacaoDesdobramento>>(new Map());

  const editavel = compra ? ['rascunho', 'em_negociacao'].includes(compra.status) : true;
  const podeSimular = !compra || compra.status === 'rascunho';

  const carregarCadastros = useCallback(async () => {
    const [fRes, iRes] = await Promise.all([
      fetch('/api/cadastros/fornecedores?pageSize=100', { cache: 'no-store' }),
      fetch('/api/cadastros/itens-compra?pageSize=100', { cache: 'no-store' }),
    ]);
    if (fRes.ok) {
      const f = (await fRes.json()) as Paginado<CadastroItem>;
      setFornecedores(f.data);
    }
    if (iRes.ok) {
      const i = (await iRes.json()) as Paginado<CadastroItem>;
      setItensCompra(i.data);
    }
  }, []);

  const carregarCompraDia = useCallback(async () => {
    if (!podeLer) return;
    setErro(null);
    const res = await fetch('/api/comercial/compras-programadas?pageSize=10', { cache: 'no-store' });
    if (!res.ok) return;
    const pag = (await res.json()) as Paginado<{ id: string; dataOperacao: string; status: string }>;
    const doDia = pag.data.find((c) => c.dataOperacao === dataOperacao && c.status !== 'cancelada');
    if (!doDia) {
      setCompra(null);
      return;
    }
    const detRes = await fetch(`/api/comercial/compras-programadas/${doDia.id}`, { cache: 'no-store' });
    if (detRes.ok) {
      const det = (await detRes.json()) as CompraProgramadaDetalhe;
      setCompra(det);
      setFornecedorId(det.fornecedorId);
      setReferenciaExterna(det.referenciaExterna ?? '');
      setObservacoes(det.observacoes ?? '');
      setLinhas(
        det.itens.map((it) => ({
          itemCompraId: it.itemCompraId,
          quantidadeComprada: it.quantidadeComprada,
          observacoes: it.observacoes ?? '',
        })),
      );
    }
  }, [dataOperacao, podeLer]);

  const carregarDisponibilidade = useCallback(async () => {
    const res = await fetch(`/api/comercial/disponibilidade?dataOperacao=${dataOperacao}`, { cache: 'no-store' });
    if (res.ok) setDisponibilidade((await res.json()) as DisponibilidadeDia[]);
  }, [dataOperacao]);

  useEffect(() => {
    void carregarCadastros();
  }, [carregarCadastros]);

  useEffect(() => {
    void carregarCompraDia();
    void carregarDisponibilidade();
  }, [carregarCompraDia, carregarDisponibilidade]);

  useEffect(() => {
    if (!podeSimular) return;
    const candidatas = linhas.filter((l) => l.itemCompraId && Number(l.quantidadeComprada) > 0);
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
              itemCompraId: l.itemCompraId,
              quantidade: Math.round(Number(l.quantidadeComprada)),
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((s: SimulacaoDesdobramento | null) => [l.itemCompraId, s] as const),
        ),
      ).then((resultados) => {
        const proximo = new Map<string, SimulacaoDesdobramento>();
        for (const [id, s] of resultados) if (s) proximo.set(id, s);
        setSimulacoes(proximo);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [linhas, podeSimular]);

  const salvar = async () => {
    if (!podeGerenciar) return;
    setSalvando(true);
    setErro(null);
    const itensValidos = linhas
      .filter((l) => l.itemCompraId && Number(l.quantidadeComprada) > 0)
      .map((l) => ({
        itemCompraId: l.itemCompraId,
        quantidadeComprada: Number(l.quantidadeComprada),
        observacoes: l.observacoes || undefined,
      }));
    if (!fornecedorId || itensValidos.length === 0) {
      setErro('Informe fornecedor e ao menos um item com quantidade.');
      setSalvando(false);
      return;
    }

    try {
      if (compra) {
        await fetch(`/api/comercial/compras-programadas/${compra.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fornecedorId, referenciaExterna, observacoes }),
        });
        for (const [idx, item] of compra.itens.entries()) {
          const linha = itensValidos[idx];
          if (linha) {
            const res = await fetch(`/api/comercial/compras-programadas/${compra.id}/itens/${item.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                quantidadeComprada: linha.quantidadeComprada,
                observacoes: linha.observacoes,
              }),
            });
            if (res.status === 409) {
              const body = await res.json().catch(() => ({}));
              if ((body as { codigo?: string }).codigo === 'IMPACTO_CONFIRMACAO_NECESSARIA') {
                setModalEditar(true);
                setErro('Alteração projeta déficit — use o painel de impacto para confirmar.');
                setSalvando(false);
                return;
              }
            }
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              setErro((body as { message?: string }).message ?? 'Erro ao salvar item');
              setSalvando(false);
              return;
            }
          }
        }
      } else {
        const payload: CriarCompraProgramadaDto = {
          dataOperacao,
          fornecedorId,
          referenciaExterna: referenciaExterna || undefined,
          observacoes: observacoes || undefined,
          itens: itensValidos,
        };
        const res = await fetch('/api/comercial/compras-programadas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro((body as { message?: string }).message ?? 'Erro ao salvar compra');
          return;
        }
      }
      await carregarCompraDia();
    } catch {
      setErro('Erro de conexão');
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
      setErro((body as { message?: string }).message ?? 'Erro ao confirmar compra');
      setSalvando(false);
      return;
    }
    setCompra(body as CompraProgramadaDetalhe);
    await carregarDisponibilidade();
    setSalvando(false);
  };

  if (!podeLer) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar compras programadas.</p>;
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Compra Programada (Pedido de Compra)"
        subtitle="Planejamento de compra e geração de disponibilidade virtual"
      >
        {podeGerenciar && editavel && (
          <>
            <Button variant="secondary" onClick={salvar} disabled={salvando}>
              <Save />
              Salvar rascunho
            </Button>
            {compra && (
              <Button onClick={confirmar} disabled={salvando}>
                <CheckCircle />
                Confirmar compra
              </Button>
            )}
          </>
        )}
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
        Alterar uma compra confirmada recalcula imediatamente a disponibilidade virtual impactada.
      </p>

      {compra?.status === 'confirmada' && podeGerenciar && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setModalEditar(true)}>Editar compra confirmada</Button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-2.5 xl:grid-cols-12">
        <div className="space-y-2.5 xl:col-span-8">
          <Card>
            <CardContent className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-4">
              <FormField label="Data operacional" required htmlFor="data">
                <DatePickerField
                  id="data"
                  value={dataOperacao}
                  onChange={setDataOperacao}
                  disabled={Boolean(compra)}
                />
              </FormField>
              <FormField label="Fornecedor" required className="sm:col-span-2" htmlFor="fornecedor">
                <ComboboxField
                  id="fornecedor"
                  items={fornecedores.map((f) => ({ id: f.id, label: f.razaoSocial ?? f.codigo ?? f.id.slice(0, 8), sublabel: f.codigo }))}
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
                    const simulacao = simulacoes.get(linha.itemCompraId);
                    const regraDesdobramento = simulacao
                      ? simulacao.itens.map((i) => `${i.fator}× ${i.descricao}`).join(' + ')
                      : '—';
                    return (
                      <TableRow key={idx} className="group">
                        <TableCell>
                          <SelectNative
                            selectSize="sm"
                            value={linha.itemCompraId}
                            onChange={(e) =>
                              setLinhas((p) => p.map((l, i) => (i === idx ? { ...l, itemCompraId: e.target.value } : l)))
                            }
                            disabled={!editavel}
                          >
                            <option value="">Item</option>
                            {itensCompra.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.nome ?? it.codigo ?? it.id.slice(0, 8)}
                              </option>
                            ))}
                          </SelectNative>
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
                                onClick={() => setLinhas((p) => p.filter((_, i) => i !== idx))}
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
                  onClick={() => setLinhas((p) => [...p, { itemCompraId: '', quantidadeComprada: '', observacoes: '' }])}
                >
                  <Plus />
                  Adicionar item
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        <div className="xl:col-span-4">
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
                      for (const item of sim.itens) {
                        const atual = agregado.get(item.itemComercialId);
                        agregado.set(item.itemComercialId, {
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
                    <li key={d.id} className="flex justify-between text-xs">
                      <span className="font-data text-[11px]">{d.itemComercialId.slice(0, 8)}…</span>
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
        </div>
      </div>

      <ComprasEditModal
        open={modalEditar}
        compra={compra?.status === 'confirmada' ? compra : null}
        itensCompra={itensCompra}
        onClose={() => setModalEditar(false)}
        onSalvo={() => {
          void carregarCompraDia();
          void carregarDisponibilidade();
        }}
      />
    </div>
  );
}
