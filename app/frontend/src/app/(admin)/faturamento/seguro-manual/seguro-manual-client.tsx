'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Info, Send, CheckCircle2, Paperclip, Clock, ShieldAlert, ShieldCheck, Search,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import type { Paginado, SeguroCargaComCaminhao, StatusSeguro } from '@/lib/faturamento';

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_STYLE: Record<StatusSeguro, { bg: string; text: string; dot: string; icon: typeof ShieldAlert; label: string }> = {
  pendente:   { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', dot: 'bg-[#F59E0B]', icon: ShieldAlert, label: 'Pendente' },
  enviado:    { bg: 'bg-[#EFF6FF]', text: 'text-[#1D4ED8]', dot: 'bg-[#60A5FA]', icon: Send, label: 'Enviado' },
  confirmado: { bg: 'bg-[#F0FDF4]', text: 'text-[#15803D]', dot: 'bg-[#22C55E]', icon: ShieldCheck, label: 'Confirmado' },
};

function StatusBadge({ status }: { status: StatusSeguro }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}

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
    <div className="flex flex-col gap-4 h-full">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] text-[#94A3B8] font-medium mb-0.5">Faturamento / Seguro Manual</p>
          <h1 className="text-[20px] font-bold text-[#1E293B]">Seguro Manual</h1>
          <p className="text-[12px] text-[#64748B] mt-0.5">Controle manual do envio e confirmação do seguro por carga.</p>
        </div>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Cargas com seguro', value: `${kpis.total}`, sub: 'no total', color: 'text-[#1E3A5F]', bg: 'bg-[#F8FAFC]' },
          { label: 'Pendentes', value: `${kpis.pendentes}`, sub: 'ainda não enviados', color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]' },
          { label: 'Enviados', value: `${kpis.enviados}`, sub: 'aguardando confirmação', color: 'text-[#1D4ED8]', bg: 'bg-[#EFF6FF]' },
          { label: 'Confirmados', value: `${kpis.confirmados}`, sub: 'seguro tratado', color: 'text-[#15803D]', bg: 'bg-[#F0FDF4]' },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} className={`border border-[#E2E8F0] rounded-xl px-4 py-3.5 ${bg}`}>
            <p className="text-[11px] text-[#64748B] font-medium mb-1">{label}</p>
            <p className={`text-[26px] font-black leading-none ${color}`}>{value}</p>
            <p className="text-[10px] text-[#94A3B8] mt-1.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-2 bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl px-4 py-3">
        <Info className="w-3.5 h-3.5 text-[#0284C7] flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#0C4A6E]">O seguro é tratado manualmente — o sistema apenas registra o status.</p>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar placa, motorista..."
            className="h-8 w-[280px] rounded-md border border-[#E2E8F0] bg-white pl-8 pr-3 text-[12px] placeholder:text-[#CBD5E1] focus:border-[#2563EB] focus:outline-none"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusSeguro | 'Todos')}
          className="h-8 rounded-md border border-[#E2E8F0] bg-white px-2.5 text-[12px] text-[#475569] focus:border-[#2563EB] focus:outline-none"
        >
          <option value="Todos">Status: Todos</option>
          <option value="pendente">Pendente</option>
          <option value="enviado">Enviado</option>
          <option value="confirmado">Confirmado</option>
        </select>
        <span className="ml-auto text-[11px] text-[#94A3B8]">{total} carga(s)</span>
      </div>

      {/* Lista de cargas */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground p-6" data-testid="loading">Carregando seguros…</p>
        ) : seguros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <ShieldAlert className="w-8 h-8 text-[#CBD5E1]" />
            <p className="text-[13px] text-[#94A3B8]">Nenhuma carga encontrada para os filtros atuais.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[#F1F5F9]">
            {seguros.map((s) => {
              const emOperacao = submittingId === s.id;
              return (
                <div key={s.id} className="px-5 py-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[13px] font-bold text-[#1E293B]">{s.caminhao.placa}</h3>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Motorista <span className="font-semibold text-[#334155]">{s.caminhao.motorista}</span>
                      </p>
                    </div>

                    {s.valorCarga && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-medium">Valor da carga</p>
                        <p className="text-[16px] font-black text-[#1E3A5F]">{fmtBRL(Number(s.valorCarga))}</p>
                      </div>
                    )}
                  </div>

                  {/* Linha de responsável/data */}
                  <div className="flex items-center gap-4 text-[11px] text-[#64748B] flex-wrap">
                    {s.enviadoEm && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[#94A3B8]" /> Enviado: {s.enviadoEm}</span>
                    )}
                    {s.confirmadoEm && (
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#15803D]" /> Confirmado: {s.confirmadoEm}</span>
                    )}
                    {s.anexosJson.map((a) => (
                      <span key={a.nome} className="flex items-center gap-1 text-[#1D4ED8]"><Paperclip className="w-3 h-3" /> {a.nome}</span>
                    ))}
                  </div>

                  {/* Observação */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-[#374151]">Observação</label>
                    <textarea
                      value={obsEdit[s.id] ?? s.observacao ?? ''}
                      onChange={(e) => setObsEdit((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      onBlur={() => void salvarObservacao(s.id, obsEdit[s.id] ?? s.observacao ?? '')}
                      rows={2}
                      placeholder="Observações sobre o seguro desta carga..."
                      className="w-full rounded-md border border-[#E2E8F0] px-2.5 py-2 text-[12px] text-[#1E293B] resize-none focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>

                  {/* Ações */}
                  {pode('SEGURO_GERENCIAR') && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setDialogAnexoAbertoPara(s.id)}
                        className="h-7 px-3 rounded-md border border-[#E2E8F0] text-[#64748B] text-[11px] font-medium hover:bg-[#F8FAFC] flex items-center gap-1.5 transition-colors">
                        <Paperclip className="w-3 h-3" /> Anexar comprovante
                      </button>

                      {s.status === 'pendente' && (
                        <button disabled={emOperacao} onClick={() => void alterarStatus(s.id, 'enviado')}
                          className="h-7 px-3 rounded-md bg-[#2563EB] text-white text-[11px] font-bold hover:bg-[#1D4ED8] flex items-center gap-1.5 transition-colors disabled:opacity-40">
                          <Send className="w-3 h-3" /> Marcar como enviado
                        </button>
                      )}
                      {s.status === 'enviado' && (
                        <button disabled={emOperacao} onClick={() => void alterarStatus(s.id, 'confirmado')}
                          className="h-7 px-3 rounded-md bg-[#15803D] text-white text-[11px] font-bold hover:bg-[#166534] flex items-center gap-1.5 transition-colors disabled:opacity-40">
                          <CheckCircle2 className="w-3 h-3" /> Marcar como confirmado
                        </button>
                      )}
                      {s.status === 'confirmado' && (
                        <span className="h-7 px-3 rounded-md bg-[#F0FDF4] text-[#15803D] text-[11px] font-bold flex items-center gap-1.5">
                          <ShieldCheck className="w-3 h-3" /> Seguro tratado
                        </span>
                      )}
                    </div>
                  )}

                  <Dialog open={dialogAnexoAbertoPara === s.id} onOpenChange={(v) => !v && setDialogAnexoAbertoPara(null)}>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Anexar comprovante</DialogTitle></DialogHeader>
                      <div className="space-y-3 p-1">
                        <div>
                          <Label htmlFor={`anexo-nome-${s.id}`}>Nome do arquivo</Label>
                          <Input id={`anexo-nome-${s.id}`} value={anexoNome} onChange={(e) => setAnexoNome(e.target.value)} placeholder="averbacao-centro-1130.pdf" />
                        </div>
                        <div>
                          <Label htmlFor={`anexo-descricao-${s.id}`}>Descrição (opcional)</Label>
                          <Input id={`anexo-descricao-${s.id}`} value={anexoDescricao} onChange={(e) => setAnexoDescricao(e.target.value)} />
                        </div>
                        <Button disabled={!anexoNome.trim() || emOperacao} onClick={() => void confirmarAnexo(s.id)}>Anexar</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rodapé informativo */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-5 py-3.5 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-[#94A3B8] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#94A3B8] leading-snug">
          O status do seguro é um dos requisitos para a liberação do caminhão. Cargas com seguro pendente bloqueiam a liberação em &quot;Liberação do Caminhão&quot;.
        </p>
      </div>
    </div>
  );
}
