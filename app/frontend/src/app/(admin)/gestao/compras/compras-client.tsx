'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle, Plus, Save, Trash2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

  const [dataOperacao, setDataOperacao] = useState(hojeISO());
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Compra Programada (Pedido de Compra)</h1>
          <p className="text-sm text-muted-foreground">Planejamento de compra e geração de disponibilidade virtual</p>
        </div>
        {podeGerenciar && editavel && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={salvar} disabled={salvando}>
              <Save className="mr-2 h-4 w-4" />
              Salvar rascunho
            </Button>
            {compra && (
              <Button onClick={confirmar} disabled={salvando} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirmar compra
              </Button>
            )}
          </div>
        )}
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        Alterar uma compra confirmada recalcula imediatamente a disponibilidade virtual impactada.
      </p>

      {compra?.status === 'confirmada' && podeGerenciar && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setModalEditar(true)}>Editar compra confirmada</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
              <div>
                <Label htmlFor="data">Data operacional</Label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="data"
                    type="date"
                    className="pl-9"
                    value={dataOperacao}
                    onChange={(e) => setDataOperacao(e.target.value)}
                    disabled={Boolean(compra)}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>Fornecedor</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId} disabled={!editavel}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.razaoSocial ?? f.codigo ?? f.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ref">Referência externa</Label>
                <Input id="ref" className="mt-1" value={referenciaExterna} onChange={(e) => setReferenciaExterna(e.target.value)} disabled={!editavel} />
              </div>
              <div>
                <Label>Status</Label>
                <div className="mt-2">
                  <StatusPill
                    variant={statusCompraVariant(compra?.status ?? 'rascunho')}
                    label={ROTULO_COMPRA[compra?.status ?? 'rascunho'] ?? compra?.status ?? 'Rascunho'}
                  />
                </div>
              </div>
              <div className="sm:col-span-3">
                <Label htmlFor="obs">Observações</Label>
                <Textarea id="obs" className="mt-1" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={!editavel} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-semibold">Itens da compra</h2>
              {editavel && podeGerenciar && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLinhas((p) => [...p, { itemCompraId: '', quantidadeComprada: '', observacoes: '' }])}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar item
                </Button>
              )}
            </div>
            <div className="overflow-x-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Item de compra</th>
                    <th className="pb-2 font-medium">Quantidade</th>
                    <th className="pb-2 font-medium">Observações</th>
                    <th className="pb-2 font-medium">Regra de Desdobramento</th>
                    <th className="pb-2 text-right font-medium">Previsão (kg)</th>
                    {editavel && <th className="pb-2 w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {linhas.map((linha, idx) => {
                    const simulacao = simulacoes.get(linha.itemCompraId);
                    const regraDesdobramento = simulacao
                      ? simulacao.itens.map((i) => `${i.fator}× ${i.descricao}`).join(' + ')
                      : '—';
                    return (
                    <tr key={idx}>
                      <td className="py-3 pr-2">
                        <Select
                          value={linha.itemCompraId}
                          onValueChange={(v) =>
                            setLinhas((p) => p.map((l, i) => (i === idx ? { ...l, itemCompraId: v } : l)))
                          }
                          disabled={!editavel}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Item" />
                          </SelectTrigger>
                          <SelectContent>
                            {itensCompra.map((it) => (
                              <SelectItem key={it.id} value={it.id}>
                                {it.nome ?? it.codigo ?? it.id.slice(0, 8)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-2">
                        <Input
                          type="number"
                          step="0.001"
                          value={linha.quantidadeComprada}
                          onChange={(e) =>
                            setLinhas((p) => p.map((l, i) => (i === idx ? { ...l, quantidadeComprada: e.target.value } : l)))
                          }
                          disabled={!editavel}
                        />
                      </td>
                      <td className="py-3 pr-2">
                        <Input
                          value={linha.observacoes}
                          onChange={(e) =>
                            setLinhas((p) => p.map((l, i) => (i === idx ? { ...l, observacoes: e.target.value } : l)))
                          }
                          disabled={!editavel}
                        />
                      </td>
                      <td className="py-3 pr-2 text-xs">{regraDesdobramento}</td>
                      <td
                        className="py-3 text-right text-xs text-muted-foreground"
                        title="Previsão de peso depende de cadastro de peso médio por item — pendente"
                      >
                        —
                      </td>
                      {editavel && (
                        <td className="py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLinhas((p) => p.filter((_, i) => i !== idx))}
                            disabled={linhas.length <= 1}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card className="border-t-4 border-t-primary">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Disponibilidade gerada</h2>
              </div>
              {podeSimular ? (
                simulacoes.size === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    A disponibilidade estimada aparecerá conforme itens e quantidades forem informados.
                  </p>
                ) : (
                  (() => {
                    const agregado = new Map<string, { descricao: string; total: number }>();
                    let totalEstimado = 0;
                    for (const sim of simulacoes.values()) {
                      totalEstimado += sim.totalPartes;
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
                        <p className="-mt-2 text-xs text-muted-foreground">
                          A confirmação deste pedido irá gerar saldo para vendas nas seguintes proporções estimadas:
                        </p>
                        <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4">
                          {linhasAgregadas.map((l, i) => (
                            <div key={l.descricao}>
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{l.descricao}</span>
                                <span className="font-bold text-primary">{l.total.toLocaleString('pt-BR')} peças</span>
                              </div>
                              {i < linhasAgregadas.length - 1 && <div className="mt-3 h-px w-full bg-border" />}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-sm text-muted-foreground">Total Estimado</span>
                          <span className="text-2xl font-bold">{totalEstimado.toLocaleString('pt-BR')} partes</span>
                        </div>
                        <div className="mt-2 flex items-start gap-2 rounded-md bg-primary/10 p-3 text-xs text-primary">
                          <span>Os itens comerciais ficarão disponíveis para a equipe de vendas imediatamente após a confirmação da compra.</span>
                        </div>
                      </>
                    );
                  })()
                )
              ) : disponibilidade.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  A disponibilidade aparecerá após confirmar a compra programada.
                </p>
              ) : (
                <ul className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                  {disponibilidade.map((d) => (
                    <li key={d.id} className="flex justify-between">
                      <span className="font-mono text-xs">{d.itemComercialId.slice(0, 8)}…</span>
                      <span className="font-semibold text-primary">{d.quantidadeDisponivel} disp.</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
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
