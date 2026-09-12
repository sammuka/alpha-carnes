'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { cn } from '@/lib/cn';
import {
  ROTULOS_MOTIVO_TROCA_PECA,
  type DestinoRetirada,
  type ExecutarTrocaPayload,
  type MotivoTrocaPeca,
  type ResultadoTroca,
} from '@/lib/operacao';
import { rotuloDestinoPeca } from '@/lib/status-ui';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Input } from './input';
import { FormField } from './form-field';
import { SelectNative } from './select-native';
import type { PecaTrocaOpcao, PedidoTrocaOpcao, TrocaPecaFluxoProps } from './troca-peca-modal';

const TIPOS_PECA = ['TZ', 'DT', 'PA'] as const;

function codigoTipo(valor: string | undefined): string {
  return (valor ?? '').split(/[\s—-]/)[0]?.toUpperCase() ?? '';
}

export function TrocaPecaFluxo({
  open,
  onFechar,
  onTrocaConcluida,
  pedidos,
  pecasDisponiveis,
}: TrocaPecaFluxoProps) {
  const [buscaOrigem, setBuscaOrigem] = useState('');
  const [tipoOrigem, setTipoOrigem] = useState('');
  const [pecaRetirada, setPecaRetirada] = useState<PecaTrocaOpcao | null>(null);
  const [pedidoSel, setPedidoSel] = useState<PedidoTrocaOpcao | null>(null);

  const [buscaDestino, setBuscaDestino] = useState('');
  const [necessitaSubstituicao, setNecessitaSubstituicao] = useState(true);
  const [pecaInserida, setPecaInserida] = useState<PecaTrocaOpcao | null>(null);

  const [destinoRetirada, setDestinoRetirada] = useState<DestinoRetirada>('estoque');
  const [motivo, setMotivo] = useState<MotivoTrocaPeca | ''>('');
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoTroca | null>(null);
  const [resultadoSemSubstituicao, setResultadoSemSubstituicao] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBuscaOrigem('');
    setTipoOrigem('');
    setPecaRetirada(null);
    setPedidoSel(null);
    setBuscaDestino('');
    setNecessitaSubstituicao(true);
    setPecaInserida(null);
    setDestinoRetirada('estoque');
    setMotivo('');
    setObservacoes('');
    setEnviando(false);
    setErro(null);
    setResultado(null);
    setResultadoSemSubstituicao(false);
  }, [open]);

  const pedidosFiltrados = useMemo(() => {
    const q = buscaOrigem.trim().toLowerCase();
    return pedidos.filter((p) => {
      const tipo = (p.produtoCodigo ?? codigoTipo(p.produtoLabel)).toUpperCase();
      if (tipoOrigem && tipo !== tipoOrigem) return false;
      if (!q) return true;
      return (
        p.clienteNome.toLowerCase().includes(q)
        || p.produtoLabel.toLowerCase().includes(q)
        || tipo.toLowerCase().includes(q)
      );
    });
  }, [pedidos, buscaOrigem, tipoOrigem]);

  const pecasOrigem = useMemo(() => {
    if (!pedidoSel) return [];
    const tipoPedido = (pedidoSel.produtoCodigo ?? codigoTipo(pedidoSel.produtoLabel)).toUpperCase();
    return pedidoSel.pecasAssociadas.filter((peca) => {
      if (!tipoOrigem) return true;
      const tipoPeca = (peca.produtoCodigo ?? tipoPedido).toUpperCase();
      return tipoPeca === tipoOrigem;
    });
  }, [pedidoSel, tipoOrigem]);

  const pecasDestino = useMemo(() => {
    if (!necessitaSubstituicao) return [];
    const tipoAlvo = tipoOrigem || (pedidoSel?.produtoCodigo ?? codigoTipo(pedidoSel?.produtoLabel)).toUpperCase();
    const q = buscaDestino.trim().toLowerCase();
    return pecasDisponiveis.filter((peca) => {
      const tipoPeca = (peca.produtoCodigo ?? codigoTipo(peca.codigo)).toUpperCase();
      if (tipoAlvo && tipoPeca && tipoPeca !== tipoAlvo && !tipoPeca.startsWith(tipoAlvo)) {
        return peca.codigo.toLowerCase().includes(tipoAlvo.toLowerCase());
      }
      if (q && !peca.codigo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [necessitaSubstituicao, pecasDisponiveis, tipoOrigem, pedidoSel, buscaDestino]);

  const podeConfirmar =
    !!pedidoSel
    && !!pecaRetirada
    && !!destinoRetirada
    && !!motivo
    && (motivo !== 'outro' || observacoes.trim().length > 0)
    && (!necessitaSubstituicao || !!pecaInserida);

  const confirmar = async () => {
    if (!pecaRetirada || !pedidoSel || !destinoRetirada || !motivo) return;
    if (necessitaSubstituicao && !pecaInserida) return;
    setEnviando(true);
    setErro(null);

    if (!necessitaSubstituicao) {
      const resEstorno = await fetch(`/api/operacao/pesagem/pecas/${pecaRetirada.id}/estornar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          motivo: 'outro',
          observacoes: observacoes.trim() || ROTULOS_MOTIVO_TROCA_PECA[motivo],
        }),
      });
      if (!resEstorno.ok) {
        const body = (await resEstorno.json().catch(() => ({}))) as { message?: string };
        setEnviando(false);
        setErro(body.message ?? 'Não foi possível retirar a peça sem substituição');
        return;
      }
      if (destinoRetirada === 'desossa') {
        const resCorte = await fetch(`/api/operacao/pesagem/pecas/${pecaRetirada.id}/sem-cobertura`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ destino: 'corte' }),
        });
        if (!resCorte.ok) {
          const body = (await resCorte.json().catch(() => ({}))) as { message?: string };
          setEnviando(false);
          setErro(body.message ?? 'Peça retirada do pedido, mas falhou destinar à desossa');
          return;
        }
      }
      setEnviando(false);
      setResultadoSemSubstituicao(true);
      onTrocaConcluida?.();
      return;
    }

    const res = await fetch('/api/operacao/pesagem/trocas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pecaRetiradaId: pecaRetirada.id,
        pecaInseridaId: pecaInserida!.id,
        pedidoVendaItemId: pedidoSel.pedidoVendaItemId,
        destinoRetirada,
        motivo,
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
      } satisfies ExecutarTrocaPayload),
    });
    setEnviando(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setErro(body.message ?? 'Não foi possível concluir a troca');
      return;
    }
    setResultado((await res.json()) as ResultadoTroca);
    onTrocaConcluida?.();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl gap-0 overflow-y-auto bg-card p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold text-text-strong">
            <ArrowLeftRight size={16} className="text-sidebar-gradient-start" aria-hidden="true" />
            Trocar Peça
          </DialogTitle>
        </DialogHeader>

        {resultado || resultadoSemSubstituicao ? (
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-[13px] font-semibold">
                {resultadoSemSubstituicao ? 'Peça retirada do pedido' : 'Troca concluída'}
              </span>
            </div>
            {resultado && (
              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Etiqueta invalidada</dt>
                  <dd className="font-mono">
                    {resultado.etiquetaInvalidada
                      ? (resultado.pecaRetirada.etiquetaAtual ?? '—')
                      : 'nenhuma'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Nova etiqueta</dt>
                  <dd className="font-mono">{resultado.pecaInserida.etiquetaAtual ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Peça retirada</dt>
                  <dd>{rotuloDestinoPeca(resultado.pecaRetirada.statusPeca)}</dd>
                </div>
              </dl>
            )}
            <Button type="button" className="w-full" onClick={onFechar}>Concluir</Button>
          </div>
        ) : (
          <>
            {erro && (
              <p role="alert" className="px-5 pt-4 text-[12px] text-destructive">{erro}</p>
            )}
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <section className="space-y-3 rounded-lg border border-border p-3">
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                  Pedido de origem
                </h3>
                <FormField label="Buscar cliente" htmlFor="troca-cliente-origem">
                  <Input
                    id="troca-cliente-origem"
                    placeholder="Nome do cliente"
                    value={buscaOrigem}
                    onChange={(e) => setBuscaOrigem(e.target.value)}
                  />
                </FormField>
                <FormField label="Tipo da peça" htmlFor="troca-tipo-origem">
                  <SelectNative
                    id="troca-tipo-origem"
                    aria-label="Tipo da peça"
                    value={tipoOrigem}
                    onChange={(e) => {
                      setTipoOrigem(e.target.value);
                      setPecaRetirada(null);
                    }}
                  >
                    <option value="">Todos</option>
                    {TIPOS_PECA.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </SelectNative>
                </FormField>
                <div className="space-y-2">
                  <p className="text-[12px] text-muted-foreground">Selecione o pedido e a peça a retirar.</p>
                  {pedidosFiltrados.map((p) => (
                    <button
                      key={p.pedidoVendaItemId}
                      type="button"
                      onClick={() => {
                        setPedidoSel(p);
                        setPecaRetirada(null);
                      }}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left text-[13px]',
                        pedidoSel?.pedidoVendaItemId === p.pedidoVendaItemId
                          ? 'border-action-blue bg-blue-50'
                          : 'border-border',
                      )}
                    >
                      <p className="font-semibold">{p.clienteNome}</p>
                      <p className="text-muted-foreground">{p.produtoLabel}</p>
                    </button>
                  ))}
                </div>
                {pedidoSel && (
                  <div className="space-y-2">
                    {pecasOrigem.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPecaRetirada(p)}
                        className={cn(
                          'w-full rounded-lg border p-3 text-left font-mono text-[13px]',
                          pecaRetirada?.id === p.id ? 'border-action-blue bg-blue-50' : 'border-border',
                        )}
                      >
                        {p.codigo} · {p.peso} kg
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-lg border border-border p-3">
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                  Destino da troca
                </h3>
                <FormField label="Buscar cliente" htmlFor="troca-cliente-destino">
                  <Input
                    id="troca-cliente-destino"
                    placeholder="Cliente da peça de entrada"
                    value={buscaDestino}
                    onChange={(e) => setBuscaDestino(e.target.value)}
                  />
                </FormField>
                <label className="flex items-center gap-2 text-[13px]">
                  <Checkbox
                    checked={necessitaSubstituicao}
                    onCheckedChange={(v) => {
                      setNecessitaSubstituicao(v === true);
                      if (v !== true) setPecaInserida(null);
                    }}
                    aria-label="Necessita substituição"
                  />
                  Necessita substituição (troca um para um)
                </label>
                {necessitaSubstituicao && (
                  <div className="space-y-2">
                    <p className="text-[12px] text-muted-foreground">Selecione a peça que entra no pedido.</p>
                    {pecasDestino.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPecaInserida(p)}
                        className={cn(
                          'w-full rounded-lg border p-3 text-left font-mono text-[13px]',
                          pecaInserida?.id === p.id ? 'border-action-blue bg-blue-50' : 'border-border',
                        )}
                      >
                        {p.codigo} · {p.peso} kg
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="grid gap-3 border-t border-border px-5 py-3 sm:grid-cols-2">
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
              <FormField label="Motivo da troca" htmlFor="motivo-troca">
                <SelectNative
                  id="motivo-troca"
                  aria-label="Motivo da troca"
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
                  className="sm:col-span-2"
                  placeholder="Observações"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              )}
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <Button type="button" variant="ghost" className="flex-1" onClick={onFechar} disabled={enviando}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => void confirmar()}
                disabled={!podeConfirmar || enviando}
              >
                Confirmar troca
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
