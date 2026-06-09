'use client';

import { useCallback, useEffect, useState } from 'react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import { Button } from '@/components/ui/button';
import type { ConsolidacaoResposta, NotaFiscal, StatusNfse } from '@/lib/faturamento';

// ── Badges ────────────────────────────────────────────────────────────────────

const COR_NFSE: Record<StatusNfse, string> = {
  pendente: 'bg-muted text-muted-foreground',
  emitida: 'bg-green-100 text-green-800',
  erro_emissao: 'bg-red-100 text-red-800',
  cancelada: 'bg-orange-100 text-orange-800',
  erro_cancelamento: 'bg-red-200 text-red-900',
};

function NfseBadge({ status }: { status: StatusNfse }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${COR_NFSE[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Formulário de emissão por pedido ─────────────────────────────────────────

interface FormEmissaoProps {
  caminhaoId: string;
  pedidoVendaId: string;
  onSuccess: () => Promise<void>;
}

function FormEmissao({ caminhaoId, pedidoVendaId, onSuccess }: FormEmissaoProps) {
  const [valor, setValor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(valor);
    if (!valor || isNaN(v) || v <= 0) {
      setErroLocal('Informe um valor maior que zero.');
      return;
    }
    setErroLocal(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/operacao/faturamento/caminhoes/${caminhaoId}/emitir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoVendaId, valor: v.toFixed(2) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErroLocal((data as { message?: string }).message ?? 'Falha ao emitir NFS-e');
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
    <form onSubmit={(e) => void emitir(e)} className="mt-2 flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`valor-${pedidoVendaId}`}>
          Valor (R$)
        </label>
        <input
          id={`valor-${pedidoVendaId}`}
          type="number"
          min="0.01"
          step="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="0,00"
          disabled={submitting}
        />
      </div>
      <Button type="submit" size="sm" disabled={submitting || !valor}>
        {submitting ? 'Emitindo…' : 'Emitir NFS-e'}
      </Button>
      {erroLocal && (
        <p className="w-full text-xs text-destructive">{erroLocal}</p>
      )}
    </form>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FaturamentoClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);

  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));
  const [caminhaoId, setCaminhaoId] = useState('');
  const [consolidacao, setConsolidacao] = useState<ConsolidacaoResposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'conectado' | 'desconectado'>('desconectado');
  const [caminhaoAtivo, setCaminhaoAtivo] = useState<string | null>(null);

  const [submittingNota, setSubmittingNota] = useState<string | null>(null); // notaId em operação

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
        setErro((body as { message?: string }).message ?? 'Falha ao consolidar');
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

  // ── Ações por nota fiscal ──────────────────────────────────────────────────

  async function cancelarNota(notaId: string) {
    setErro(null);
    setSubmittingNota(notaId);
    try {
      const res = await fetch(`/api/operacao/faturamento/notas/${notaId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Falha ao cancelar NFS-e');
        return;
      }
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
      const res = await fetch(`/api/operacao/faturamento/notas/${notaId}/reprocessar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Falha ao reprocessar NFS-e');
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
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
        {caminhaoAtivo && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              realtimeStatus === 'conectado'
                ? 'bg-green-100 text-green-800'
                : 'bg-muted text-muted-foreground'
            }`}
            aria-label={`Tempo real ${realtimeStatus}`}
          >
            {realtimeStatus === 'conectado' ? '● tempo real' : '○ reconectando'}
          </span>
        )}
      </div>

      {/* Formulário de seleção de caminhão */}
      <form onSubmit={consolidar} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="caminhao-id">
            ID do Caminhão
          </label>
          <input
            id="caminhao-id"
            type="text"
            value={caminhaoId}
            onChange={(e) => setCaminhaoId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="UUID do caminhão"
          />
        </div>
        <Button type="submit" disabled={loading || !caminhaoId.trim()}>
          {loading ? 'Consolidando…' : 'Consolidar'}
        </Button>
      </form>

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
        <p className="text-sm text-muted-foreground" data-testid="loading">
          Consolidando faturamento…
        </p>
      )}

      {/* Resultado da consolidação */}
      {!loading && consolidacao && (
        <div className="space-y-4">
          {/* Cabeçalho do caminhão */}
          <div className="rounded-md border border-border bg-card p-4">
            <p className="font-medium text-foreground">
              {consolidacao.caminhao.placa} — {consolidacao.caminhao.motorista}
            </p>
            <p className="text-xs text-muted-foreground">
              Status: {consolidacao.caminhao.statusCaminhao.replace(/_/g, ' ')} · Data:{' '}
              {consolidacao.caminhao.dataOperacao}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Faturamento:{' '}
              <span className="font-medium">
                {consolidacao.faturamento.statusFaturamento.replace(/_/g, ' ')}
              </span>{' '}
              · {consolidacao.totalItens} itens no total
            </p>
          </div>

          {/* Painel de bloqueios */}
          {consolidacao.bloqueios.length > 0 && (
            <div
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 p-4 space-y-3"
              data-testid="painel-bloqueios"
            >
              <h2 className="font-semibold text-red-800">
                Bloqueios ({consolidacao.bloqueios.length})
              </h2>
              <ul className="space-y-3">
                {consolidacao.bloqueios.map((b) => (
                  <li key={b.codigo} className="rounded border border-red-200 bg-white p-3 text-sm">
                    <p className="font-medium text-red-700">[{b.codigo}]</p>
                    <p className="text-red-700">
                      <span className="font-medium">Causa:</span> {b.causa}
                    </p>
                    <p className="text-red-700">
                      <span className="font-medium">Impacto:</span> {b.impacto}
                    </p>
                    <p className="text-red-700">
                      <span className="font-medium">Ação:</span> {b.acao}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lista de pedidos (apenas sem bloqueios ou sempre visível para acompanhamento) */}
          {consolidacao.pedidos.length > 0 && (
            <div className="space-y-3" data-testid="lista-pedidos">
              <h2 className="text-lg font-semibold text-foreground">
                Pedidos consolidados ({consolidacao.pedidos.length})
              </h2>
              <ul className="space-y-4">
                {consolidacao.pedidos.map((pedido) => {
                  const nota = notaPorPedido(pedido.pedidoVendaId);
                  const emOperacao = submittingNota === nota?.id;
                  return (
                    <li
                      key={pedido.pedidoVendaId}
                      className="rounded-md border border-border bg-card p-4 space-y-3"
                      data-testid="pedido-item"
                    >
                      {/* Dados do pedido */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">
                            {pedido.clienteRazaoSocial}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pedido.clienteDocumentoFiscal} · {pedido.itensCount} iten(s) ·{' '}
                            {pedido.pesoTotalKg.toFixed(3)} kg
                          </p>
                        </div>
                        {nota && <NfseBadge status={nota.statusNfse} />}
                      </div>

                      {/* NF já existe */}
                      {nota && (
                        <div className="space-y-2 text-sm">
                          {nota.numeroNfse && (
                            <p className="text-muted-foreground">
                              NFS-e nº{' '}
                              <span className="font-medium text-foreground">{nota.numeroNfse}</span>
                              {nota.codigoVerificacao && (
                                <> · Cód. verificação: <span className="font-medium text-foreground">{nota.codigoVerificacao}</span></>
                              )}
                            </p>
                          )}
                          {nota.linkNfse && (
                            <a
                              href={nota.linkNfse}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 underline"
                            >
                              Ver NFS-e
                            </a>
                          )}
                          {nota.ultimoErroNfse && (
                            <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                              Erro: {nota.ultimoErroNfse}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Valor: R$ {nota.valor} · Alíquota: {nota.aliquota}% ·{' '}
                            {nota.tentativasEmissao} tentativa(s)
                          </p>

                          {/* Ações por NF */}
                          <div className="flex flex-wrap gap-2">
                            {nota.statusNfse === 'emitida' && pode('FATURAMENTO_CANCELAR') && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => void cancelarNota(nota.id)}
                                disabled={emOperacao}
                                data-testid="btn-cancelar"
                              >
                                {emOperacao ? 'Cancelando…' : 'Cancelar'}
                              </Button>
                            )}
                            {(nota.statusNfse === 'erro_emissao' || nota.statusNfse === 'erro_cancelamento') &&
                              pode('FATURAMENTO_EMITIR') && (
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
                      {(!nota || nota.statusNfse === 'pendente') && pode('FATURAMENTO_EMITIR') && (
                        <FormEmissao
                          caminhaoId={consolidacao.caminhao.id}
                          pedidoVendaId={pedido.pedidoVendaId}
                          onSuccess={carregar}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {consolidacao.pedidos.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="sem-pedidos">
              Nenhum pedido consolidado para este caminhão.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
