'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, Lock, Search, ShieldCheck, Truck, XCircle, AlertTriangle } from 'lucide-react';
import type { StatusCaminhao } from '@/lib/operacao';
import { statusCaminhaoVariant, statusNfseVariant } from '@/lib/status-ui';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { KpiStrip, Kpi } from '@/components/ui/kpi-strip';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table, TableBody, TableCell, TableCellCode, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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
    <div className="flex items-center gap-2 py-1 text-xs">
      {ok ? (
        <CheckCircle2 size={14} className="shrink-0 text-success" />
      ) : (
        <XCircle size={14} className="shrink-0 text-danger-fg" />
      )}
      <span className={cn('font-medium', ok ? 'text-foreground' : 'text-danger-fg')}>{label}</span>
      {detalhe && <span className="ml-auto text-fg-secondary">{detalhe}</span>}
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
    <div className="space-y-3">
      <PageHeader
        title="Liberação do Caminhão"
        subtitle="Checklist calculado a partir do estado real da carga, notas fiscais e seguro. Libera apenas quando todos os requisitos estiverem OK."
      >
        <Input
          adornLeft={<Search />}
          placeholder="Buscar placa…"
          className="h-8 w-[200px]"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* KPIs — LiberacaoCaminhao.tsx:143-156 */}
      <KpiStrip>
        <Kpi label="Cargas no pátio" value={kpis.total} hint="aguardando liberação" tone="default" />
        <Kpi label="Liberáveis agora" value={kpis.liberaveis} hint="todos os requisitos OK" tone="ok" />
        <Kpi label="Com pendência" value={kpis.pendentes} hint="requisitos incompletos" tone="alert" />
        <Kpi label="Liberadas" value={kpis.liberadas} hint="alterações bloqueadas" tone="default" />
      </KpiStrip>

      <div className="grid items-start gap-2.5 lg:grid-cols-[320px_1fr]">
        {/* Master */}
        <Card>
          <CardContent className="flex items-center gap-2 p-2.5">
            <Truck className="size-4 text-primary" />
            <h2 className="text-[13px] font-bold text-foreground">Caminhões no Pátio</h2>
          </CardContent>
          <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
            {loading && <p className="p-3 text-xs text-muted-foreground">Carregando…</p>}
            {!loading && filtrados.length === 0 && (
              <EmptyState icon={<Truck />} title="Nenhum veículo encontrado." className="py-12" />
            )}
            {!loading &&
              filtrados.map((c) => {
                const selecionadoAtual = selecionado?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelecionado(c)}
                    className={cn(
                      'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2',
                      selecionadoAtual && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <b className="min-w-0 flex-1 truncate font-data text-[13px] font-bold">{c.placa}</b>
                      {statusBadge(c)}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {c.motorista} · {c.rota ?? '—'}
                    </span>
                  </button>
                );
              })}
          </div>
        </Card>

        {/* Detail */}
        <Card>
          {!selecionado ? (
            <CardContent className="p-8">
              <EmptyState icon={<Truck />} title="Selecione um veículo." />
            </CardContent>
          ) : (
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-foreground">
                    {selecionado.motorista} — {selecionado.placa}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selecionado.statusCaminhao.replace(/_/g, ' ')} · Faturamento:{' '}
                    {selecionado.statusFaturamento?.replace(/_/g, ' ') ?? '—'}
                  </p>
                </div>
                {(pode('LIBERACAO_GERENCIAR') || pode('FATURAMENTO_GERENCIAR') || pode('EXPEDICAO_GERENCIAR')) ? (
                  <Button
                    variant={liberado ? 'secondary' : 'default'}
                    disabled={submitting || !checklist?.liberavel || liberado}
                    onClick={() => void liberarSaida()}
                  >
                    {liberado ? (
                      'Já liberado'
                    ) : (
                      <>
                        <CheckCircle2 />
                        {submitting ? 'Liberando…' : 'Liberar Caminhão'}
                      </>
                    )}
                  </Button>
                ) : (
                  statusBadge(selecionado)
                )}
              </div>

              {/* Banner de confirmação de liberação — LiberacaoCaminhao.tsx:201-215 */}
              {liberado && selecionado.liberacaoSaida && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-success-soft-border bg-success-soft p-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-5 shrink-0 text-success-fg" />
                    <div>
                      <p className="text-[13px] font-bold text-success-fg">
                        Caminhão liberado por {selecionado.liberacaoSaida.responsavelNome ?? '—'} em {fmtDataHoraLiberacao(selecionado.liberacaoSaida.dataHora)}
                      </p>
                      <p className="text-[11px] text-success-fg">Alterações operacionais bloqueadas para esta carga.</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-[11px] font-bold text-background">
                    <Lock className="size-3" /> Liberado — alterações bloqueadas
                  </span>
                </div>
              )}

              {/* Checklist calculado (D10.6) */}
              <Card>
                <CardContent className="space-y-0.5 p-3">
                  <h3 className="mb-1 flex items-center gap-2 text-[13px] font-bold">
                    <FileText className="size-4 text-primary" />
                    Requisitos para liberação
                  </h3>
                  {checklist?.requisitos.map((r) => (
                    <RequisitoLinha key={r.chave} ok={r.ok} label={r.rotulo} detalhe={r.detalhe} />
                  ))}
                </CardContent>
              </Card>

              {/* Pendências impeditivas */}
              {checklist && !checklist.liberavel && !liberado && (
                <div className="overflow-hidden rounded-md border border-warning-soft-border bg-warning-soft">
                  <div className="flex items-center gap-2 border-b border-warning-soft-border px-3 py-2">
                    <AlertTriangle className="size-3.5 text-warning-fg" />
                    <h3 className="text-[13px] font-bold text-warning-fg">Pendências impeditivas</h3>
                  </div>
                  <div className="divide-y divide-warning-soft-border">
                    {checklist.requisitos.filter((r) => !r.ok).map((r) => (
                      <div key={r.chave} className="flex items-center justify-between gap-3 px-3 py-2">
                        <p className="text-xs text-warning-fg">{r.rotulo} — {r.detalhe}</p>
                        <Link href={LINK_RESOLUCAO[r.chave].href} className="whitespace-nowrap text-xs font-semibold text-primary-fg hover:underline">
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
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <ShieldCheck className="size-4 text-primary" />
                    <h3 className="text-[13px] font-bold">Notas fiscais desta carga</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Nº nota</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notasCarga.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-muted-foreground">Nenhuma nota vinculada a esta carga.</TableCell>
                        </TableRow>
                      )}
                      {notasCarga.map((n) => (
                        <TableRow key={n.id}>
                          <TableCellCode>{n.numeroNfse ?? '—'}</TableCellCode>
                          <TableCell>
                            <StatusPill variant={statusNfseVariant(n.statusNfse)} label={rotuloNota(n.statusNfse)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
