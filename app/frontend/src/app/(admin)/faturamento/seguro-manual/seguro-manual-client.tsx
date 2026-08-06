'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Info, Send, CheckCircle2, Paperclip, Clock, ShieldAlert, ShieldCheck, Search,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/ui/page-header';
import { BadgeCount } from '@/components/ui/badge-count';
import { KpiStrip, Kpi } from '@/components/ui/kpi-strip';
import { Card, CardContent } from '@/components/ui/card';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import { SelectNative } from '@/components/ui/select-native';
import { EmptyState } from '@/components/ui/empty-state';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import type { Paginado, SeguroCargaComCaminhao, StatusSeguro } from '@/lib/faturamento';

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Mapeamento StatusPill exigido pela Tarefa 28 — pendente→divergencia, enviado→recebido, confirmado→expedido. */
const STATUS_PILL: Record<StatusSeguro, { variant: StatusPillVariant; label: string }> = {
  pendente: { variant: 'divergencia', label: 'Pendente' },
  enviado: { variant: 'recebido', label: 'Enviado' },
  confirmado: { variant: 'expedido', label: 'Confirmado' },
};

export function SeguroManualClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);

  const [seguros, setSeguros] = useState<SeguroCargaComCaminhao[]>([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusSeguro | 'Todos'>('Todos');
  const [obsEdit, setObsEdit] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [dialogAnexoAbertoPara, setDialogAnexoAbertoPara] = useState<string | null>(null);
  const [anexoNome, setAnexoNome] = useState('');
  const [anexoDescricao, setAnexoDescricao] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set('busca', busca.trim());
      if (filtroStatus !== 'Todos') params.set('status', filtroStatus);
      const res = await fetch(`/api/operacao/faturamento/seguros?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) { setErro('Falha ao carregar seguros'); return; }
      const data = (await res.json()) as Paginado<SeguroCargaComCaminhao>;
      setSeguros(data.data);
      setTotal(data.total);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [busca, filtroStatus]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const onMessage = (msg: RealtimeMensagem) => {
      if (msg.type === 'seguro_atualizado') void carregar();
    };
    const desconectar = conectarRealtime({ rooms: ['dashboard'], onMessage, onReconnect: () => void carregar() });
    return desconectar;
  }, [carregar]);

  const kpis = useMemo(() => ({
    total,
    pendentes: seguros.filter((s) => s.status === 'pendente').length,
    enviados: seguros.filter((s) => s.status === 'enviado').length,
    confirmados: seguros.filter((s) => s.status === 'confirmado').length,
  }), [seguros, total]);

  async function alterarStatus(seguroId: string, status: 'enviado' | 'confirmado') {
    setErro(null);
    setSubmittingId(seguroId);
    try {
      const res = await fetch(`/api/operacao/faturamento/seguros/${seguroId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErro((data as { message?: string }).message ?? 'Falha ao alterar status'); return; }
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmittingId(null);
    }
  }

  async function confirmarAnexo(seguroId: string) {
    setErro(null);
    setSubmittingId(seguroId);
    try {
      const res = await fetch(`/api/operacao/faturamento/seguros/${seguroId}/anexos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: anexoNome.trim(), descricao: anexoDescricao.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErro((data as { message?: string }).message ?? 'Falha ao anexar comprovante'); return; }
      setDialogAnexoAbertoPara(null);
      setAnexoNome('');
      setAnexoDescricao('');
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmittingId(null);
    }
  }

  async function salvarObservacao(seguroId: string, observacao: string) {
    try {
      await fetch(`/api/operacao/faturamento/seguros/${seguroId}/observacao`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observacao }),
      });
    } catch {
      setErro('Erro de conexão ao salvar observação');
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader title="Seguro Manual" subtitle="Controle manual do envio e confirmação do seguro por carga." />

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* KPIs */}
      <KpiStrip>
        <Kpi label="Cargas com seguro" value={kpis.total} hint="no total" tone="default" />
        <Kpi label="Pendentes" value={kpis.pendentes} hint="ainda não enviados" tone="alert" />
        <Kpi label="Enviados" value={kpis.enviados} hint="aguardando confirmação" tone="default" />
        <Kpi label="Confirmados" value={kpis.confirmados} hint="seguro tratado" tone="ok" />
      </KpiStrip>

      {/* Nota informativa */}
      <div className="flex gap-2 rounded-md border border-primary-soft-border bg-info-soft px-3 py-2 text-xs text-info-fg">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>O seguro é tratado manualmente — o sistema apenas registra o status.</span>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-[240px]">
          <Input
            adornLeft={<Search />}
            placeholder="Buscar placa, motorista..."
            className="h-7 text-xs"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <SelectNative
          selectSize="sm"
          className="w-[150px]"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusSeguro | 'Todos')}
        >
          <option value="Todos">Status: Todos</option>
          <option value="pendente">Pendente</option>
          <option value="enviado">Enviado</option>
          <option value="confirmado">Confirmado</option>
        </SelectNative>
        <span className="ml-auto text-[11px] text-muted-foreground">{total} carga(s)</span>
      </div>

      {/* Lista de cargas */}
      {loading ? (
        <p className="text-xs text-muted-foreground" data-testid="loading">Carregando seguros…</p>
      ) : seguros.length === 0 ? (
        <EmptyState icon={<ShieldAlert />} title="Nenhuma carga encontrada para os filtros atuais." className="py-12" />
      ) : (
        <div className="space-y-2.5">
          {seguros.map((s) => {
            const emOperacao = submittingId === s.id;
            const pill = STATUS_PILL[s.status];
            return (
              <Card key={s.id}>
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-data text-[13px] font-bold text-foreground">{s.caminhao.placa}</h3>
                        <StatusPill variant={pill.variant} label={pill.label} />
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        Motorista <span className="font-semibold text-foreground">{s.caminhao.motorista}</span>
                      </p>
                    </div>

                    {s.valorCarga && (
                      <div className="flex-shrink-0 text-right">
                        <p className="text-[10px] font-medium uppercase tracking-[0.04em] text-fg-faint">Valor da carga</p>
                        <p className="font-data text-[16px] font-black text-foreground">{fmtBRL(Number(s.valorCarga))}</p>
                      </div>
                    )}
                  </div>

                  {/* Linha de responsável/data */}
                  <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
                    {s.enviadoEm && (
                      <span className="flex items-center gap-1"><Clock className="size-3 text-fg-faint" /> Enviado: {s.enviadoEm}</span>
                    )}
                    {s.confirmadoEm && (
                      <span className="flex items-center gap-1"><CheckCircle2 className="size-3 text-success-fg" /> Confirmado: {s.confirmadoEm}</span>
                    )}
                    {s.anexosJson.map((a) => (
                      <span key={a.nome} className="flex items-center gap-1 text-primary-fg"><Paperclip className="size-3" /> {a.nome}</span>
                    ))}
                  </div>

                  {/* Observação */}
                  <FormField label="Observação" htmlFor={`obs-seguro-${s.id}`}>
                    <Textarea
                      id={`obs-seguro-${s.id}`}
                      value={obsEdit[s.id] ?? s.observacao ?? ''}
                      onChange={(e) => setObsEdit((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      onBlur={() => void salvarObservacao(s.id, obsEdit[s.id] ?? s.observacao ?? '')}
                      rows={2}
                      placeholder="Observações sobre o seguro desta carga..."
                    />
                  </FormField>

                  {/* Ações */}
                  {pode('SEGURO_GERENCIAR') && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setDialogAnexoAbertoPara(s.id)}>
                        <Paperclip /> Anexar comprovante
                      </Button>

                      {s.status === 'pendente' && (
                        <Button variant="secondary" size="sm" disabled={emOperacao} onClick={() => void alterarStatus(s.id, 'enviado')}>
                          <Send /> Marcar como enviado
                        </Button>
                      )}
                      {s.status === 'enviado' && (
                        <Button size="sm" disabled={emOperacao} onClick={() => void alterarStatus(s.id, 'confirmado')}>
                          <CheckCircle2 /> Marcar como confirmado
                        </Button>
                      )}
                      {s.status === 'confirmado' && (
                        <BadgeCount className="h-7 gap-1.5 bg-success-soft px-3 text-[11px] text-success-fg">
                          <ShieldCheck className="size-3" /> Seguro tratado
                        </BadgeCount>
                      )}
                    </div>
                  )}

                  <Dialog open={dialogAnexoAbertoPara === s.id} onOpenChange={(v) => !v && setDialogAnexoAbertoPara(null)}>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Anexar comprovante</DialogTitle></DialogHeader>
                      <FormField label="Nome do arquivo" htmlFor={`anexo-nome-${s.id}`}>
                        <Input id={`anexo-nome-${s.id}`} value={anexoNome} onChange={(e) => setAnexoNome(e.target.value)} placeholder="averbacao-centro-1130.pdf" />
                      </FormField>
                      <FormField label="Descrição (opcional)" htmlFor={`anexo-descricao-${s.id}`}>
                        <Input id={`anexo-descricao-${s.id}`} value={anexoDescricao} onChange={(e) => setAnexoDescricao(e.target.value)} />
                      </FormField>
                      <DialogFooter>
                        <Button disabled={!anexoNome.trim() || emOperacao} onClick={() => void confirmarAnexo(s.id)}>Anexar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rodapé informativo */}
      <p className="text-[11px] text-fg-faint">
        <Info className="mr-1 inline size-3.5 shrink-0 -translate-y-px" aria-hidden="true" />
        O status do seguro é um dos requisitos para a liberação do caminhão. Cargas com seguro pendente bloqueiam a liberação em &quot;Liberação do Caminhão&quot;.
      </p>
    </div>
  );
}
