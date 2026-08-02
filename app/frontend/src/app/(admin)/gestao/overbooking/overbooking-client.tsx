'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ban, CheckCircle2, Clock, Info, RefreshCw, Search, X } from 'lucide-react';
import { SeletorOperacao } from '@/components/gestao/seletor-operacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { conectarRealtime } from '@/lib/realtime';
import {
  buscarCobertura,
  buscarHistorico,
  listarPendencias,
  ROTULO_STATUS_PENDENCIA,
  type CoberturaPendencia,
  type HistoricoPendencia,
  type Pendencia,
} from '@/lib/overbooking';
import type { StatusPendenciaOverbooking } from '@/lib/comercial';
import { mensagemDeErro } from '@/lib/error-message';

const MOTIVOS_CANCELAMENTO = [
  'Cliente desistiu do pedido',
  'Pedido duplicado',
  'Erro de lançamento',
  'Outro',
];

function formatDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function OverbookingConteudo({ permissoes }: { permissoes: string[] }) {
  const searchParams = useSearchParams();
  const operacaoId = searchParams.get('operacaoId');
  const podeResolver = permissoes.includes('OVERBOOKING_RESOLVER');

  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [selecionada, setSelecionada] = useState<Pendencia | null>(null);
  const [cobertura, setCobertura] = useState<CoberturaPendencia | null>(null);
  const [historico, setHistorico] = useState<HistoricoPendencia[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<StatusPendenciaOverbooking | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [modalCancelar, setModalCancelar] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [obsCancelamento, setObsCancelamento] = useState('');
  const [modalPostergar, setModalPostergar] = useState(false);
  const [qtdPostergar, setQtdPostergar] = useState('');

  const carregar = useCallback(async () => {
    if (!operacaoId) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await listarPendencias({
        operacaoId,
        status: filtroStatus === 'todos' ? undefined : filtroStatus,
      });
      setPendencias(res.data);
      if (selecionada && !res.data.some((p) => p.id === selecionada.id)) {
        setSelecionada(res.data[0] ?? null);
      } else if (!selecionada && res.data[0]) {
        setSelecionada(res.data[0]);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar pendências');
    } finally {
      setCarregando(false);
    }
  }, [operacaoId, filtroStatus, selecionada]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!operacaoId) return;
    return conectarRealtime({
      rooms: [`operacao:${operacaoId}`],
      onMessage: (msg) => {
        if (msg.type.startsWith('pendencia_overbooking')) void carregar();
      },
    });
  }, [operacaoId, carregar]);

  useEffect(() => {
    if (!selecionada) {
      setCobertura(null);
      setHistorico([]);
      return;
    }
    void Promise.all([buscarCobertura(selecionada.id), buscarHistorico(selecionada.id)])
      .then(([c, h]) => {
        setCobertura(c);
        setHistorico(h);
      })
      .catch((e: Error) => setErro(e.message));
  }, [selecionada]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return pendencias;
    return pendencias.filter(
      (p) => p.id.toLowerCase().includes(q) || p.pedidoVendaId.toLowerCase().includes(q),
    );
  }, [pendencias, busca]);

  const kpis = useMemo(() => ({
    abertas: pendencias.filter((p) => p.status === 'aberta').length,
    emAnalise: pendencias.filter((p) => p.status === 'em_analise').length,
    deficit: pendencias
      .filter((p) => !['resolvida', 'cancelada'].includes(p.status))
      .reduce((acc, p) => acc + Number(p.quantidadeDeficit), 0)
      .toFixed(3),
    resolvidasHoje: pendencias.filter((p) => p.status === 'resolvida').length,
  }), [pendencias]);

  const decidir = async (body: Record<string, unknown>) => {
    if (!selecionada || !podeResolver) return;
    setErro(null);
    try {
      const res = await fetch(`/api/comercial/overbooking/${selecionada.id}/decisao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na decisão');
    }
  };

  const alterarStatus = async (status: StatusPendenciaOverbooking, detalhe: Record<string, unknown>) => {
    if (!selecionada || !podeResolver) return;
    setErro(null);
    try {
      const res = await fetch(`/api/comercial/overbooking/${selecionada.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, detalhe }),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao alterar status');
    }
  };

  const cancelarPendencia = async () => {
    if (!motivoCancelamento) return;
    const motivo = obsCancelamento ? `${motivoCancelamento} — ${obsCancelamento}` : motivoCancelamento;
    await alterarStatus('cancelada', { motivo });
    setModalCancelar(false);
    setMotivoCancelamento('');
    setObsCancelamento('');
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Pendências de Overbooking</h1>
          <p className="text-sm text-muted-foreground">Gestão de déficits confirmados aguardando decisão</p>
        </div>
        <div className="flex items-center gap-2">
          <SeletorOperacao />
          <Button variant="outline" size="icon" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Pendências abertas', value: kpis.abertas },
          { label: 'Em análise', value: kpis.emAnalise },
          { label: 'Déficit total', value: kpis.deficit },
          { label: 'Resolvidas hoje', value: kpis.resolvidasHoje },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 w-56 pl-8" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select
          className="h-8 rounded-md border border-border bg-card px-2 text-xs"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusPendenciaOverbooking | 'todos')}
        >
          <option value="todos">Todos os status</option>
          {(Object.keys(ROTULO_STATUS_PENDENCIA) as StatusPendenciaOverbooking[]).map((s) => (
            <option key={s} value={s}>{ROTULO_STATUS_PENDENCIA[s]}</option>
          ))}
        </select>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="overflow-y-auto rounded-xl border border-border bg-card lg:col-span-4">
          {filtradas.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma pendência encontrada.</p>
          ) : (
            filtradas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelecionada(p)}
                className={`w-full border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted/30 ${selecionada?.id === p.id ? 'bg-muted/40' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{p.id.slice(0, 8)}</span>
                  <StatusPill variant="pendente" label={ROTULO_STATUS_PENDENCIA[p.status]} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Déficit: {p.quantidadeDeficit}</p>
              </button>
            ))
          )}
        </div>

        <div className="space-y-4 overflow-y-auto lg:col-span-8">
          {!selecionada ? (
            <p className="text-sm text-muted-foreground">Selecione uma pendência.</p>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-4 text-sm">
                <h2 className="font-semibold">Detalhe da pendência</h2>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">Quantidade deficitária</dt><dd className="font-medium">{selecionada.quantidadeDeficit}</dd></div>
                  <div><dt className="text-muted-foreground">Pedido de origem</dt><dd className="font-mono">{selecionada.pedidoVendaId.slice(0, 8)}</dd></div>
                  <div><dt className="text-muted-foreground">Cliente</dt><dd>{selecionada.clienteId.slice(0, 8)}</dd></div>
                  <div><dt className="text-muted-foreground">Confirmação do overbooking</dt><dd>{formatDataHora(selecionada.createdAt)}</dd></div>
                </dl>
                {podeResolver && !['resolvida', 'cancelada'].includes(selecionada.status) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selecionada.status === 'aberta' && (
                      <Button size="sm" variant="outline" onClick={() => void alterarStatus('em_analise', {})}>
                        <Clock className="mr-1 h-3 w-3" /> Iniciar análise
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="bg-success-strong text-white hover:bg-success-strong/90"
                      onClick={() => void alterarStatus('resolvida', { origem: 'manual' })}
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Marcar como resolvido
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => setModalCancelar(true)}
                    >
                      <X className="mr-1 h-3 w-3" /> Cancelar pendência
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">1. Compra complementar</h3>
                {cobertura?.comprasComplementares.length ? (
                  cobertura.comprasComplementares.map((c) => (
                    <div key={c.compraProgramadaId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-xs">
                      <span>{formatDataHora(c.dataOperacao)} — proj. {c.quantidadeProjetada}</span>
                      {podeResolver && (
                        <Button size="sm" onClick={() => void decidir({
                          caminho: 'compra_complementar',
                          compraProgramadaId: c.compraProgramadaId,
                          quantidade: selecionada.quantidadeDeficit,
                        })}>Programar</Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma compra elegível disponível.</p>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">2. Redistribuição</h3>
                {cobertura?.redistribuicoes.length ? (
                  cobertura.redistribuicoes.map((r) => (
                    <div key={r.reservaId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-xs">
                      <span>{r.clienteNome} — reserva {r.quantidadeReservada}</span>
                      {podeResolver && (
                        <Button size="sm" variant="outline" onClick={() => void decidir({
                          caminho: 'redistribuicao',
                          reservaOrigemId: r.reservaId,
                          quantidade: selecionada.quantidadeDeficit,
                        })}>Redistribuir</Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma reserva doadora disponível.</p>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">3. Postergar para próxima operação</h3>
                {cobertura?.proximaOperacao && cobertura.comprasComplementares[0] ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      A quantidade postergada gera um novo pedido de venda para o mesmo cliente, a ser atendido em uma próxima operação.
                    </p>
                    <p className="text-xs font-medium">{cobertura.proximaOperacao.rotulo}</p>
                    {podeResolver && (
                      <Button size="sm" onClick={() => { setQtdPostergar(selecionada.quantidadeDeficit); setModalPostergar(true); }}>
                        Postergar
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma operação destino elegível.</p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">Histórico</h3>
                {historico.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Sem eventos registrados.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {historico.map((h) => (
                      <li key={h.id} className="text-xs">
                        <span className="font-medium">{h.autorNome ?? '—'}</span>
                        {' · '}{ROTULO_STATUS_PENDENCIA[h.acao as StatusPendenciaOverbooking] ?? h.acao}
                        {' · '}{formatDataHora(h.criadoEm)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={modalCancelar} onOpenChange={(open) => { if (!open) setModalCancelar(false); }}>
        <DialogContent className="max-w-sm gap-0 p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-bold">Cancelar Pendência</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <p className="text-xs leading-snug text-destructive">
                O cancelamento não resolve o déficit no pedido de origem. Use apenas quando a pendência não fizer mais sentido (ex.: pedido cancelado).
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold">Motivo <span className="text-destructive">*</span></label>
              <Select value={motivoCancelamento} onValueChange={setMotivoCancelamento}>
                <SelectTrigger size="sm" aria-label="Motivo do cancelamento">
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_CANCELAMENTO.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold">Observação</label>
              <Textarea rows={2} value={obsCancelamento} onChange={(e) => setObsCancelamento(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex gap-2 px-5 pb-5">
            <Button variant="outline" className="flex-1" onClick={() => setModalCancelar(false)}>Voltar</Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={!motivoCancelamento}
              onClick={() => void cancelarPendencia()}
            >
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalPostergar} onOpenChange={(open) => { if (!open) setModalPostergar(false); }}>
        <DialogContent className="max-w-sm gap-0 p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-bold">Postergar para Próxima Operação</DialogTitle>
          </DialogHeader>
          {selecionada && cobertura?.proximaOperacao && cobertura.comprasComplementares[0] && (
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-xs leading-snug text-primary">
                  A quantidade postergada gera um novo pedido de venda para o mesmo cliente, a ser atendido em uma próxima operação.
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div><dt className="text-muted-foreground">Cliente</dt><dd className="font-medium">{selecionada.clienteId.slice(0, 8)}</dd></div>
                <div><dt className="text-muted-foreground">Produto</dt><dd className="font-medium">{selecionada.itemComercialId.slice(0, 8)}</dd></div>
              </dl>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold">Quantidade a postergar <span className="text-destructive">*</span></label>
                <Input
                  type="number"
                  min={1}
                  max={Number(selecionada.quantidadeDeficit)}
                  value={qtdPostergar}
                  onChange={(e) => {
                    const max = Number(selecionada.quantidadeDeficit);
                    const v = Math.max(1, Math.min(max, Number(e.target.value) || 1));
                    setQtdPostergar(String(v));
                  }}
                />
                <p className="text-xs text-muted-foreground">Déficit total desta pendência: {selecionada.quantidadeDeficit}.</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 px-5 pb-5">
            <Button variant="outline" className="flex-1" onClick={() => setModalPostergar(false)}>Cancelar</Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (!selecionada || !cobertura?.proximaOperacao || !cobertura.comprasComplementares[0]) return;
                void decidir({
                  caminho: 'novo_pedido',
                  operacaoDestinoId: cobertura.proximaOperacao.id,
                  compraProgramadaId: cobertura.comprasComplementares[0].compraProgramadaId,
                  quantidade: Number(qtdPostergar).toFixed(3),
                });
                setModalPostergar(false);
              }}
            >
              Gerar novo pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OverbookingClient({ permissoes }: { permissoes: string[] }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
      <OverbookingConteudo permissoes={permissoes} />
    </Suspense>
  );
}
