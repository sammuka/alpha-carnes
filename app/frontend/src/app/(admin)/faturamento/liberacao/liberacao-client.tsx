'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, Lock, Search, ShieldCheck, Truck, XCircle, AlertTriangle } from 'lucide-react';
import type { StatusCaminhao } from '@/lib/operacao';
import { statusCaminhaoVariant, statusNfseVariant } from '@/lib/status-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import { Input } from '@/components/ui/input';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import type { ChecklistLiberacao, NotaFiscalListagem, Paginado, RequisitoChecklist, StatusNfse } from '@/lib/faturamento';
import { extrairMensagemErro } from '@/lib/error-message';

interface CaminhaoLiberacao {
  id: string;
  placa: string;
  motorista: string;
  rota: string | null;
  statusCaminhao: StatusCaminhao;
  dataOperacao: string;
  statusFaturamento: string | null;
  /** Quem/quando liberou a saída — LiberacaoCaminhao.tsx:207 (banner de confirmação). */
  liberacaoSaida: { dataHora: string; responsavelNome: string | null } | null;
}

function rotuloNota(status: StatusNfse): string {
  const rotulos: Record<StatusNfse, string> = {
    pendente: 'Processando',
    emitida: 'Autorizada',
    erro_emissao: 'Erro',
    cancelada: 'Cancelada',
    erro_cancelamento: 'Erro no cancelamento',
  };
  return rotulos[status];
}

function fmtDataHoraLiberacao(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const LINK_RESOLUCAO: Record<RequisitoChecklist['chave'], { texto: string; href: string }> = {
  cargaConferida: { texto: 'Resolver em Carga → Conferência', href: '/carga/conferencia' },
  notasAutorizadas: { texto: 'Resolver em Notas / XML', href: '/faturamento/notas-xml' },
  seguroConfirmado: { texto: 'Resolver em Seguro Manual', href: '/faturamento/seguro-manual' },
  caminhaoMotorista: { texto: 'Resolver em Cadastros → Caminhões', href: '/cadastros/caminhoes' },
};

function RequisitoLinha({ ok, label, detalhe }: { ok: boolean; label: string; detalhe?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--color-muted)] last:border-0">
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="w-4 h-4 text-[var(--color-success-strong)] flex-shrink-0" /> : <XCircle className="w-4 h-4 text-[var(--color-danger-rose)] flex-shrink-0" />}
        <span className={`text-[13px] font-medium ${ok ? 'text-[var(--color-text-strong)]' : 'text-[var(--color-danger-strong-text)]'}`}>{label}</span>
      </div>
      {detalhe && <span className={`text-[11px] font-semibold ${ok ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-danger-rose)]'}`}>{detalhe}</span>}
    </div>
  );
}

export function LiberacaoCaminhaoClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);
  const [dataOperacao] = useState(() => new Date().toISOString().slice(0, 10));
  const [lista, setLista] = useState<CaminhaoLiberacao[]>([]);
  const [selecionado, setSelecionado] = useState<CaminhaoLiberacao | null>(null);
  const [busca, setBusca] = useState('');
  const [checklist, setChecklist] = useState<ChecklistLiberacao | null>(null);
  const [checklistsPorCaminhao, setChecklistsPorCaminhao] = useState<Record<string, ChecklistLiberacao>>({});
  const [notasCarga, setNotasCarga] = useState<NotaFiscalListagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacao/expedicao/liberacao?dataOperacao=${encodeURIComponent(dataOperacao)}`);
      if (!res.ok) {
        setErro('Falha ao carregar veículos');
        return;
      }
      const data = (await res.json()) as CaminhaoLiberacao[];
      setLista(data);
      setSelecionado((atual) => (atual ? data.find((c) => c.id === atual.id) ?? null : null));

      // KPIs "Liberáveis agora"/"Com pendência" (LiberacaoCaminhao.tsx:145-148) exigem o
      // checklist de cada caminhão ainda não liberado — buscados em paralelo.
      const pendentes = data.filter((c) => c.statusCaminhao !== 'liberado_saida');
      const resultados = await Promise.all(
        pendentes.map(async (c) => {
          const r = await fetch(`/api/operacao/faturamento/liberacao/${c.id}/checklist`, { cache: 'no-store' });
          return r.ok ? [c.id, (await r.json()) as ChecklistLiberacao] as const : null;
        }),
      );
      setChecklistsPorCaminhao((prev) => {
        const proximo = { ...prev };
        for (const item of resultados) if (item) proximo[item[0]] = item[1];
        return proximo;
      });
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [dataOperacao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const carregarChecklist = useCallback(async (caminhaoId: string) => {
    const res = await fetch(`/api/operacao/faturamento/liberacao/${caminhaoId}/checklist`, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as ChecklistLiberacao;
      setChecklist(data);
      setChecklistsPorCaminhao((prev) => ({ ...prev, [caminhaoId]: data }));
    } else {
      setChecklist(null);
    }
  }, []);

  const carregarNotasCarga = useCallback(async (caminhaoId: string) => {
    const res = await fetch(`/api/operacao/faturamento/notas?caminhaoId=${encodeURIComponent(caminhaoId)}&pageSize=100`, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as Paginado<NotaFiscalListagem>;
      setNotasCarga(data.data);
    } else {
      setNotasCarga([]);
    }
  }, []);

  useEffect(() => {
    if (selecionado) {
      void carregarChecklist(selecionado.id);
      void carregarNotasCarga(selecionado.id);
    } else {
      setChecklist(null);
      setNotasCarga([]);
    }
  }, [selecionado, carregarChecklist, carregarNotasCarga]);

  useEffect(() => {
    const EVENTOS_RELEVANTES = new Set(['nfse_emitida', 'nfse_cancelada', 'nfse_erro_emissao', 'seguro_atualizado', 'caminhao_liberado']);
    const onMessage = (msg: RealtimeMensagem) => {
      if (!EVENTOS_RELEVANTES.has(msg.type)) return;
      void carregar();
      if (selecionado) {
        void carregarChecklist(selecionado.id);
        void carregarNotasCarga(selecionado.id);
      }
    };
    const desconectar = conectarRealtime({ rooms: ['dashboard'], onMessage, onReconnect: () => void carregar() });
    return desconectar;
  }, [carregar, carregarChecklist, carregarNotasCarga, selecionado]);

  // KPIs "Cargas no pátio"/"Liberáveis agora"/"Com pendência"/"Liberadas" (LiberacaoCaminhao.tsx:143-156).
  const kpis = useMemo(() => {
    const liberadas = lista.filter((c) => c.statusCaminhao === 'liberado_saida').length;
    const naoLiberadas = lista.filter((c) => c.statusCaminhao !== 'liberado_saida');
    const liberaveis = naoLiberadas.filter((c) => checklistsPorCaminhao[c.id]?.liberavel === true).length;
    const pendentes = naoLiberadas.length - liberaveis;
    return { total: lista.length, liberaveis, pendentes, liberadas };
  }, [lista, checklistsPorCaminhao]);

  const filtrados = useMemo(() => {
    return lista.filter(
      (c) =>
        !busca ||
        c.placa.toLowerCase().includes(busca.toLowerCase()) ||
        c.motorista.toLowerCase().includes(busca.toLowerCase()),
    );
  }, [lista, busca]);

  async function liberarSaida() {
    if (!selecionado || !checklist?.liberavel) return;
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes/${selecionado.id}/liberar-saida`, {
        method: 'POST',
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(extrairMensagemErro(data, 'Falha ao liberar saída'));
        return;
      }
      await carregar();
      await carregarChecklist(selecionado.id);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  function statusLiberacao(c: CaminhaoLiberacao): { variant: StatusPillVariant; label: string } {
    if (c.statusCaminhao === 'liberado_saida') {
      return { variant: 'expedido', label: 'Liberado' };
    }
    if (checklistsPorCaminhao[c.id]?.liberavel) {
      return { variant: 'expedido', label: 'Liberável' };
    }
    return {
      variant: statusCaminhaoVariant(c.statusCaminhao),
      label: 'Pendente',
    };
  }

  function statusBadge(c: CaminhaoLiberacao) {
    const { variant, label } = statusLiberacao(c);
    return <StatusPill variant={variant} label={label} />;
  }

  const liberado = selecionado?.statusCaminhao === 'liberado_saida';

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Liberação do Caminhão</h1>
          <p className="text-sm text-muted-foreground">
            Checklist calculado a partir do estado real da carga, notas fiscais e seguro. Libera apenas quando todos os requisitos estiverem OK.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="min-w-[250px] pl-9" placeholder="Buscar placa…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* KPIs — LiberacaoCaminhao.tsx:143-156 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Cargas no pátio', value: `${kpis.total}`, sub: 'aguardando liberação', color: 'text-[var(--color-brand-navy-deep)]', bg: 'bg-[var(--color-surface-subtle)]' },
          { label: 'Liberáveis agora', value: `${kpis.liberaveis}`, sub: 'todos os requisitos OK', color: 'text-[var(--color-success-strong)]', bg: 'bg-[var(--color-success-surface)]' },
          { label: 'Com pendência', value: `${kpis.pendentes}`, sub: 'requisitos incompletos', color: 'text-[var(--color-warning-ink)]', bg: 'bg-[var(--color-warning-surface)]' },
          { label: 'Liberadas', value: `${kpis.liberadas}`, sub: 'alterações bloqueadas', color: 'text-[var(--color-text-secondary)]', bg: 'bg-[var(--color-muted)]' },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} className={`border border-[var(--color-border)] rounded-xl px-4 py-3.5 ${bg}`}>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-medium mb-1">{label}</p>
            <p className={`text-[26px] font-black leading-none ${color}`}>{value}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardContent className="flex h-full flex-col gap-4 p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Truck className="h-5 w-5 text-primary" />
              Caminhões no Pátio
            </h2>
            <div className="flex-1 space-y-3 overflow-auto">
              {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {filtrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelecionado(c)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    selecionado?.id === c.id ? 'border-primary bg-primary/5' : 'hover:border-primary/30'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <Badge variant="outline" className="font-mono">
                      {c.placa}
                    </Badge>
                    {statusBadge(c)}
                  </div>
                  <p className="font-semibold">{c.motorista}</p>
                  <p className="text-xs text-muted-foreground">{c.rota ?? '—'}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col lg:col-span-8">
          {!selecionado ? (
            <CardContent className="p-8 text-sm text-muted-foreground">Selecione um veículo.</CardContent>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 p-6">
                <div>
                  <h2 className="text-xl font-bold">
                    {selecionado.motorista} — {selecionado.placa}
                  </h2>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selecionado.statusCaminhao.replace(/_/g, ' ')} · Faturamento:{' '}
                    {selecionado.statusFaturamento?.replace(/_/g, ' ') ?? '—'}
                  </p>
                </div>
                {(pode('LIBERACAO_GERENCIAR') || pode('FATURAMENTO_GERENCIAR') || pode('EXPEDICAO_GERENCIAR')) ? (
                  <Button
                    className="gap-2"
                    disabled={submitting || !checklist?.liberavel || liberado}
                    onClick={() => void liberarSaida()}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    {liberado ? 'Já liberado' : submitting ? 'Liberando…' : 'Liberar Caminhão'}
                  </Button>
                ) : (
                  statusBadge(selecionado)
                )}
              </div>
              <CardContent className="flex flex-1 flex-col gap-4 overflow-auto p-6">
                {/* Banner de confirmação de liberação — LiberacaoCaminhao.tsx:201-215 */}
                {liberado && selecionado.liberacaoSaida && (
                  <div className="bg-[var(--color-success-surface)] border border-[var(--color-success-strong-border)] rounded-xl px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-[var(--color-success-strong)] flex-shrink-0" />
                      <div>
                        <p className="text-[13px] font-bold text-[var(--color-success-strong)]">
                          Caminhão liberado por {selecionado.liberacaoSaida.responsavelNome ?? '—'} em {fmtDataHoraLiberacao(selecionado.liberacaoSaida.dataHora)}
                        </p>
                        <p className="text-[11px] text-[var(--color-success-strong-hover)]">Alterações operacionais bloqueadas para esta carga.</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[var(--color-brand-navy-deep)] text-white">
                      <Lock className="w-3 h-3" /> Liberado — alterações bloqueadas
                    </span>
                  </div>
                )}

                {/* Checklist calculado (D10.6) */}
                <Card>
                  <CardContent className="p-0">
                    <div className="px-5 py-3.5 border-b flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="text-[13px] font-bold">Requisitos para liberação</h3>
                    </div>
                    <div className="px-5 py-1">
                      {checklist?.requisitos.map((r) => (
                        <RequisitoLinha key={r.chave} ok={r.ok} label={r.rotulo} detalhe={r.detalhe} />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Pendências impeditivas */}
                {checklist && !checklist.liberavel && !liberado && (
                  <div className="bg-[var(--color-warning-surface)] border border-[var(--color-provisorio-border)] rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-[var(--color-provisorio-border)] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[var(--color-warning-ink)]" />
                      <h3 className="text-[13px] font-bold text-[var(--color-provisorio-text)]">Pendências impeditivas</h3>
                    </div>
                    <div className="flex flex-col divide-y divide-[var(--color-provisorio-border)]/60">
                      {checklist.requisitos.filter((r) => !r.ok).map((r) => (
                        <div key={r.chave} className="px-5 py-3 flex items-center justify-between gap-3">
                          <p className="text-[12px] text-[var(--color-provisorio-text)]">{r.rotulo} — {r.detalhe}</p>
                          <Link href={LINK_RESOLUCAO[r.chave].href} className="text-[12px] font-semibold text-[var(--color-action-blue-hover)] hover:underline whitespace-nowrap">
                            {LINK_RESOLUCAO[r.chave].texto}
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notas fiscais desta carga — LiberacaoCaminhao.tsx:298-325 */}
                <Card>
                  <CardContent className="p-0">
                    <div className="px-5 py-3.5 border-b flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <h3 className="text-[13px] font-bold">Notas fiscais desta carga</h3>
                    </div>
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-muted)]">
                          <th className="px-4 py-2 text-left text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Nº nota</th>
                          <th className="px-4 py-2 text-left text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notasCarga.length === 0 && (
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-[12px] text-muted-foreground">Nenhuma nota vinculada a esta carga.</td>
                          </tr>
                        )}
                        {notasCarga.map((n) => (
                          <tr key={n.id} className="border-b border-[var(--color-surface-subtle)] last:border-0">
                            <td className="px-4 py-2 font-mono font-bold text-[var(--color-brand-navy-deep)]">{n.numeroNfse ?? '—'}</td>
                            <td className="px-4 py-2">
                              <StatusPill variant={statusNfseVariant(n.statusNfse)} label={rotuloNota(n.statusNfse)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
