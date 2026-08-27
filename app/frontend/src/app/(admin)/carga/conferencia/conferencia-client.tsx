'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, Clock, Lock, PackageCheck, ScanLine, Search, Truck, User, XCircle,
} from 'lucide-react';
import type { Caminhao, RomaneioItem, Romaneio } from '@/lib/operacao';
import { ROTULO_STATUS_CARGA, variantStatusCarga } from '@/lib/expedicao-ui';
import { mensagemDeErro } from '@/lib/error-message';
import { conectarRealtime } from '@/lib/realtime';
import { cn } from '@/lib/cn';
import { PipelineBar } from '@/components/ui/pipeline-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { KpiStrip, Kpi } from '@/components/ui/kpi-strip';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Table, TableBody, TableCell, TableCellCode, TableCellNum, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { ModalDivergencia } from './modal-divergencia';
import { ModalLeituraManual } from './modal-leitura-manual';

const EVENTOS_REFETCH = new Set([
  'carga_item_adicionado',
  'carga_item_transferido',
  'carga_item_removido',
  'carga_item_divergente',
  'conferencia_concluida',
  'expedicao_fechada',
  'expedicao_reaberta',
]);

function fmtKg(peso: string | number | null): string {
  return peso == null ? '—' : `${Number(peso).toFixed(3).replace('.', ',')} kg`;
}

function rotuloStatusItem(status: RomaneioItem['statusCargaItem']): string {
  switch (status) {
    case 'conferido': return 'Conferida';
    case 'divergente': return 'Divergente';
    case 'removido': return 'Removida';
    default: return 'Pendente';
  }
}

export function ConferenciaExpedicaoClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);
  const router = useRouter();
  const [dataOperacao] = useState(() => new Date().toISOString().slice(0, 10));
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [contadores, setContadores] = useState<Map<string, { conferidas: number; total: number }>>(new Map());
  const [romaneio, setRomaneioState] = useState<Romaneio | null>(null);
  const [cargaAtivaId, setCargaAtivaId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [bipInput, setBipInput] = useState('');
  const [bipMensagem, setBipMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [expandidos, setExpandidos] = useState<string[]>([]);
  const [modalDivergenciaItem, setModalDivergenciaItem] = useState<RomaneioItem | null>(null);
  const [modalLeituraManualCodigo, setModalLeituraManualCodigo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const carregarLista = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes?dataOperacao=${encodeURIComponent(dataOperacao)}`);
      if (!res.ok) {
        setErro('Falha ao carregar cargas');
        return;
      }
      const lista = (await res.json()) as Caminhao[];
      setCaminhoes(lista);
      setCargaAtivaId((atual) => atual ?? (lista.length > 0 ? lista[0]!.id : null));

      const pares = await Promise.all(
        lista.map(async (c) => {
          const r = await fetch(`/api/operacao/expedicao/caminhoes/${c.id}/romaneio`);
          if (!r.ok) return [c.id, { conferidas: 0, total: 0 }] as const;
          const dados = (await r.json()) as Romaneio;
          const itens = dados.pedidos.flatMap((p) => p.itens);
          return [c.id, {
            conferidas: itens.filter((i) => i.statusCargaItem === 'conferido').length,
            total: itens.length,
          }] as const;
        }),
      );
      setContadores(new Map(pares));
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [dataOperacao]);

  const carregarRomaneio = useCallback(async (id: string) => {
    setErro(null);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes/${id}/romaneio`);
      if (!res.ok) {
        setErro('Falha ao carregar detalhe da carga');
        return;
      }
      const dados = (await res.json()) as Romaneio;
      setRomaneioState(dados);
      setExpandidos(dados.pedidos.map((p) => p.pedidoVendaId));
    } catch {
      setErro('Erro de conexão');
    }
  }, []);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    if (cargaAtivaId) void carregarRomaneio(cargaAtivaId);
  }, [cargaAtivaId, carregarRomaneio]);

  useEffect(() => {
    const off = conectarRealtime({
      rooms: ['dashboard'],
      onMessage: (msg) => {
        if (EVENTOS_REFETCH.has(msg.type)) {
          void carregarLista();
          if (cargaAtivaId) void carregarRomaneio(cargaAtivaId);
        }
      },
      onReconnect: () => {
        void carregarLista();
        if (cargaAtivaId) void carregarRomaneio(cargaAtivaId);
      },
    });
    return off;
  }, [carregarLista, carregarRomaneio, cargaAtivaId]);

  const cargasFiltradas = useMemo(() => {
    if (!busca) return caminhoes;
    const q = busca.toLowerCase();
    return caminhoes.filter(
      (c) => c.placa.toLowerCase().includes(q) || c.motorista.toLowerCase().includes(q),
    );
  }, [caminhoes, busca]);

  const todosItens = useMemo(
    () => romaneio?.pedidos.flatMap((p) => p.itens) ?? [],
    [romaneio],
  );

  const stats = useMemo(() => {
    const conferidas = todosItens.filter((i) => i.statusCargaItem === 'conferido').length;
    const divergentes = todosItens.filter((i) => i.statusCargaItem === 'divergente').length;
    const pendentes = todosItens.filter((i) => i.statusCargaItem === 'em_carga').length;
    const pesoConferido = todosItens
      .filter((i) => i.statusCargaItem === 'conferido' && i.peso != null)
      .reduce((acc, i) => acc + Number(i.peso), 0);
    const pesoTotal = todosItens
      .filter((i) => i.peso != null)
      .reduce((acc, i) => acc + Number(i.peso), 0);
    return { total: todosItens.length, conferidas, divergentes, pendentes, pesoConferido, pesoTotal };
  }, [todosItens]);

  // Mantém o contador do card ativo na lista-master em sincronia com o detail (bipagem/divergência/finalização).
  useEffect(() => {
    if (!cargaAtivaId || !romaneio) return;
    setContadores((prev) => {
      const next = new Map(prev);
      next.set(cargaAtivaId, { conferidas: stats.conferidas, total: stats.total });
      return next;
    });
  }, [cargaAtivaId, romaneio, stats.conferidas, stats.total]);

  const cam = romaneio?.caminhao;
  const rotuloStatus = cam ? ROTULO_STATUS_CARGA[cam.statusCaminhao] : '';
  const cargaConferida = rotuloStatus === 'Conferida' || rotuloStatus === 'Enviada para Faturamento' || rotuloStatus === 'Faturada';
  const podeFinalizar = stats.pendentes === 0 && !cargaConferida;

  const cargasAtivas = caminhoes.filter(
    (c) => c.statusCaminhao === 'em_carga' || c.statusCaminhao === 'em_conferencia',
  ).length;

  async function bipar() {
    if (!cam) return;
    setBipMensagem(null);
    const codigo = bipInput.trim();
    setSubmitting(true);
    try {
      if (codigo === '') {
        const res = await fetch(`/api/operacao/expedicao/caminhoes/${cam.id}/conferencia/registrar-item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipoOrigem: 'peca', modoCaptura: 'automatico' }),
        });
        if (!res.ok) {
          setBipMensagem({ tipo: 'erro', texto: await mensagemDeErro(res, 'Falha na bipagem automática') });
          return;
        }
        setBipMensagem({ tipo: 'ok', texto: 'Peça conferida.' });
        await carregarRomaneio(cam.id);
        return;
      }

      // Conferência manual assistida: exige motivo (LEITURA_MANUAL) — modal do DS.
      setModalLeituraManualCodigo(codigo);
    } catch {
      setBipMensagem({ tipo: 'erro', texto: 'Erro de conexão' });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmarLeituraManual(motivo: string) {
    if (!cam || !modalLeituraManualCodigo) return;
    const codigo = modalLeituraManualCodigo;
    setSubmitting(true);
    try {
      let ultimoErro: string | null = null;
      for (const tipoOrigem of ['peca', 'subitem'] as const) {
        const res = await fetch(`/api/operacao/expedicao/caminhoes/${cam.id}/conferencia/registrar-item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipoOrigem, modoCaptura: 'manual_assistido', codigo, motivo }),
        });
        if (res.ok) {
          setBipMensagem({ tipo: 'ok', texto: `${codigo} conferida.` });
          setModalLeituraManualCodigo(null);
          setBipInput('');
          await carregarRomaneio(cam.id);
          return;
        }
        ultimoErro = await mensagemDeErro(res, 'Falha na conferência manual');
      }
      setModalLeituraManualCodigo(null);
      setBipInput('');
      setBipMensagem({ tipo: 'erro', texto: ultimoErro ?? 'Etiqueta não encontrada nesta carga.' });
    } catch {
      setBipMensagem({ tipo: 'erro', texto: 'Erro de conexão' });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmarDivergencia(motivo: string, observacao: string) {
    if (!cam || !modalDivergenciaItem) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes/${cam.id}/conferencia/divergencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cargaItemId: modalDivergenciaItem.cargaItemId, motivo, observacao: observacao || undefined }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, 'Falha ao registrar divergência'));
        return;
      }
      setModalDivergenciaItem(null);
      await carregarRomaneio(cam.id);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  async function finalizarConferencia() {
    if (!cam) return;
    setErro(null);
    setSubmitting(true);
    try {
      const resConcluir = await fetch(`/api/operacao/expedicao/caminhoes/${cam.id}/conferencia/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!resConcluir.ok) {
        setErro(await mensagemDeErro(resConcluir, 'Falha ao concluir conferência'));
        return;
      }
      const resFechar = await fetch(`/api/operacao/expedicao/caminhoes/${cam.id}/fechar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!resFechar.ok) {
        setErro(await mensagemDeErro(resFechar, 'Conferência concluída, mas o fechamento falhou'));
        return;
      }
      await carregarLista();
      await carregarRomaneio(cam.id);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="px-3 py-2">
          <PipelineBar
            etapaAtual="Carga"
            contadores={{ carga: `${cargasAtivas} Carga${cargasAtivas !== 1 ? 's' : ''} em Conferência` }}
          />
        </CardContent>
      </Card>

      <PageHeader title="Conferência de Carga" subtitle="Bipagem de peças etiquetadas antes do envio ao faturamento" />

      {erro && (
        <div role="alert" className="rounded-md border border-danger-soft-border bg-danger-soft p-3 text-xs text-danger-fg">
          {erro}
        </div>
      )}

      <div className="grid items-start gap-2.5 lg:grid-cols-[320px_1fr]">
        {/* Master: lista de cargas */}
        <Card>
          <CardContent className="flex gap-1.5 p-2.5 pb-1.5">
            <Input adornLeft={<Search />} placeholder="Buscar por placa, cliente ou carga..." className="h-7 text-xs" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </CardContent>
          <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
            {loading && <p className="p-3 text-xs text-muted-foreground">Carregando…</p>}
            {!loading &&
              cargasFiltradas.map((c) => {
                const selecionado = c.id === cargaAtivaId;
                const cont = contadores.get(c.id) ?? { conferidas: 0, total: 0 };
                const pct = cont.total === 0 ? 0 : Math.round((cont.conferidas / cont.total) * 100);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCargaAtivaId(c.id)}
                    className={cn(
                      'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2',
                      selecionado && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">Carga #{c.id.slice(0, 8)}</b>
                      <StatusPill variant={variantStatusCarga(c.statusCaminhao)} className="h-[17px] text-[10px]" label={ROTULO_STATUS_CARGA[c.statusCaminhao]} />
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      <span className="font-data">{c.placa}</span> · {c.rota ?? '—'}
                    </span>
                    <span className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span />
                      <span>{cont.conferidas} / {cont.total} peças</span>
                    </span>
                    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <span
                        className={cn('block h-full rounded-full bg-primary', pct === 100 && 'bg-success')}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </button>
                );
              })}
          </div>
        </Card>

        {/* Detail */}
        <Card>
          {!cam ? (
            <CardContent className="p-8">
              <p className="text-sm text-muted-foreground">Selecione uma carga para ver os detalhes.</p>
            </CardContent>
          ) : (
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h2 className="text-[15px] font-bold text-foreground">Carga #{cam.id.slice(0, 8)}</h2>
                    <StatusPill variant={variantStatusCarga(cam.statusCaminhao)} label={rotuloStatus} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Truck className="size-3.5" /> Placa: <span className="font-data">{cam.placa}</span></span>
                    <span className="flex items-center gap-1"><User className="size-3.5" /> Motorista: {cam.motorista}</span>
                    <span className="flex items-center gap-1"><Clock className="size-3.5" /> {cam.rota ?? '—'}</span>
                  </div>
                </div>
              </div>

              <KpiStrip>
                <Kpi label="Total de Pedidos" value={romaneio?.pedidos.length ?? 0} />
                <Kpi label="Peças Conferidas" value={`${stats.conferidas} / ${stats.total}`} />
                <Kpi label="Divergências" value={stats.divergentes} tone={stats.divergentes > 0 ? 'alert' : 'default'} />
                <Kpi label="Peso Conferido" value={fmtKg(stats.pesoConferido)} hint={`/ ${fmtKg(stats.pesoTotal)}`} />
              </KpiStrip>

              {cargaConferida ? (
                <div className="flex items-start gap-2 rounded-md border border-success-soft-border bg-success-soft px-3 py-2">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-success-fg" />
                  <p className="flex-1 text-xs font-semibold text-success-fg">
                    Carga conferida. Estornos simples bloqueados — alterações exigem reabertura autorizada pela gestão.
                  </p>
                  {rotuloStatus === 'Conferida' && (
                    <Button size="sm" className="shrink-0" onClick={() => router.push('/carga/enviar-faturamento')}>
                      <PackageCheck />
                      Enviar para Faturamento
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1 font-data"
                      adornLeft={<ScanLine />}
                      value={bipInput}
                      onChange={(e) => setBipInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void bipar(); }}
                      placeholder="Bipar etiqueta (ETQ-XXXXX)..."
                      disabled={submitting}
                    />
                    <Button onClick={() => void bipar()} disabled={submitting}>
                      <ScanLine />
                      Bipar
                    </Button>
                  </div>
                  {bipMensagem && (
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs',
                        bipMensagem.tipo === 'ok' ? 'bg-success-soft text-success-fg' : 'bg-danger-soft text-danger-fg',
                      )}
                    >
                      {bipMensagem.tipo === 'ok' ? <CheckCircle2 className="size-3.5 shrink-0" /> : <XCircle className="size-3.5 shrink-0" />}
                      {bipMensagem.texto}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-foreground">Pedidos da Carga</h3>
                {!cargaConferida && pode('EXPEDICAO_GERENCIAR') && (
                  <Button
                    size="sm"
                    disabled={!podeFinalizar || submitting}
                    onClick={() => void finalizarConferencia()}
                  >
                    <CheckCircle2 />
                    Finalizar Conferência
                  </Button>
                )}
              </div>

              <Accordion type="multiple" value={expandidos} onValueChange={setExpandidos}>
                {romaneio?.pedidos.map((pedido) => {
                  const conferidas = pedido.itens.filter((i) => i.statusCargaItem === 'conferido').length;
                  const divergentes = pedido.itens.filter((i) => i.statusCargaItem === 'divergente').length;
                  const total = pedido.itens.length;

                  return (
                    <AccordionItem key={pedido.pedidoVendaId} value={pedido.pedidoVendaId}>
                      <AccordionTrigger className="py-2.5 text-xs hover:no-underline">
                        <span className="flex flex-1 items-center justify-between gap-3">
                          <span className="text-[13px] font-semibold text-foreground">
                            Pedido {pedido.pedidoVendaId.slice(0, 8)}…
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="text-xs font-medium text-foreground">{conferidas} / {total} peças</span>
                            {divergentes > 0 && (
                              <span className="text-[11px] text-destructive">
                                {divergentes} divergente{divergentes !== 1 ? 's' : ''}
                              </span>
                            )}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-2">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Etiqueta</TableHead>
                              <TableHead>Produto</TableHead>
                              <TableHead className="text-right">Peso</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pedido.itens.map((item) => (
                              <TableRow key={item.cargaItemId} className="group">
                                <TableCellCode>{item.etiqueta ?? '—'}</TableCellCode>
                                <TableCell>
                                  <p className="text-[13px] font-semibold text-foreground">{item.produtoNome}</p>
                                  {item.statusCargaItem === 'divergente' && item.divergenciaMotivo && (
                                    <p className="text-[11px] text-destructive">{item.divergenciaMotivo}</p>
                                  )}
                                </TableCell>
                                <TableCellNum>{fmtKg(item.peso)}</TableCellNum>
                                <TableCell>
                                  <StatusPill
                                    variant={
                                      item.statusCargaItem === 'conferido'
                                        ? 'expedido'
                                        : item.statusCargaItem === 'divergente'
                                          ? 'divergencia'
                                          : 'pendente'
                                    }
                                    label={rotuloStatusItem(item.statusCargaItem)}
                                  />
                                </TableCell>
                                <TableCell>
                                  {item.statusCargaItem === 'em_carga' && !cargaConferida && pode('EXPEDICAO_GERENCIAR') ? (
                                    <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                                      <Button
                                        variant="destructiveOutline"
                                        size="sm"
                                        onClick={() => setModalDivergenciaItem(item)}
                                      >
                                        Marcar divergência
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="block text-right text-[11px] text-fg-faint">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          )}
        </Card>
      </div>

      <ModalDivergencia
        item={modalDivergenciaItem}
        onClose={() => setModalDivergenciaItem(null)}
        onConfirmar={(motivo, obs) => void confirmarDivergencia(motivo, obs)}
        pending={submitting}
      />

      <ModalLeituraManual
        open={!!modalLeituraManualCodigo}
        codigo={modalLeituraManualCodigo ?? ''}
        onClose={() => setModalLeituraManualCodigo(null)}
        onConfirmar={(motivo) => void confirmarLeituraManual(motivo)}
        pending={submitting}
      />
    </div>
  );
}
