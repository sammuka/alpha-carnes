'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Save, Send, Trash2 } from 'lucide-react';
import type {
  CompraProgramada,
  CriarPedidoDto,
  OverbookingChallenge,
  PedidoAbertoExistente,
  PedidoVendaDetalhe,
} from '@/lib/comercial';
import { AlertItem } from '@/components/ui/alert-item';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ComboboxField } from '@/components/ui/combobox-field';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ModalAdendo } from './modal-adendo';
import { ModalOverbooking } from './modal-overbooking';

export interface ClientePedido {
  id: string;
  codigo: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  representanteNome?: string | null;
  rotaNome?: string | null;
}

export interface ProdutoPedido {
  id: string;
  codigo: string;
  descricao?: string;
  nome?: string;
  unidadeComercial?: string;
}

interface PedidoEditorProps {
  pedido: PedidoVendaDetalhe | null;
  clientes: ClientePedido[];
  produtos: ProdutoPedido[];
  compras: CompraProgramada[];
  podeGerenciar: boolean;
  podeFinalizar: boolean;
  onBack: () => void;
  onChanged: (pedidoId?: string) => Promise<void> | void;
}

interface ItemNovo {
  itemComercialId: string;
  quantidadePedida: number;
}

interface AdendoPendente {
  pedido: PedidoAbertoExistente;
  itemComercialId: string;
  quantidadeAdicionar: number;
}

async function corpoDeErro(response: Response): Promise<{ texto: string; dados?: unknown }> {
  const texto = await response.text();
  if (!texto) return { texto: `Falha HTTP ${response.status}` };
  try {
    const dados = JSON.parse(texto) as { message?: unknown; error?: unknown };
    const mensagem = typeof dados.message === 'string'
      ? dados.message
      : typeof dados.error === 'string'
        ? dados.error
        : texto;
    return { texto: mensagem, dados };
  } catch {
    return { texto };
  }
}

function dadosDeNegocio(dados: unknown): Record<string, unknown> | null {
  if (!dados || typeof dados !== 'object') return null;
  const objeto = dados as Record<string, unknown>;
  return objeto.message && typeof objeto.message === 'object'
    ? objeto.message as Record<string, unknown>
    : objeto;
}

function nomeProduto(produto: ProdutoPedido | undefined): string {
  return produto?.descricao ?? produto?.nome ?? produto?.codigo ?? 'Produto';
}

function origemItem(item: PedidoVendaDetalhe['itens'][number]): 'Físico' | 'Virtual' | 'Overbooking' {
  if (Number(item.quantidadeOverbooking ?? 0) > 0) return 'Overbooking';
  const tipos = item.reservas?.map((reserva) => reserva.tipoConsumo ?? reserva.origem);
  if (tipos?.includes('fisico')) return 'Físico';
  return 'Virtual';
}

export function PedidoEditor({
  pedido,
  clientes,
  produtos,
  compras,
  podeGerenciar,
  podeFinalizar,
  onBack,
  onChanged,
}: PedidoEditorProps) {
  const [clienteId, setClienteId] = useState(pedido?.clienteId ?? '');
  const [compraProgramadaId, setCompraProgramadaId] = useState(pedido?.compraProgramadaId ?? '');
  const [representante, setRepresentante] = useState(pedido?.heranca?.representanteNome ?? '');
  const [rota, setRota] = useState(pedido?.rotaPrevista ?? pedido?.heranca?.rotaNome ?? '');
  const [prioridade, setPrioridade] = useState(String(pedido?.prioridade ?? 0));
  const [observacoes, setObservacoes] = useState(pedido?.observacoesGerais ?? '');
  const [produtoNovo, setProdutoNovo] = useState('');
  const [quantidadeNova, setQuantidadeNova] = useState('1');
  const [itensNovos, setItensNovos] = useState<ItemNovo[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [erro, setErro] = useState('');
  const [pendente, setPendente] = useState(false);
  const [challenge, setChallenge] = useState<OverbookingChallenge | null>(null);
  const [retryChallenge, setRetryChallenge] = useState<(() => Promise<void>) | null>(null);
  const [adendo, setAdendo] = useState<AdendoPendente | null>(null);
  const [fecharAposAdendo, setFecharAposAdendo] = useState(false);

  useEffect(() => {
    setQuantidades(Object.fromEntries(
      (pedido?.itens ?? []).map((item) => [item.id, String(Number(item.quantidadePedida))]),
    ));
  }, [pedido]);

  const compraSelecionada = compras.find((compra) => compra.id === compraProgramadaId);
  const produtosAusentes = useMemo(() => {
    const ids = new Set([
      ...(pedido?.itens.map((item) => item.itemComercialId) ?? []),
      ...itensNovos.map((item) => item.itemComercialId),
    ]);
    return produtos.filter((produto) => !ids.has(produto.id));
  }, [itensNovos, pedido, produtos]);

  const itensCombobox = useMemo(() => clientes.map((cliente) => ({
    id: cliente.id,
    label: cliente.nomeFantasia || cliente.razaoSocial,
    sublabel: cliente.codigo,
  })), [clientes]);

  async function selecionarCliente(id: string) {
    setClienteId(id);
    setRepresentante('');
    setRota('');
    if (!id) return;
    const response = await fetch(`/api/cadastros/clientes/${id}`, { cache: 'no-store' });
    if (!response.ok) {
      setErro((await corpoDeErro(response)).texto);
      return;
    }
    const cliente = await response.json() as ClientePedido;
    setRepresentante(cliente.representanteNome ?? '');
    setRota(cliente.rotaNome ?? '');
  }

  async function mutar(
    url: string,
    init: RequestInit,
    confirmarUrl?: string,
  ): Promise<boolean> {
    setPendente(true);
    setErro('');
    try {
      const response = await fetch(url, {
        ...init,
        headers: { 'content-type': 'application/json', ...init.headers },
      });
      if (response.ok) return true;
      const falha = await corpoDeErro(response);
      const dados = dadosDeNegocio(falha.dados);
      if (
        response.status === 409
        && confirmarUrl
        && dados?.code === 'OVERBOOKING_CONFIRMACAO_NECESSARIA'
      ) {
        setChallenge(dados as unknown as OverbookingChallenge);
        setRetryChallenge(() => async () => {
          const confirmado = await fetch(confirmarUrl, {
            ...init,
            headers: { 'content-type': 'application/json', ...init.headers },
          });
          if (!confirmado.ok) {
            setErro((await corpoDeErro(confirmado)).texto);
            return;
          }
          setChallenge(null);
          setRetryChallenge(null);
          await onChanged(pedido?.id);
        });
        return false;
      }
      setErro(falha.texto);
      return false;
    } finally {
      setPendente(false);
    }
  }

  async function recarregar() {
    await onChanged(pedido?.id);
  }

  async function aplicarQuantidade(item: PedidoVendaDetalhe['itens'][number]) {
    if (!pedido) return;
    const atual = Number(item.quantidadePedida);
    const nova = Number(quantidades[item.id]);
    if (!Number.isFinite(nova) || nova < 0) {
      setErro('Informe uma quantidade válida.');
      return;
    }
    if (nova === atual) return;
    if (nova === 0) {
      const ok = await mutar(`/api/comercial/pedidos/${pedido.id}/itens/${item.id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          motivo: 'Remoção de item ao zerar quantidade no editor de rascunho',
        }),
      });
      if (ok) await recarregar();
      return;
    }
    if (nova < atual) {
      const ok = await mutar(`/api/comercial/pedidos/${pedido.id}/itens/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          novaQuantidade: nova,
          motivo: 'Redução de quantidade no editor de rascunho',
        }),
      });
      if (ok) await recarregar();
      return;
    }
    setAdendo({
      pedido: {
        code: 'PEDIDO_ABERTO_EXISTENTE',
        message: 'Pedido aberto selecionado para adendo.',
        pedidoId: pedido.id,
        status: pedido.status,
        itemComercialId: item.itemComercialId,
        quantidadeAtual: item.quantidadePedida,
      },
      itemComercialId: item.itemComercialId,
      quantidadeAdicionar: nova - atual,
    });
  }

  async function removerItem(item: PedidoVendaDetalhe['itens'][number]) {
    if (!pedido) return;
    const ok = await mutar(`/api/comercial/pedidos/${pedido.id}/itens/${item.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ motivo: 'Remoção de item no editor de rascunho' }),
    });
    if (ok) await recarregar();
  }

  async function confirmarAdendo(motivo: string) {
    if (!adendo) return;
    const body = JSON.stringify({
      itemComercialId: adendo.itemComercialId,
      quantidadeAdicionada: adendo.quantidadeAdicionar,
      motivo,
    });
    const ok = await mutar(
      `/api/comercial/pedidos/${adendo.pedido.pedidoId}/adendos`,
      { method: 'POST', body },
      `/api/comercial/pedidos/${adendo.pedido.pedidoId}/adendos/confirmar-overbooking`,
    );
    if (ok) {
      setAdendo(null);
      if (fecharAposAdendo) {
        setFecharAposAdendo(false);
        await onChanged();
        onBack();
      } else {
        await recarregar();
      }
    }
  }

  async function adicionarProduto() {
    const quantidade = Number(quantidadeNova);
    if (!produtoNovo || !Number.isFinite(quantidade) || quantidade <= 0) {
      setErro('Selecione um produto e informe uma quantidade positiva.');
      return;
    }
    if (!pedido) {
      setItensNovos((atuais) => [...atuais, {
        itemComercialId: produtoNovo,
        quantidadePedida: quantidade,
      }]);
      setProdutoNovo('');
      setQuantidadeNova('1');
      return;
    }
    const body = JSON.stringify({ itemComercialId: produtoNovo, quantidade });
    const ok = await mutar(
      `/api/comercial/pedidos/${pedido.id}/itens`,
      { method: 'POST', body },
      `/api/comercial/pedidos/${pedido.id}/itens/confirmar-overbooking`,
    );
    if (ok) {
      setProdutoNovo('');
      setQuantidadeNova('1');
      await recarregar();
    }
  }

  function payloadNovo(salvarComoRascunho: boolean): CriarPedidoDto | null {
    if (!clienteId || !compraSelecionada || itensNovos.length === 0) {
      setErro('Cliente, operação e ao menos um produto são obrigatórios.');
      return null;
    }
    return {
      compraProgramadaId: compraSelecionada.id,
      clienteId,
      dataOperacao: compraSelecionada.dataOperacao,
      rotaPrevista: rota || undefined,
      prioridade: Number(prioridade) || 0,
      observacoesGerais: observacoes || undefined,
      salvarComoRascunho,
      itens: itensNovos,
    };
  }

  async function salvarNovo(salvarComoRascunho: boolean) {
    const payload = payloadNovo(salvarComoRascunho);
    if (!payload) return;
    const body = JSON.stringify(payload);
    setPendente(true);
    setErro('');
    try {
      const response = await fetch('/api/comercial/pedidos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      if (response.ok) {
        const criado = await response.json() as { id: string };
        if (!salvarComoRascunho) {
          const finalizado = await fetch(`/api/comercial/pedidos/${criado.id}/finalizar`, {
            method: 'POST',
          });
          if (!finalizado.ok) {
            setErro((await corpoDeErro(finalizado)).texto);
            return;
          }
        }
        await onChanged();
        onBack();
        return;
      }

      const falha = await corpoDeErro(response);
      const dados = dadosDeNegocio(falha.dados);
      if (response.status === 409 && dados?.code === 'OVERBOOKING_CONFIRMACAO_NECESSARIA') {
        setChallenge(dados as unknown as OverbookingChallenge);
        setRetryChallenge(() => async () => {
          setPendente(true);
          try {
            const confirmado = await fetch('/api/comercial/pedidos/confirmar-overbooking', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body,
            });
            if (!confirmado.ok) {
              setErro((await corpoDeErro(confirmado)).texto);
              return;
            }
            const criado = await confirmado.json() as { id: string };
            if (!salvarComoRascunho) {
              const finalizado = await fetch(`/api/comercial/pedidos/${criado.id}/finalizar`, {
                method: 'POST',
              });
              if (!finalizado.ok) {
                setErro((await corpoDeErro(finalizado)).texto);
                return;
              }
            }
            setChallenge(null);
            setRetryChallenge(null);
            await onChanged();
            onBack();
          } finally {
            setPendente(false);
          }
        });
        return;
      }

      if (response.status === 409 && dados?.code === 'PEDIDO_ABERTO_EXISTENTE') {
        const conflitos = Array.isArray(dados.conflitos)
          ? dados.conflitos as Array<{ itemComercialId?: string }>
          : [];
        const itemComercialId = conflitos[0]?.itemComercialId ?? itensNovos[0]?.itemComercialId;
        const item = itensNovos.find((entry) => entry.itemComercialId === itemComercialId);
        if (itemComercialId && item) {
          const query = new URLSearchParams({
            clienteId: payload.clienteId,
            itemComercialId,
            dataOperacao: payload.dataOperacao,
          });
          const abertoResponse = await fetch(`/api/comercial/pedidos/aberto?${query.toString()}`, {
            cache: 'no-store',
          });
          if (abertoResponse.ok) {
            const aberto = await abertoResponse.json() as PedidoAbertoExistente;
            setFecharAposAdendo(true);
            setAdendo({
              pedido: aberto,
              itemComercialId,
              quantidadeAdicionar: item.quantidadePedida,
            });
            return;
          }
        }
      }
      setErro(falha.texto);
    } finally {
      setPendente(false);
    }
  }

  async function finalizar() {
    if (!pedido) {
      await salvarNovo(false);
      return;
    }
    const ok = await mutar(`/api/comercial/pedidos/${pedido.id}/finalizar`, {
      method: 'POST',
    });
    if (ok) {
      await recarregar();
      onBack();
    }
  }

  const itensRenderizados = pedido?.itens ?? [];

  return (
    <div className="space-y-3">
      <div className="mb-3 flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Voltar para pedidos">
          <ArrowLeft />
        </Button>
        <PageHeader
          className="mb-0 flex-1"
          title={pedido ? 'Editar Pedido' : 'Novo Pedido'}
          subtitle={pedido ? `Pedido ${pedido.id}` : 'Monte o pedido e confira as reservas antes de finalizar.'}
        />
      </div>

      {erro && (
        <AlertItem
          variant="bloqueado"
          title="Não foi possível concluir a ação"
          description={erro}
          time=""
        />
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 p-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="Buscar cliente" htmlFor="pedido-cliente">
            <ComboboxField
              id="pedido-cliente"
              items={itensCombobox}
              value={clienteId}
              onChange={(id) => void selecionarCliente(id)}
              placeholder="Selecione"
              searchPlaceholder="Buscar cliente..."
              emptyText="Nenhum cliente encontrado."
              disabled={Boolean(pedido) || !podeGerenciar}
            />
          </FormField>
          <FormField label="Operação" htmlFor="pedido-operacao">
            <SelectNative
              id="pedido-operacao"
              value={compraProgramadaId}
              disabled={Boolean(pedido) || !podeGerenciar}
              onChange={(event) => setCompraProgramadaId(event.target.value)}
            >
              <option value="">Selecione</option>
              {compras.map((compra) => (
                <option key={compra.id} value={compra.id}>{compra.dataOperacao}</option>
              ))}
            </SelectNative>
          </FormField>
          <FormField label="Representante" htmlFor="pedido-representante">
            <Input
              id="pedido-representante"
              value={representante}
              readOnly
              placeholder="—"
            />
          </FormField>
          <FormField label="Rota" htmlFor="pedido-rota">
            <Input
              id="pedido-rota"
              value={rota}
              onChange={(event) => setRota(event.target.value)}
              readOnly={Boolean(pedido) || !podeGerenciar}
              placeholder="—"
            />
          </FormField>
          <FormField label="Prioridade" htmlFor="pedido-prioridade">
            <Input
              id="pedido-prioridade"
              type="number"
              min={0}
              max={100}
              className="w-full"
              value={prioridade}
              readOnly={Boolean(pedido) || !podeGerenciar}
              onChange={(event) => setPrioridade(event.target.value)}
            />
          </FormField>
          <FormField label="Observações" htmlFor="pedido-observacoes" className="xl:col-span-3">
            <Textarea
              id="pedido-observacoes"
              value={observacoes}
              readOnly={Boolean(pedido) || !podeGerenciar}
              onChange={(event) => setObservacoes(event.target.value)}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens do pedido</CardTitle>
          <CardDescription>A reserva é atualizada a cada ação da grade.</CardDescription>
        </CardHeader>
        {itensRenderizados.length > 0 && (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Produto</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensRenderizados.map((item) => {
                  const produto = produtos.find((entry) => entry.id === item.itemComercialId);
                  const nome = item.itemComercial?.nome
                    ?? item.itemComercial?.descricao
                    ?? nomeProduto(produto);
                  return (
                    <TableRow key={item.id} data-testid={`linha-${item.id}`} className="group">
                      <TableCell className="text-[13px] font-semibold text-foreground">{nome}</TableCell>
                      <TableCell className="text-muted-foreground">{origemItem(item)}</TableCell>
                      <TableCell>
                        <Input
                          aria-label="Quantidade"
                          type="number"
                          min={0}
                          step="0.001"
                          className="h-7 w-24 text-right font-data"
                          value={quantidades[item.id] ?? ''}
                          disabled={!podeGerenciar}
                          onChange={(event) => setQuantidades((atuais) => ({
                            ...atuais,
                            [item.id]: event.target.value,
                          }))}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!podeGerenciar || pendente}
                            onClick={() => void aplicarQuantidade(item)}
                          >
                            Aplicar quantidade
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="iconSm"
                            disabled={!podeGerenciar || pendente}
                            aria-label={`Remover ${nome}`}
                            onClick={() => void removerItem(item)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        )}

        {itensNovos.length > 0 && (
          <CardContent className="pt-0">
            <ul className="divide-y divide-border rounded-lg border border-border">
              {itensNovos.map((item) => (
                <li key={item.itemComercialId} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{nomeProduto(produtos.find((produto) => produto.id === item.itemComercialId))}</span>
                  <span className="font-data">{item.quantidadePedida}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        )}

        <CardFooter className="flex-wrap items-end gap-2">
          <FormField label="Produto" htmlFor="produto-novo" className="flex-1">
            <SelectNative
              id="produto-novo"
              value={produtoNovo}
              disabled={!podeGerenciar}
              onChange={(event) => setProdutoNovo(event.target.value)}
            >
              <option value="">Selecione</option>
              {produtosAusentes.map((produto) => (
                <option key={produto.id} value={produto.id}>{nomeProduto(produto)}</option>
              ))}
            </SelectNative>
          </FormField>
          <FormField label="Quantidade do novo produto" htmlFor="quantidade-produto-novo">
            <Input
              id="quantidade-produto-novo"
              type="number"
              min={0.001}
              step="0.001"
              className="w-28 text-right font-data"
              value={quantidadeNova}
              disabled={!podeGerenciar}
              onChange={(event) => setQuantidadeNova(event.target.value)}
            />
          </FormField>
          <Button type="button" variant="secondary" disabled={!podeGerenciar || pendente} onClick={() => void adicionarProduto()}>
            <Plus />
            Adicionar produto
          </Button>
        </CardFooter>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>Cancelar</Button>
        {!pedido && (
          <Button type="button" variant="secondary" disabled={!podeGerenciar || pendente} onClick={() => void salvarNovo(true)}>
            <Save />
            Salvar Rascunho
          </Button>
        )}
        {pedido?.status === 'rascunho' && (
          <Button type="button" variant="secondary" disabled={!podeGerenciar || pendente} onClick={onBack}>
            <Save />
            Salvar Rascunho
          </Button>
        )}
        <Button type="button" disabled={!podeFinalizar || pendente} onClick={() => void finalizar()}>
          <Send />
          Finalizar Pedido
        </Button>
      </div>

      {challenge && (
        <ModalOverbooking
          open
          challenge={challenge}
          pending={pendente}
          onCancel={() => {
            setChallenge(null);
            setRetryChallenge(null);
          }}
          onConfirm={() => void retryChallenge?.()}
        />
      )}
      {adendo && (
        <ModalAdendo
          open
          pedido={adendo.pedido}
          quantidadeAdicionar={adendo.quantidadeAdicionar}
          pending={pendente}
          onCancel={() => setAdendo(null)}
          onConfirm={(motivo) => void confirmarAdendo(motivo)}
        />
      )}
    </div>
  );
}
