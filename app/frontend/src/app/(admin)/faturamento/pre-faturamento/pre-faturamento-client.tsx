'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Truck } from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import { statusCaminhaoVariant, statusNfseVariant } from '@/lib/status-ui';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill } from '@/components/ui/status-pill';
import { PageHeader } from '@/components/ui/page-header';
import { BadgeCount } from '@/components/ui/badge-count';
import { KpiStrip, Kpi } from '@/components/ui/kpi-strip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/empty-state';
import type { AmbienteFiscal, ConsolidacaoResposta, NotaFiscal, StatusNfse } from '@/lib/faturamento';
import type { Caminhao } from '@/lib/operacao';
import { extrairMensagemErro, mensagemDeErro } from '@/lib/error-message';

// ── Badge de ambiente EISS (AD-02 — substitui o aviso "pendente de definição") ──

function BadgeAmbiente({ homologacao }: { homologacao: boolean }) {
  return (
    <BadgeCount
      className={cn(
        'h-[22px] gap-1.5 px-2.5 text-[11px]',
        homologacao ? 'bg-warning-soft text-warning-fg' : 'bg-success-soft text-success-fg',
      )}
    >
      <AlertTriangle className="size-3.5 shrink-0" />
      {homologacao ? 'Homologação EISS' : 'Produção EISS'}
    </BadgeCount>
  );
}

// ── Pipeline de caminhão ──────────────────────────────────────────────────────

const ETAPAS_CAMINHAO = [
  { key: 'aberto', label: 'Aberto' },
  { key: 'fechado', label: 'Fechado' },
  { key: 'faturado', label: 'Faturado' },
] as const;

function indiceEtapaCaminhao(status: string): number {
  if (['faturado', 'liberado', 'liberado_saida'].includes(status)) return 2;
  if (['fechado', 'liberado_faturamento'].includes(status)) return 1;
  return 0;
}

function CaminhaoPipelineBar({ status }: { status: string }) {
  const atual = indiceEtapaCaminhao(status);

  return (
    <div className="flex items-center" aria-label="Progresso do caminhão">
      {ETAPAS_CAMINHAO.map((etapa, i) => {
        const concluido = i < atual;
        const ativo = i === atual;
        return (
          <div key={etapa.key} className="flex items-center">
            <span
              className={cn(
                'flex items-center gap-1.5 text-[11px] font-semibold text-fg-faint',
                concluido && 'text-success-fg',
                ativo && 'text-primary-fg',
              )}
            >
              <span
                className={cn(
                  'flex size-[18px] shrink-0 items-center justify-center rounded-full bg-surface-3 font-data text-[10px] text-fg-faint',
                  concluido && 'bg-success text-white',
                  ativo && 'bg-primary text-white shadow-[0_0_0_3px_var(--color-primary-soft)]',
                )}
                aria-hidden="true"
              >
                {concluido ? '✓' : i + 1}
              </span>
              {etapa.label}
            </span>
            {i < ETAPAS_CAMINHAO.length - 1 && (
              <span
                aria-hidden="true"
                className={cn('mx-1.5 h-px w-6 bg-border-strong', concluido && 'bg-success')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function rotuloNfse(status: StatusNfse): string {
  return status.replace(/_/g, ' ');
}

// ── Formulário de emissão por pedido ─────────────────────────────────────────

interface FormEmissaoProps {
  caminhaoId: string;
  pedidoVendaId: string;
  onSuccess: () => Promise<void>;
}

interface BloqueioEmissao {
  codigo: string;
  causa: string;
  impacto: string;
  acao: string;
}

function FormEmissao({ caminhaoId, pedidoVendaId, onSuccess }: FormEmissaoProps) {
  const [valor, setValor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [bloqueiosLocais, setBloqueiosLocais] = useState<BloqueioEmissao[]>([]);

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(valor);
    if (!valor || isNaN(v) || v <= 0) {
      setErroLocal('Informe um valor maior que zero.');
      return;
    }
    setErroLocal(null);
    setBloqueiosLocais([]);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/operacao/faturamento/caminhoes/${caminhaoId}/emitir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoVendaId, valor: v.toFixed(2) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // AllExceptionsFilter: message pode ser string ou objeto {message, bloqueios}
        const raw = (data as { message?: unknown }).message;
        if (typeof raw === 'object' && raw !== null && 'bloqueios' in raw) {
          const payload = raw as { message?: string; bloqueios: BloqueioEmissao[] };
          setErroLocal(payload.message ?? 'Emissão bloqueada por pendências críticas');
          setBloqueiosLocais(payload.bloqueios);
        } else {
          setErroLocal(extrairMensagemErro(data, 'Falha ao emitir NFS-e'));
        }
        return;
      }
      setValor('');
      await onSuccess();
    } catch {
      setErroLocal('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <form onSubmit={(e) => void emitir(e)} className="flex flex-wrap items-end gap-2">
        <FormField label="Valor (R$)" htmlFor={`valor-${pedidoVendaId}`} className="w-32">
          <Input
            id={`valor-${pedidoVendaId}`}
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            adornLeft={<span className="text-xs">R$</span>}
            className="text-right font-data"
            placeholder="0,00"
            disabled={submitting}
          />
        </FormField>
        <Button type="submit" size="sm" disabled={submitting || !valor}>
          {submitting ? 'Emitindo…' : 'Emitir NFS-e'}
        </Button>
        {erroLocal && (
          <p className="w-full text-[11px] font-medium text-danger-fg">{erroLocal}</p>
        )}
      </form>
      {bloqueiosLocais.length > 0 && (
        <ul className="space-y-2" data-testid="bloqueios-emissao">
          {bloqueiosLocais.map((b) => (
            <li key={b.codigo} className="rounded-md border border-warning-soft-border bg-warning-soft p-2.5 text-xs text-warning-fg">
              <p className="font-semibold">[{b.codigo}]</p>
              <p><span className="font-medium">Causa:</span> {b.causa}</p>
              <p><span className="font-medium">Impacto:</span> {b.impacto}</p>
              <p><span className="font-medium">Ação:</span> {b.acao}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FaturamentoClient({
  permissoes,
  titulo = 'Faturamento',
  mostrarListaCaminhoes = false,
}: {
  permissoes: string[];
  titulo?: string;
  mostrarListaCaminhoes?: boolean;
}) {
  const pode = (p: string) => permissoes.includes(p);

  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));
  const [caminhaoId, setCaminhaoId] = useState('');
  const [consolidacao, setConsolidacao] = useState<ConsolidacaoResposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'conectado' | 'desconectado'>('desconectado');
  const [caminhaoAtivo, setCaminhaoAtivo] = useState<string | null>(null);

  const [submittingNota, setSubmittingNota] = useState<string | null>(null);
  const [motivosCancelamento, setMotivosCancelamento] = useState<Record<string, string>>({});
  const [caminhoesDia, setCaminhoesDia] = useState<Caminhao[]>([]);
  const [carregandoCaminhoes, setCarregandoCaminhoes] = useState(mostrarListaCaminhoes);
  const [liberando, setLiberando] = useState(false);
  const [ambiente, setAmbiente] = useState<AmbienteFiscal | null>(null);

  useEffect(() => {
    fetch('/api/operacao/faturamento/ambiente', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AmbienteFiscal | null) => setAmbiente(data))
      .catch(() => setAmbiente(null));
  }, []);

  const caminhoesElegiveis = caminhoesDia.filter((c) =>
    ['fechado', 'liberado_faturamento', 'faturado'].includes(c.statusCaminhao),
  );

  const exibirFormManual =
    !mostrarListaCaminhoes || (!carregandoCaminhoes && caminhoesElegiveis.length === 0);

  const carregarCaminhoesDia = useCallback(async () => {
    if (!mostrarListaCaminhoes) return;
    setCarregandoCaminhoes(true);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes?dataOperacao=${encodeURIComponent(hoje)}`);
      if (res.ok) {
        setCaminhoesDia((await res.json()) as Caminhao[]);
      } else {
        setCaminhoesDia([]);
      }
    } catch {
      setCaminhoesDia([]);
    } finally {
      setCarregandoCaminhoes(false);
    }
  }, [hoje, mostrarListaCaminhoes]);

  useEffect(() => {
    void carregarCaminhoesDia();
  }, [carregarCaminhoesDia]);

  // Carrega a consolidação do caminhão selecionado
  const carregar = useCallback(async (id?: string) => {
    const alvo = id ?? caminhaoAtivo;
    if (!alvo) return;
    setErro(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/operacao/faturamento/caminhoes/${alvo}/consolidacao`, {
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(extrairMensagemErro(body, 'Falha ao consolidar'));
        return;
      }
      setConsolidacao(body as ConsolidacaoResposta);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [caminhaoAtivo]);

  function consolidar(e: React.FormEvent) {
    e.preventDefault();
    const id = caminhaoId.trim();
    if (!id) return;
    setCaminhaoAtivo(id);
    setConsolidacao(null);
    void carregar(id);
  }

  // Realtime: re-carrega ao receber eventos de NFS-e
  useEffect(() => {
    if (!caminhaoAtivo) return;

    const EVENTOS_FATURAMENTO = new Set([
      'nfse_emitida',
      'nfse_cancelada',
      'nfse_erro_emissao',
    ]);

    const onMessage = (msg: RealtimeMensagem) => {
      if (EVENTOS_FATURAMENTO.has(msg.type)) {
        void carregar();
      }
    };

    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${hoje}`, `faturamento:${caminhaoAtivo}`],
      onMessage,
      onReconnect: () => void carregar(),
      onStatus: setRealtimeStatus,
    });
    return desconectar;
  }, [carregar, caminhaoAtivo, hoje]);

  async function liberarFaturamento() {
    if (!caminhaoAtivo) return;
    setErro(null);
    setLiberando(true);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes/${caminhaoAtivo}/liberar-faturamento`, {
        method: 'POST',
        body: '{}',
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, 'Falha ao liberar faturamento'));
        return;
      }
      await carregarCaminhoesDia();
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLiberando(false);
    }
  }

  function selecionarCaminhao(id: string) {
    setCaminhaoAtivo(id);
    setCaminhaoId(id);
    setConsolidacao(null);
    void carregar(id);
  }

  // ── Ações por nota fiscal ──────────────────────────────────────────────────

  async function cancelarNota(notaId: string) {
    const motivo = motivosCancelamento[notaId]?.trim();
    if (!motivo) {
      setErro('Informe o motivo do cancelamento da NFS-e.');
      return;
    }
    setErro(null);
    setSubmittingNota(notaId);
    try {
      const res = await fetch(`/api/operacao/faturamento/notas/${notaId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, 'Falha ao cancelar NFS-e'));
        return;
      }
      setMotivosCancelamento((prev) => {
        const next = { ...prev };
        delete next[notaId];
        return next;
      });
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmittingNota(null);
    }
  }

  async function reprocessarNota(notaId: string) {
    setErro(null);
    setSubmittingNota(notaId);
    try {
      // body vazio — caminhaoId derivado da NF no backend
      const res = await fetch(`/api/operacao/faturamento/notas/${notaId}/reprocessar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, 'Falha ao reprocessar NFS-e'));
        return;
      }
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmittingNota(null);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function notaPorPedido(pedidoVendaId: string): NotaFiscal | undefined {
    return consolidacao?.notasFiscais.find((n) => n.pedidoVendaId === pedidoVendaId);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <PageHeader title={titulo} live={!!caminhaoAtivo && realtimeStatus === 'conectado'}>
        {ambiente && <BadgeAmbiente homologacao={ambiente.homologacao} />}
      </PageHeader>

      {/* Lista de caminhões do dia (pré-faturamento) */}
      {mostrarListaCaminhoes && carregandoCaminhoes && (
        <p className="text-xs text-muted-foreground" data-testid="carregando-caminhoes">
          Carregando caminhões do dia…
        </p>
      )}

      {mostrarListaCaminhoes && !carregandoCaminhoes && caminhoesElegiveis.length > 0 && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {caminhoesElegiveis.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selecionarCaminhao(c.id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors duration-100',
                  caminhaoAtivo === c.id
                    ? 'border-primary bg-primary-soft'
                    : 'border-border hover:border-fg-faint hover:bg-surface-2',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-data text-[13px] font-bold text-foreground">{c.placa}</p>
                    <p className="text-[11px] text-muted-foreground">{c.motorista}</p>
                  </div>
                  <StatusPill
                    variant={statusCaminhaoVariant(c.statusCaminhao)}
                    label={c.statusCaminhao.replace(/_/g, ' ')}
                  />
                </div>
                <div className="mt-2.5">
                  <CaminhaoPipelineBar status={c.statusCaminhao} />
                </div>
              </button>
            ))}
        </div>
      )}

      {mostrarListaCaminhoes && !carregandoCaminhoes && caminhoesElegiveis.length === 0 && (
        <div data-testid="sem-caminhoes-dia">
          <EmptyState
            icon={<Truck />}
            title="Nenhum caminhão elegível para faturamento hoje"
            description="Caminhões aparecem aqui após fechamento da expedição. Use o ID abaixo para consolidar manualmente, se necessário."
          />
        </div>
      )}

      {/* Formulário de seleção de caminhão */}
      {exibirFormManual && (
        <form onSubmit={consolidar} className="flex flex-wrap items-end gap-3">
          <FormField label="ID do Caminhão" htmlFor="caminhao-id" className="w-64">
            <Input
              id="caminhao-id"
              type="text"
              value={caminhaoId}
              onChange={(e) => setCaminhaoId(e.target.value)}
              placeholder="UUID do caminhão"
            />
          </FormField>
          <Button type="submit" disabled={loading || !caminhaoId.trim()}>
            {loading ? 'Consolidando…' : 'Consolidar'}
          </Button>
        </form>
      )}

      {mostrarListaCaminhoes && caminhaoAtivo && consolidacao?.caminhao.statusCaminhao === 'fechado' &&
        pode('FATURAMENTO_GERENCIAR') && (
        <Button onClick={() => void liberarFaturamento()} disabled={liberando}>
          {liberando ? 'Liberando…' : 'Liberar para Faturamento'}
        </Button>
      )}

      {/* Erro global */}
      {erro && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {erro}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p className="text-xs text-muted-foreground" data-testid="loading">
          Consolidando faturamento…
        </p>
      )}

      {/* Resultado da consolidação */}
      {!loading && consolidacao && (
        <div className="space-y-3">
          {/* Cabeçalho do caminhão */}
          <Card>
            <CardContent className="space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    {consolidacao.caminhao.placa} — {consolidacao.caminhao.motorista}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Data: {consolidacao.caminhao.dataOperacao}
                  </p>
                </div>
                <StatusPill
                  variant={statusCaminhaoVariant(consolidacao.caminhao.statusCaminhao)}
                  label={consolidacao.caminhao.statusCaminhao.replace(/_/g, ' ')}
                />
              </div>
              <CaminhaoPipelineBar status={consolidacao.caminhao.statusCaminhao} />
              <p className="text-xs text-muted-foreground">
                Faturamento:{' '}
                <span className="font-medium text-foreground">
                  {consolidacao.faturamento.statusFaturamento.replace(/_/g, ' ')}
                </span>{' '}
                · {consolidacao.totalItens} itens no total
              </p>
            </CardContent>
          </Card>

          {/* KPIs */}
          {(() => {
            const notas = consolidacao.notasFiscais;
            const preparados = consolidacao.pedidos.filter((p) => !notaPorPedido(p.pedidoVendaId)).length;
            const autorizados = notas.filter((n) => n.statusNfse === 'emitida').length;
            const erros = notas.filter((n) => n.statusNfse === 'erro_emissao').length;
            const valorTotal = notas.reduce((acc, n) => acc + Number(n.valor), 0);
            return (
              <KpiStrip>
                <Kpi label="Pedidos na carga" value={consolidacao.pedidos.length} hint="para faturamento" tone="default" />
                <Kpi label="Preparados" value={preparados} hint="aguardando envio" tone="default" />
                <Kpi label="Autorizados" value={autorizados} hint="nota emitida" tone="ok" />
                <Kpi label="Com erro" value={erros} hint="aguardando reprocessamento" tone="danger" />
                <Kpi
                  label="Valor total da carga"
                  value={valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  hint="notas emitidas"
                  tone="default"
                />
              </KpiStrip>
            );
          })()}

          {/* Painel de bloqueios */}
          {consolidacao.bloqueios.length > 0 && (
            <div
              role="alert"
              className="space-y-2.5 rounded-md border border-warning-soft-border bg-warning-soft p-3"
              data-testid="painel-bloqueios"
            >
              <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-warning-fg">
                <AlertTriangle className="size-3.5 shrink-0" />
                Bloqueios ativos — dados fiscais incompletos ({consolidacao.bloqueios.length})
              </h2>
              <ul className="space-y-2">
                {consolidacao.bloqueios.map((b) => (
                  <li key={b.codigo} className="rounded-md border border-warning-soft-border bg-card p-2.5 text-xs">
                    <p className="font-semibold text-warning-fg">[{b.codigo}]</p>
                    <p className="text-fg-secondary"><span className="font-medium text-foreground">Causa:</span> {b.causa}</p>
                    <p className="text-fg-secondary"><span className="font-medium text-foreground">Impacto:</span> {b.impacto}</p>
                    <p className="text-fg-secondary"><span className="font-medium text-foreground">Ação:</span> {b.acao}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lista de pedidos (apenas sem bloqueios ou sempre visível para acompanhamento) */}
          {consolidacao.pedidos.length > 0 && (
            <Card data-testid="lista-pedidos">
              <CardHeader>
                <CardTitle>Pedidos consolidados</CardTitle>
                <BadgeCount>{consolidacao.pedidos.length}</BadgeCount>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {consolidacao.pedidos.map((pedido) => {
                  const nota = notaPorPedido(pedido.pedidoVendaId);
                  const emOperacao = submittingNota === nota?.id;
                  return (
                    <div
                      key={pedido.pedidoVendaId}
                      className="rounded-md border border-border p-3 space-y-2"
                      data-testid="pedido-item"
                    >
                      {/* Dados do pedido */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">
                            {pedido.clienteRazaoSocial}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {pedido.clienteDocumentoFiscal} · {pedido.itensCount} iten(s) ·{' '}
                            {pedido.pesoTotalKg.toFixed(3)} kg
                          </p>
                        </div>
                        {nota && (
                          <StatusPill variant={statusNfseVariant(nota.statusNfse)} label={rotuloNfse(nota.statusNfse)} />
                        )}
                      </div>

                      {/* NF já existe */}
                      {nota && (
                        <div className="space-y-2 text-xs">
                          {nota.numeroNfse && (
                            <p className="text-muted-foreground">
                              NFS-e nº{' '}
                              <span className="font-data font-semibold text-foreground">{nota.numeroNfse}</span>
                              {nota.codigoVerificacao && (
                                <> · Cód. verificação: <span className="font-data font-semibold text-foreground">{nota.codigoVerificacao}</span></>
                              )}
                            </p>
                          )}
                          {nota.linkNfse && (
                            <a
                              href={nota.linkNfse}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-medium text-primary-fg underline"
                            >
                              Ver NFS-e
                            </a>
                          )}
                          {nota.ultimoErroNfse && (
                            <p className="rounded-md bg-danger-soft px-2 py-1 text-[11px] text-danger-fg">
                              Erro: {nota.ultimoErroNfse}
                            </p>
                          )}
                          <p className="text-muted-foreground">
                            Valor: R$ {nota.valor} · Alíquota: {nota.aliquota}% ·{' '}
                            {nota.tentativasEmissao} tentativa(s)
                          </p>

                          {/* Ações por NF */}
                          <div className="flex flex-wrap gap-2">
                            {nota.statusNfse === 'emitida' && pode('NFSE_CANCELAR') && (
                              <div className="flex w-full flex-wrap items-end gap-2">
                                <FormField label="Motivo do cancelamento" htmlFor={`motivo-cancelar-${nota.id}`} className="w-64">
                                  <Input
                                    id={`motivo-cancelar-${nota.id}`}
                                    type="text"
                                    value={motivosCancelamento[nota.id] ?? ''}
                                    onChange={(e) =>
                                      setMotivosCancelamento((prev) => ({
                                        ...prev,
                                        [nota.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Motivo auditável"
                                    disabled={emOperacao}
                                  />
                                </FormField>
                                <Button
                                  size="sm"
                                  variant="destructiveOutline"
                                  onClick={() => void cancelarNota(nota.id)}
                                  disabled={emOperacao || !motivosCancelamento[nota.id]?.trim()}
                                  data-testid="btn-cancelar"
                                >
                                  {emOperacao ? 'Cancelando…' : 'Cancelar'}
                                </Button>
                              </div>
                            )}
                            {nota.statusNfse === 'erro_emissao' &&
                              pode('NFSE_EMITIR') && (
                                <Button
                                  size="sm"
                                  onClick={() => void reprocessarNota(nota.id)}
                                  disabled={emOperacao}
                                  data-testid="btn-reprocessar"
                                >
                                  {emOperacao ? 'Reprocessando…' : 'Reprocessar'}
                                </Button>
                              )}
                          </div>
                        </div>
                      )}

                      {/* Emitir NF (sem nota ou nota pendente) */}
                      {(!nota || nota.statusNfse === 'pendente') && pode('NFSE_EMITIR') && (
                        <FormEmissao
                          caminhaoId={consolidacao.caminhao.id}
                          pedidoVendaId={pedido.pedidoVendaId}
                          onSuccess={carregar}
                        />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {consolidacao.pedidos.length === 0 && (
            <p className="text-xs text-muted-foreground" data-testid="sem-pedidos">
              Nenhum pedido consolidado para este caminhão.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
