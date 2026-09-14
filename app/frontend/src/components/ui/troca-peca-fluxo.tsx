'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { cn } from '@/lib/cn';
import {
  ROTULOS_MOTIVO_TROCA_PECA,
  type DestinoRetirada,
  type MotivoTrocaPeca,
} from '@/lib/operacao';
import { BadgeCount } from './badge-count';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Input } from './input';
import { FormField } from './form-field';
import { SelectNative } from './select-native';
import { Tabs, TabsList, TabsTrigger } from './tabs';
import type {
  PecaTrocaOpcao,
  PedidoTrocaOpcao,
  TipoPecaTroca,
  TrocaPecaFluxoProps,
} from './troca-peca-modal';

const TIPOS_PECA_FALLBACK = ['TZ', 'DT', 'PA'] as const;

function codigoTipo(valor: string | undefined): string {
  return (valor ?? '').split(/[\s—-]/)[0]?.toUpperCase() ?? '';
}

function tipoDaPeca(peca: PecaTrocaOpcao, fallback = ''): string {
  return (peca.produtoCodigo ?? (codigoTipo(peca.produtoLabel) || codigoTipo(peca.codigo) || fallback)).toUpperCase();
}

function tipoDoPedido(pedido: PedidoTrocaOpcao): string {
  return (pedido.produtoCodigo ?? codigoTipo(pedido.produtoLabel)).toUpperCase();
}

function formatPesoOpcao(peso: string): string {
  const n = Number(peso);
  if (!Number.isFinite(n)) return `${peso} kg`;
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
}

function qtdUnidades(valor: number | undefined): number {
  const n = Number(valor ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function rotuloVinculos(pedido: PedidoTrocaOpcao): string {
  return `${qtdUnidades(pedido.quantidadeJaVinculada)}/${qtdUnidades(pedido.quantidadeTotalAVincular)}`;
}

function vinculosCompletos(pedido: PedidoTrocaOpcao): boolean {
  const total = qtdUnidades(pedido.quantidadeTotalAVincular);
  return total > 0 && qtdUnidades(pedido.quantidadeJaVinculada) >= total;
}

function vinculosIncompletos(pedido: PedidoTrocaOpcao): boolean {
  const total = qtdUnidades(pedido.quantidadeTotalAVincular);
  return total > 0 && qtdUnidades(pedido.quantidadeJaVinculada) < total;
}

function chaveAgrupamentoPedido(pedido: PedidoTrocaOpcao): string {
  return `${pedido.pedidoVendaId}::${(pedido.produtoCodigo ?? pedido.produtoLabel).toUpperCase()}`;
}

function itemDestinoId(pedido: PedidoTrocaOpcao): string {
  const incompleto = pedido.itensGrupo?.find(
    (item) => qtdUnidades(item.quantidadeTotalAVincular) > 0
      && qtdUnidades(item.quantidadeJaVinculada) < qtdUnidades(item.quantidadeTotalAVincular),
  );
  return incompleto?.pedidoVendaItemId ?? pedido.pedidoVendaItemId;
}

/** Soma vínculos do mesmo pedido + item comercial para não tratar 2×(1/1) como dois pedidos. */
function agruparPedidosTroca(pedidos: PedidoTrocaOpcao[]): PedidoTrocaOpcao[] {
  const grupos = new Map<string, PedidoTrocaOpcao>();
  for (const pedido of pedidos) {
    const chave = chaveAgrupamentoPedido(pedido);
    const existente = grupos.get(chave);
    const item = {
      pedidoVendaItemId: pedido.pedidoVendaItemId,
      quantidadeJaVinculada: qtdUnidades(pedido.quantidadeJaVinculada),
      quantidadeTotalAVincular: qtdUnidades(pedido.quantidadeTotalAVincular),
    };
    if (!existente) {
      grupos.set(chave, {
        ...pedido,
        pecasAssociadas: [...pedido.pecasAssociadas],
        itensGrupo: pedido.itensGrupo ?? [item],
      });
      continue;
    }
    existente.quantidadeJaVinculada += item.quantidadeJaVinculada;
    existente.quantidadeTotalAVincular += item.quantidadeTotalAVincular;
    existente.pecasAssociadas.push(...pedido.pecasAssociadas);
    existente.itensGrupo = [...(existente.itensGrupo ?? []), item];
    if (vinculosIncompletos({
      ...pedido,
      quantidadeJaVinculada: item.quantidadeJaVinculada,
      quantidadeTotalAVincular: item.quantidadeTotalAVincular,
    })) {
      existente.pedidoVendaItemId = pedido.pedidoVendaItemId;
    }
  }
  return [...grupos.values()];
}

function PedidoNomeFantasiaCard({
  pedido,
  selecionado,
  onSelect,
}: {
  pedido: PedidoTrocaOpcao;
  selecionado: boolean;
  onSelect?: () => void;
}) {
  const classe = cn(
    'w-full rounded-lg border px-3 py-2 text-left text-[13px]',
    selecionado ? 'border-action-blue bg-blue-50' : 'border-border',
  );
  const conteudo = (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <p className="min-w-0 truncate font-semibold">{pedido.clienteNome}</p>
      <p className="shrink-0 font-mono text-[12px] text-muted-foreground">{rotuloVinculos(pedido)}</p>
    </div>
  );
  if (!onSelect) {
    return <div className={classe}>{conteudo}</div>;
  }
  return (
    <button type="button" onClick={onSelect} className={classe}>
      {conteudo}
    </button>
  );
}

function PecaTrocaCard({
  peca,
  selecionada,
  onSelect,
}: {
  peca: PecaTrocaOpcao;
  selecionada: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border p-3 text-left text-[13px]',
        selecionada ? 'border-action-blue bg-blue-50' : 'border-border',
      )}
    >
      <p className="font-mono font-semibold">{peca.codigo} · {formatPesoOpcao(peca.peso)}</p>
    </button>
  );
}

function PedidosOrigemList({
  pedidos,
  pedidoSel,
  onSelect,
}: {
  pedidos: PedidoTrocaOpcao[];
  pedidoSel: PedidoTrocaOpcao | null;
  onSelect: (pedido: PedidoTrocaOpcao) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto" aria-label="Pedidos de origem">
      <p className="text-[12px] text-muted-foreground">Selecione o pedido.</p>
      {pedidos.map((p) => (
        <PedidoNomeFantasiaCard
          key={p.pedidoVendaItemId}
          pedido={p}
          selecionado={pedidoSel?.pedidoVendaItemId === p.pedidoVendaItemId}
          onSelect={() => onSelect(p)}
        />
      ))}
      {pedidos.length === 0 && (
        <p className="text-[12px] text-muted-foreground">Nenhum pedido com vínculos completos neste tipo.</p>
      )}
    </div>
  );
}

function PecasVinculadasOrigem({
  pedidoSel,
  pecas,
  pecaRetirada,
  onSelect,
}: {
  pedidoSel: PedidoTrocaOpcao | null;
  pecas: PecaTrocaOpcao[];
  pecaRetirada: PecaTrocaOpcao | null;
  onSelect: (peca: PecaTrocaOpcao) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto border-t border-border pt-3" aria-label="Peças vinculadas">
      <p className="text-[12px] text-muted-foreground">Peças vinculadas do pedido.</p>
      {!pedidoSel && (
        <p className="text-[12px] text-muted-foreground">Selecione um pedido para listar as peças.</p>
      )}
      {pedidoSel && pecas.length === 0 && (
        <p className="text-[12px] text-muted-foreground">Este pedido não tem peças vinculadas neste lote.</p>
      )}
      {pecas.map((p) => (
        <PecaTrocaCard
          key={p.id}
          peca={p}
          selecionada={pecaRetirada?.id === p.id}
          onSelect={() => onSelect(p)}
        />
      ))}
    </div>
  );
}

function PedidosDestinoList({
  pedidos,
  pedidoSel,
  onSelect,
}: {
  pedidos: PedidoTrocaOpcao[];
  pedidoSel: PedidoTrocaOpcao | null;
  onSelect: (pedido: PedidoTrocaOpcao) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto" aria-label="Pedidos de destino">
      <p className="text-[12px] text-muted-foreground">Pedidos com vínculos incompletos.</p>
      {pedidos.map((p) => (
        <PedidoNomeFantasiaCard
          key={p.pedidoVendaItemId}
          pedido={p}
          selecionado={pedidoSel?.pedidoVendaItemId === p.pedidoVendaItemId}
          onSelect={() => onSelect(p)}
        />
      ))}
      {pedidos.length === 0 && (
        <p className="text-[12px] text-muted-foreground">Nenhum pedido com espaço para novas inclusões neste tipo.</p>
      )}
    </div>
  );
}

export function TrocaPecaFluxo({
  open,
  onFechar,
  onTrocaConcluida,
  pedidos,
  pecasDisponiveis,
  tiposPeca,
}: TrocaPecaFluxoProps) {
  const [buscaOrigem, setBuscaOrigem] = useState('');
  const [tipoOrigem, setTipoOrigem] = useState('');
  const [pecaRetirada, setPecaRetirada] = useState<PecaTrocaOpcao | null>(null);
  const [pedidoSel, setPedidoSel] = useState<PedidoTrocaOpcao | null>(null);

  const [buscaDestino, setBuscaDestino] = useState('');
  const [pedidoDestino, setPedidoDestino] = useState<PedidoTrocaOpcao | null>(null);
  const [necessitaSubstituicao, setNecessitaSubstituicao] = useState(true);

  const [destinoRetirada, setDestinoRetirada] = useState<DestinoRetirada>('estoque');
  const [motivo, setMotivo] = useState<MotivoTrocaPeca | ''>('');
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const pedidosAgrupados = useMemo(() => agruparPedidosTroca(pedidos), [pedidos]);

  const tiposDisponiveis = useMemo<TipoPecaTroca[]>(() => {
    if (tiposPeca && tiposPeca.length > 0) {
      const vistos = new Set<string>();
      const filtrados = tiposPeca.filter((t) => {
        const codigo = t.codigo.trim().toUpperCase();
        if (!codigo || vistos.has(codigo)) return false;
        vistos.add(codigo);
        return true;
      }).map((t) => ({ codigo: t.codigo.trim().toUpperCase(), label: t.label }));
      if (filtrados.length > 0) return filtrados;
    }
    const map = new Map<string, TipoPecaTroca>();
    for (const p of pedidosAgrupados) {
      const codigo = tipoDoPedido(p);
      if (codigo && !map.has(codigo)) map.set(codigo, { codigo, label: p.produtoLabel || codigo });
    }
    for (const peca of pecasDisponiveis) {
      const codigo = tipoDaPeca(peca);
      if (codigo && !map.has(codigo)) map.set(codigo, { codigo, label: peca.produtoLabel || codigo });
    }
    if (map.size > 0) return [...map.values()];
    return TIPOS_PECA_FALLBACK.map((codigo) => ({ codigo, label: codigo }));
  }, [tiposPeca, pedidosAgrupados, pecasDisponiveis]);

  useEffect(() => {
    if (!open) return;
    setBuscaOrigem('');
    setTipoOrigem('');
    setPecaRetirada(null);
    setPedidoSel(null);
    setBuscaDestino('');
    setPedidoDestino(null);
    setNecessitaSubstituicao(true);
    setDestinoRetirada('estoque');
    setMotivo('');
    setObservacoes('');
    setEnviando(false);
    setErro(null);
    setMensagemSucesso(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (tipoOrigem && tiposDisponiveis.some((t) => t.codigo === tipoOrigem)) return;
    const primeiro = tiposDisponiveis[0]?.codigo ?? '';
    if (primeiro) setTipoOrigem(primeiro);
  }, [open, tipoOrigem, tiposDisponiveis]);

  const selecionarTipo = (codigo: string) => {
    setTipoOrigem(codigo);
    setPedidoSel(null);
    setPedidoDestino(null);
    setPecaRetirada(null);
    setBuscaOrigem('');
    setBuscaDestino('');
  };

  const pedidosDoTipo = useMemo(
    () => pedidosAgrupados.filter((p) => !tipoOrigem || tipoDoPedido(p) === tipoOrigem),
    [pedidosAgrupados, tipoOrigem],
  );

  const pedidosOrigemDoTipo = useMemo(
    () => pedidosDoTipo.filter(vinculosCompletos),
    [pedidosDoTipo],
  );

  const pedidosDestinoDoTipo = useMemo(
    () => pedidosDoTipo.filter(vinculosIncompletos),
    [pedidosDoTipo],
  );

  const pedidosOrigemFiltrados = useMemo(() => {
    const q = buscaOrigem.trim().toLowerCase();
    if (!q) return pedidosOrigemDoTipo;
    return pedidosOrigemDoTipo.filter((p) => p.clienteNome.toLowerCase().includes(q));
  }, [pedidosOrigemDoTipo, buscaOrigem]);

  const pecasOrigem = useMemo(() => {
    if (!pedidoSel) return [];
    return pedidoSel.pecasAssociadas.filter((peca) => {
      if (!tipoOrigem) return true;
      return tipoDaPeca(peca, tipoDoPedido(pedidoSel)) === tipoOrigem;
    });
  }, [pedidoSel, tipoOrigem]);

  const pedidosDestinoFiltrados = useMemo(() => {
    const q = buscaDestino.trim().toLowerCase();
    if (!q) return pedidosDestinoDoTipo;
    return pedidosDestinoDoTipo.filter((p) => p.clienteNome.toLowerCase().includes(q));
  }, [pedidosDestinoDoTipo, buscaDestino]);

  const podeConfirmar =
    !!pedidoSel
    && !!pecaRetirada
    && !!motivo
    && (motivo !== 'outro' || observacoes.trim().length > 0)
    && (necessitaSubstituicao ? !!pedidoDestino : !!destinoRetirada);

  const confirmar = async () => {
    if (!pecaRetirada || !pedidoSel || !motivo) return;
    if (necessitaSubstituicao && !pedidoDestino) return;
    if (!necessitaSubstituicao && !destinoRetirada) return;
    setEnviando(true);
    setErro(null);

    const motivoTexto = observacoes.trim() || ROTULOS_MOTIVO_TROCA_PECA[motivo];

    const emitirNovaEtiqueta = async (pecaId: string): Promise<boolean> => {
      const resEtq = await fetch(`/api/operacao/pesagem/pecas/${pecaId}/etiqueta`, { method: 'POST' });
      if (resEtq.ok) return true;
      const body = (await resEtq.json().catch(() => ({}))) as { message?: string };
      setErro(body.message ?? 'A troca foi concluída, mas não foi possível gerar a nova etiqueta');
      return false;
    };

    if (necessitaSubstituicao) {
      const res = await fetch(`/api/operacao/pesagem/pecas/${pecaRetirada.id}/redirecionar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pedidoVendaItemId: itemDestinoId(pedidoDestino!),
          motivo: motivoTexto,
        }),
      });
      if (!res.ok) {
        setEnviando(false);
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setErro(body.message ?? 'Não foi possível vincular a peça ao pedido de destino');
        return;
      }
      const etiquetaOk = await emitirNovaEtiqueta(pecaRetirada.id);
      await onTrocaConcluida?.();
      setEnviando(false);
      setMensagemSucesso(
        etiquetaOk
          ? 'Peça vinculada ao pedido de destino. Nova etiqueta gerada.'
          : 'Peça vinculada ao pedido de destino',
      );
      return;
    }

    const res = await fetch(`/api/operacao/pesagem/pecas/${pecaRetirada.id}/destinar-retirada`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        destino: destinoRetirada,
        motivo: motivoTexto,
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
      }),
    });
    if (!res.ok) {
      setEnviando(false);
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setErro(body.message ?? 'Não foi possível destinar a peça');
      return;
    }
    const etiquetaOk = await emitirNovaEtiqueta(pecaRetirada.id);
    await onTrocaConcluida?.();
    setEnviando(false);
    const destinoTexto = destinoRetirada === 'desossa' ? 'Peça destinada à desossa' : 'Peça destinada ao estoque';
    setMensagemSucesso(etiquetaOk ? `${destinoTexto}. Nova etiqueta gerada.` : destinoTexto);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 overflow-hidden bg-card p-0',
          mensagemSucesso
            ? 'h-[min(90vw,28rem)] w-[min(90vw,28rem)] max-h-[90vh] max-w-[28rem] sm:max-w-[28rem]'
            : 'max-h-[90vh] w-[50vw] max-w-[50vw] sm:max-w-[50vw]',
        )}
      >
        <DialogHeader className="w-full shrink-0 border-b border-border bg-card px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold text-text-strong">
            <ArrowLeftRight size={16} className="text-sidebar-gradient-start" aria-hidden="true" />
            Trocar Peça
          </DialogTitle>
        </DialogHeader>

        {mensagemSucesso ? (
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center space-y-5 overflow-y-auto p-8 text-center">
            <div className="flex flex-col items-center gap-3 text-emerald-700">
              <CheckCircle2 className="h-10 w-10" />
              <span className="text-[15px] font-semibold">{mensagemSucesso}</span>
            </div>
            <Button type="button" className="w-full max-w-xs" onClick={onFechar}>Concluir</Button>
          </div>
        ) : (
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
            {erro && (
              <p role="alert" className="shrink-0 px-5 pt-4 text-[12px] text-destructive">{erro}</p>
            )}
            <div className="w-full shrink-0 px-5 pt-4">
              <Tabs value={tipoOrigem || tiposDisponiveis[0]?.codigo} onValueChange={selecionarTipo}>
                <TabsList aria-label="Tipo da peça">
                  {tiposDisponiveis.map((tipo) => (
                    <TabsTrigger key={tipo.codigo} value={tipo.codigo}>
                      {tipo.label}
                      <BadgeCount>
                        {pedidosAgrupados.filter((p) => tipoDoPedido(p) === tipo.codigo && vinculosCompletos(p)).length}
                      </BadgeCount>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-2">
              <section className="flex min-h-0 min-w-0 w-full flex-col space-y-3 rounded-lg border border-border p-3">
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                  Pedido de origem
                </h3>
                <FormField label="Buscar cliente" htmlFor="troca-cliente-origem">
                  <Input
                    id="troca-cliente-origem"
                    placeholder="Nome do cliente"
                    value={buscaOrigem}
                    onChange={(e) => setBuscaOrigem(e.target.value)}
                    disabled={!tipoOrigem}
                  />
                </FormField>
                <div className="flex min-h-0 flex-1 flex-col gap-0">
                  <PedidosOrigemList
                    pedidos={pedidosOrigemFiltrados}
                    pedidoSel={pedidoSel}
                    onSelect={(p) => {
                      setPedidoSel(p);
                      setPecaRetirada(null);
                    }}
                  />
                  <PecasVinculadasOrigem
                    pedidoSel={pedidoSel}
                    pecas={pecasOrigem}
                    pecaRetirada={pecaRetirada}
                    onSelect={setPecaRetirada}
                  />
                </div>
              </section>

              <section className="flex min-h-0 min-w-0 w-full flex-col space-y-3 rounded-lg border border-border p-3">
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                  Destino da troca
                </h3>
                <label className="flex items-center gap-2 text-[13px]">
                  <Checkbox
                    checked={necessitaSubstituicao}
                    onCheckedChange={(v) => {
                      setNecessitaSubstituicao(v === true);
                      if (v !== true) setPedidoDestino(null);
                    }}
                    aria-label="Necessita substituição"
                  />
                  Necessita substituição (troca um para um)
                </label>
                {necessitaSubstituicao ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <FormField label="Buscar cliente" htmlFor="troca-cliente-destino">
                      <Input
                        id="troca-cliente-destino"
                        placeholder="Nome do cliente"
                        value={buscaDestino}
                        onChange={(e) => setBuscaDestino(e.target.value)}
                        disabled={!tipoOrigem}
                      />
                    </FormField>
                    <PedidosDestinoList
                      pedidos={pedidosDestinoFiltrados}
                      pedidoSel={pedidoDestino}
                      onSelect={setPedidoDestino}
                    />
                    {pecaRetirada && (
                      <p className="text-[12px] text-muted-foreground">
                        A peça selecionada na origem será vinculada ao pedido de destino.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground">
                    A peça selecionada na origem sairá do pedido e passará a contar no destino escolhido (estoque ou desossa).
                  </p>
                )}
              </section>
            </div>

            <div className={cn(
              'grid w-full shrink-0 gap-3 border-t border-border px-5 py-3',
              !necessitaSubstituicao ? 'sm:grid-cols-2' : 'sm:grid-cols-1',
            )}
            >
              {!necessitaSubstituicao && (
                <FormField label="Destino da peça retirada" htmlFor="troca-destino">
                  <SelectNative
                    id="troca-destino"
                    aria-label="Destino da peça retirada"
                    value={destinoRetirada}
                    onChange={(e) => setDestinoRetirada(e.target.value as DestinoRetirada)}
                  >
                    <option value="estoque">Estoque</option>
                    <option value="desossa">Desossa</option>
                  </SelectNative>
                </FormField>
              )}
              <FormField label="Motivo da troca" htmlFor="motivo-troca" required>
                <SelectNative
                  id="motivo-troca"
                  aria-label="Motivo da troca"
                  required
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as MotivoTrocaPeca)}
                >
                  <option value="">Selecione…</option>
                  {(Object.entries(ROTULOS_MOTIVO_TROCA_PECA) as [MotivoTrocaPeca, string][]).map(
                    ([slug, rotulo]) => (
                      <option key={slug} value={slug}>{rotulo}</option>
                    ),
                  )}
                </SelectNative>
              </FormField>
              {motivo === 'outro' && (
                <Input
                  className={!necessitaSubstituicao ? 'sm:col-span-2' : undefined}
                  placeholder="Observações"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              )}
            </div>

            <div className="flex w-full shrink-0 gap-2 px-5 pb-5">
              <Button type="button" variant="ghost" className="flex-1" onClick={onFechar} disabled={enviando}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => void confirmar()}
                disabled={!podeConfirmar || enviando}
              >
                Confirmar Troca e gerar nova etiqueta
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
