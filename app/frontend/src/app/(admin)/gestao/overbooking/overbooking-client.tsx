'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ban, CheckCircle2, Clock, Info, RefreshCw, Search, X } from 'lucide-react';
import { SeletorOperacao } from '@/components/gestao/seletor-operacao';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/cn';
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

function Par({ rotulo, valor, mono }: { rotulo: string; valor: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{rotulo}</dt>
      <dd className={cn('text-[13px] font-medium text-foreground', mono && 'font-data')}>{valor}</dd>
    </div>
  );
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
    <div className="space-y-3">
      <PageHeader
        title="Pendências de Overbooking"
        subtitle="Gestão de déficits confirmados aguardando decisão"
      >
        <SeletorOperacao />
        <Button variant="secondary" size="icon" onClick={() => void carregar()} disabled={carregando}>
          <RefreshCw className={carregando ? 'animate-spin' : ''} />
        </Button>
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <KpiStrip>
        <Kpi label="Pendências abertas" value={kpis.abertas} tone="alert" />
        <Kpi label="Em análise" value={kpis.emAnalise} tone="default" />
        <Kpi label="Déficit total" value={kpis.deficit} tone="danger" />
        <Kpi label="Resolvidas hoje" value={kpis.resolvidasHoje} tone="ok" />
      </KpiStrip>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-[240px]">
          <Input adornLeft={<Search />} placeholder="Buscar…" className="h-7 text-xs" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <SelectNative
          selectSize="sm"
          className="w-[150px]"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusPendenciaOverbooking | 'todos')}
        >
          <option value="todos">Todos os status</option>
          {(Object.keys(ROTULO_STATUS_PENDENCIA) as StatusPendenciaOverbooking[]).map((s) => (
            <option key={s} value={s}>{ROTULO_STATUS_PENDENCIA[s]}</option>
          ))}
        </SelectNative>
      </div>

      <div className="grid items-start gap-2.5 lg:grid-cols-[320px_1fr]">
        <Card>
          <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
            {filtradas.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Nenhuma pendência encontrada.</p>
            ) : (
              filtradas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelecionada(p)}
                  className={cn(
                    'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2',
                    selecionada?.id === p.id && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-data min-w-0 flex-1 truncate text-[13px] font-semibold">{p.id.slice(0, 8)}</span>
                    <StatusPill variant="pendente" label={ROTULO_STATUS_PENDENCIA[p.status]} className="h-[17px] text-[10px]" />
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    Déficit: <span className="font-data text-danger-fg">{p.quantidadeDeficit}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-2.5">
          {!selecionada ? (
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">Selecione uma pendência.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Detalhe da pendência</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3">
                    <Par rotulo="Quantidade deficitária" valor={selecionada.quantidadeDeficit} mono />
                    <Par rotulo="Pedido de origem" valor={selecionada.pedidoVendaId.slice(0, 8)} mono />
                    <Par rotulo="Cliente" valor={selecionada.clienteId.slice(0, 8)} mono />
                    <Par rotulo="Confirmação do overbooking" valor={formatDataHora(selecionada.createdAt)} />
                  </dl>
                  {podeResolver && !['resolvida', 'cancelada'].includes(selecionada.status) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selecionada.status === 'aberta' && (
                        <Button size="sm" variant="secondary" onClick={() => void alterarStatus('em_analise', {})}>
                          <Clock /> Iniciar análise
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => void alterarStatus('resolvida', { origem: 'manual' })}
                      >
                        <CheckCircle2 /> Marcar como resolvido
                      </Button>
                      <Button
                        size="sm"
                        variant="destructiveOutline"
                        onClick={() => setModalCancelar(true)}
                      >
                        <X /> Cancelar pendência
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>1. Compra complementar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cobertura?.comprasComplementares.length ? (
                    cobertura.comprasComplementares.map((c) => (
                      <div key={c.compraProgramadaId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-xs">
                        <span>{formatDataHora(c.dataOperacao)} — proj. {c.quantidadeProjetada}</span>
                        {podeResolver && (
                          <Button size="sm" variant="secondary" onClick={() => void decidir({
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>2. Redistribuição</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cobertura?.redistribuicoes.length ? (
                    cobertura.redistribuicoes.map((r) => (
                      <div key={r.reservaId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-xs">
                        <span>{r.clienteNome} — reserva {r.quantidadeReservada}</span>
                        {podeResolver && (
                          <Button size="sm" variant="secondary" onClick={() => void decidir({
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>3. Postergar para próxima operação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cobertura?.proximaOperacao ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        A quantidade postergada gera um novo pedido de venda para o mesmo cliente, a ser atendido em uma próxima operação.
                      </p>
                      <p className="text-xs font-medium">{cobertura.proximaOperacao.rotulo}</p>
                      {podeResolver && (
                        <Button size="sm" variant="secondary" onClick={() => { setQtdPostergar(selecionada.quantidadeDeficit); setModalPostergar(true); }}>
                          Postergar
                        </Button>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma operação destino elegível.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Histórico</CardTitle>
                </CardHeader>
                <CardContent>
                  {historico.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem eventos registrados.</p>
                  ) : (
                    <ul className="space-y-2">
                      {historico.map((h) => (
                        <li key={h.id} className="text-xs">
                          <span className="font-medium">{h.autorNome ?? '—'}</span>
                          {' · '}{ROTULO_STATUS_PENDENCIA[h.acao as StatusPendenciaOverbooking] ?? h.acao}
                          {' · '}{formatDataHora(h.criadoEm)}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={modalCancelar} onOpenChange={(open) => { if (!open) setModalCancelar(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Pendência</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-4">
            <div className="flex items-start gap-2 rounded-lg border border-danger-soft-border bg-danger-soft p-3">
              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-fg" />
              <p className="text-xs leading-snug text-danger-fg">
                O cancelamento não resolve o déficit no pedido de origem. Use apenas quando a pendência não fizer mais sentido (ex.: pedido cancelado).
              </p>
            </div>
            <FormField label="Motivo" required htmlFor="motivo-cancelamento">
              <SelectNative
                id="motivo-cancelamento"
                aria-label="Motivo do cancelamento"
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
              >
                <option value="">Selecionar…</option>
                {MOTIVOS_CANCELAMENTO.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </SelectNative>
            </FormField>
            <FormField label="Observação" htmlFor="obs-cancelamento">
              <Textarea id="obs-cancelamento" rows={2} value={obsCancelamento} onChange={(e) => setObsCancelamento(e.target.value)} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalCancelar(false)}>Voltar</Button>
            <Button
              variant="destructive"
              disabled={!motivoCancelamento}
              onClick={() => void cancelarPendencia()}
            >
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalPostergar} onOpenChange={(open) => { if (!open) setModalPostergar(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Postergar para Próxima Operação</DialogTitle>
          </DialogHeader>
          {selecionada && cobertura?.proximaOperacao && (
            <div className="flex flex-col gap-3 px-4">
              <div className="flex items-start gap-2 rounded-lg border border-primary-soft-border bg-primary-soft p-3">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-fg" />
                <p className="text-xs leading-snug text-primary-fg">
                  A quantidade postergada gera um novo pedido de venda para o mesmo cliente, a ser atendido em uma próxima operação.
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <Par rotulo="Cliente" valor={selecionada.clienteId.slice(0, 8)} mono />
                <Par rotulo="Produto" valor={selecionada.itemComercialId.slice(0, 8)} mono />
              </dl>
              <FormField
                label="Quantidade a postergar"
                required
                help={`Déficit total desta pendência: ${selecionada.quantidadeDeficit}.`}
                htmlFor="qtd-postergar"
              >
                <Input
                  id="qtd-postergar"
                  type="number"
                  min={1}
                  max={Number(selecionada.quantidadeDeficit)}
                  value={qtdPostergar}
                  onChange={(e) => {
                    const max = Number(selecionada.quantidadeDeficit);
                    const v = Math.max(1, Math.min(max, Number(e.target.value) || 1));
                    setQtdPostergar(String(v));
                  }}
                  className="text-right font-data"
                />
              </FormField>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalPostergar(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!selecionada || !cobertura?.proximaOperacao) return;
                void decidir({
                  caminho: 'novo_pedido',
                  operacaoDestinoId: cobertura.proximaOperacao.id,
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
