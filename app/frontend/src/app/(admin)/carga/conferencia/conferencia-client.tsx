'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, ChevronDown, ChevronRight, Clock, Lock, PackageCheck, ScanLine, Search, Truck, User, XCircle,
} from 'lucide-react';
import type { Caminhao, RomaneioItem, Romaneio } from '@/lib/operacao';
import { ROTULO_STATUS_CARGA } from '@/lib/expedicao-ui';
import { conectarRealtime } from '@/lib/realtime';
import { PipelineBar } from '@/components/ui/pipeline-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
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
      setExpandidos(new Set(dados.pedidos.map((p) => p.pedidoVendaId)));
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
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBipMensagem({ tipo: 'erro', texto: (data as { message?: string }).message ?? 'Falha na bipagem automática' });
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
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setBipMensagem({ tipo: 'ok', texto: `${codigo} conferida.` });
          setModalLeituraManualCodigo(null);
          setBipInput('');
          await carregarRomaneio(cam.id);
          return;
        }
        ultimoErro = (data as { message?: string }).message ?? 'Falha na conferência manual';
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Falha ao registrar divergência');
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
      const dataConcluir = await resConcluir.json().catch(() => ({}));
      if (!resConcluir.ok) {
        setErro((dataConcluir as { message?: string }).message ?? 'Falha ao concluir conferência');
        return;
      }
      const resFechar = await fetch(`/api/operacao/expedicao/caminhoes/${cam.id}/fechar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const dataFechar = await resFechar.json().catch(() => ({}));
      if (!resFechar.ok) {
        setErro((dataFechar as { message?: string }).message ?? 'Conferência concluída, mas o fechamento falhou');
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

  function toggleExpandido(pedidoVendaId: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(pedidoVendaId)) next.delete(pedidoVendaId);
      else next.add(pedidoVendaId);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <PipelineBar
        etapaAtual="Carga"
        contadores={{ carga: `${cargasAtivas} Carga${cargasAtivas !== 1 ? 's' : ''} em Conferência` }}
      />

      <div>
        <h1 className="text-xl font-bold text-foreground">Conferência de Carga</h1>
        <p className="text-sm text-muted-foreground">
          Bipagem de peças etiquetadas antes do envio ao faturamento
        </p>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Master: lista de cargas */}
        <div className="flex flex-col overflow-hidden rounded-xl border bg-card lg:col-span-4">
          <div className="border-b p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por placa, cliente ou carga..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-2">
            {loading && <p className="p-2 text-sm text-muted-foreground">Carregando…</p>}
            {!loading &&
              cargasFiltradas.map((c) => {
                const selecionada = c.id === cargaAtivaId;
                const cont = contadores.get(c.id) ?? { conferidas: 0, total: 0 };
                const pct = cont.total === 0 ? 0 : Math.round((cont.conferidas / cont.total) * 100);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCargaAtivaId(c.id)}
                    className={`relative w-full rounded-md border p-3 text-left transition-colors ${
                      selecionada ? 'border-primary/40 bg-primary/5' : 'hover:border-primary/30'
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <span className="text-sm font-bold text-foreground">Carga #{c.id.slice(0, 8)}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {ROTULO_STATUS_CARGA[c.statusCaminhao]}
                      </span>
                    </div>
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Truck className="h-3 w-3" />
                      {c.placa} · {c.rota ?? '—'}
                    </div>
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span />
                      <span>{cont.conferidas} / {cont.total} peças</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Detail */}
        <div className="flex flex-col overflow-hidden rounded-xl border bg-card lg:col-span-8">
          {!cam ? (
            <p className="p-8 text-sm text-muted-foreground">Selecione uma carga para ver os detalhes.</p>
          ) : (
            <>
              <div className="border-b p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-3">
                      <h2 className="text-lg font-bold text-foreground">Carga #{cam.id.slice(0, 8)}</h2>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {rotuloStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Truck className="h-4 w-4" /> Placa: {cam.placa}</span>
                      <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> Motorista: {cam.motorista}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {cam.rota ?? '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 rounded-lg border bg-muted/30 p-4">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Total de Pedidos</p>
                    <p className="text-lg font-bold text-foreground">{romaneio?.pedidos.length ?? 0}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Peças Conferidas</p>
                    <p className="text-lg font-bold text-primary">{stats.conferidas} / {stats.total}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Divergências</p>
                    <p className={`text-lg font-bold ${stats.divergentes > 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {stats.divergentes}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Peso Conferido</p>
                    <p className="text-lg font-bold text-foreground">
                      {fmtKg(stats.pesoConferido)}{' '}
                      <span className="text-xs text-muted-foreground">/ {fmtKg(stats.pesoTotal)}</span>
                    </p>
                  </div>
                </div>
              </div>

              {cargaConferida ? (
                <div className="mx-6 mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <p className="flex-1 text-sm font-bold text-emerald-900">
                    Carga conferida. Estornos simples bloqueados — alterações exigem reabertura autorizada pela gestão.
                  </p>
                  {rotuloStatus === 'Conferida' && (
                    <Button
                      size="sm"
                      className="shrink-0 bg-emerald-700 hover:bg-emerald-800"
                      onClick={() => router.push('/carga/enviar-faturamento')}
                    >
                      <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
                      Enviar para Faturamento
                    </Button>
                  )}
                </div>
              ) : (
                <div className="mx-6 mt-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9 font-mono"
                        value={bipInput}
                        onChange={(e) => setBipInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void bipar(); }}
                        placeholder="Bipar etiqueta (ETQ-XXXXX) ou deixe em branco para bipar a próxima pendente..."
                        disabled={submitting}
                      />
                    </div>
                    <Button onClick={() => void bipar()} disabled={submitting}>
                      <ScanLine className="mr-1.5 h-4 w-4" />
                      Bipar
                    </Button>
                  </div>
                  {bipMensagem && (
                    <div
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ${
                        bipMensagem.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {bipMensagem.tipo === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                      {bipMensagem.texto}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Pedidos da Carga</h3>
                  {!cargaConferida && pode('EXPEDICAO_GERENCIAR') && (
                    <Button
                      size="sm"
                      className="bg-emerald-700 hover:bg-emerald-800"
                      disabled={!podeFinalizar || submitting}
                      onClick={() => void finalizarConferencia()}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Finalizar Conferência
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  {romaneio?.pedidos.map((pedido) => {
                    const expandido = expandidos.has(pedido.pedidoVendaId);
                    const conferidas = pedido.itens.filter((i) => i.statusCargaItem === 'conferido').length;
                    const divergentes = pedido.itens.filter((i) => i.statusCargaItem === 'divergente').length;
                    const total = pedido.itens.length;
                    const completo = conferidas + divergentes === total;

                    return (
                      <div key={pedido.pedidoVendaId} className="overflow-hidden rounded-lg border">
                        <button
                          type="button"
                          onClick={() => toggleExpandido(pedido.pedidoVendaId)}
                          className="flex w-full items-center justify-between bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`rounded border p-2 shadow-sm ${completo ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-card'}`}>
                              {completo ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                              ) : (
                                <PackageCheck className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-semibold text-foreground">
                                Pedido {pedido.pedidoVendaId.slice(0, 8)}…
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-sm font-medium text-foreground">{conferidas} / {total} peças</p>
                              {divergentes > 0 && (
                                <p className="text-xs text-destructive">
                                  {divergentes} divergente{divergentes !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                            {expandido ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                          </div>
                        </button>

                        {expandido && (
                          <div className="border-t bg-card p-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/30 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  <th className="px-3 py-2">Etiqueta</th>
                                  <th className="px-3 py-2">Produto</th>
                                  <th className="px-3 py-2 text-right">Peso</th>
                                  <th className="px-3 py-2 text-center">Status</th>
                                  <th className="px-3 py-2 text-right">Ação</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {pedido.itens.map((item) => (
                                  <tr key={item.cargaItemId}>
                                    <td className="px-3 py-2.5 font-mono text-xs font-bold text-primary">{item.etiqueta ?? '—'}</td>
                                    <td className="px-3 py-2.5">
                                      <p className="font-medium text-foreground">{item.produtoNome}</p>
                                      {item.statusCargaItem === 'divergente' && item.divergenciaMotivo && (
                                        <p className="mt-0.5 text-xs text-destructive">{item.divergenciaMotivo}</p>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmtKg(item.peso)}</td>
                                    <td className="px-3 py-2.5 text-center">
                                      <span
                                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                          item.statusCargaItem === 'conferido'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : item.statusCargaItem === 'divergente'
                                              ? 'bg-destructive/10 text-destructive'
                                              : 'bg-muted text-muted-foreground'
                                        }`}
                                      >
                                        {rotuloStatusItem(item.statusCargaItem)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                      {item.statusCargaItem === 'em_carga' && !cargaConferida && pode('EXPEDICAO_GERENCIAR') ? (
                                        <button
                                          type="button"
                                          onClick={() => setModalDivergenciaItem(item)}
                                          className="rounded border border-destructive/30 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                                        >
                                          Marcar divergência
                                        </button>
                                      ) : (
                                        <span className="text-xs text-muted-foreground/50">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
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
