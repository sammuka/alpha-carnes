'use client';

import { useCallback, useEffect, useState } from 'react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import {
  MOTIVOS_CAPTURA_MANUAL,
  type MotivoCapturaManual,
  type Peca,
  type ResultadoSugestao,
  type StatusDispositivo,
  type StatusDispositivos,
  type SugestaoScored,
} from '@/lib/operacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const corStatus: Record<StatusDispositivo, string> = {
  disponivel: 'bg-green-100 text-green-800',
  instavel: 'bg-yellow-100 text-yellow-800',
  indisponivel: 'bg-red-100 text-red-800',
};

function Badge({ rotulo, status }: { rotulo: string; status?: StatusDispositivo }) {
  const cls = status ? corStatus[status] : 'bg-muted text-muted-foreground';
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`} aria-label={`${rotulo} ${status ?? 'desconhecido'}`}>
      {rotulo}: {status ?? '—'}
    </span>
  );
}

export function PesagemClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);

  const [recebimentoId, setRecebimentoId] = useState('');
  const [itemComercialBaseId, setItemComercialBaseId] = useState('');
  const [dataOperacao, setDataOperacao] = useState('');
  const [dispositivos, setDispositivos] = useState<StatusDispositivos | null>(null);
  const [peca, setPeca] = useState<Peca | null>(null);
  const [sugestao, setSugestao] = useState<ResultadoSugestao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');
  const [submitting, setSubmitting] = useState(false);

  // Captura manual.
  const [manualAberto, setManualAberto] = useState(false);
  const [pesoManual, setPesoManual] = useState('');
  const [motivo, setMotivo] = useState<MotivoCapturaManual>('dispositivo_indisponivel');

  const carregarStatus = useCallback(async () => {
    const res = await fetch('/api/operacao/pesagem/dispositivos/status', { cache: 'no-store' });
    if (res.ok) setDispositivos((await res.json()) as StatusDispositivos);
  }, []);

  useEffect(() => {
    void carregarStatus();
  }, [carregarStatus]);

  // Tempo real: status de dispositivo e eventos de peça atualizam a tela sem refetch geral.
  useEffect(() => {
    if (!dataOperacao) return;
    const onMessage = (msg: RealtimeMensagem) => {
      if (msg.type === 'dispositivo_status_alterado') void carregarStatus();
    };
    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${dataOperacao}`],
      onMessage,
      onReconnect: carregarStatus,
      onStatus: setStatus,
    });
    return desconectar;
  }, [dataOperacao, carregarStatus]);

  async function chamar<T>(url: string, body?: unknown): Promise<T | null> {
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Falha na operação');
        return null;
      }
      return data as T;
    } catch {
      setErro('Erro de conexão');
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  const pesarAutomatico = async () => {
    const p = await chamar<Peca>('/api/operacao/pesagem/pecas', { recebimentoId, itemComercialBaseId, modoCaptura: 'automatico' });
    if (p) {
      setPeca(p);
      setSugestao(null);
    }
  };

  const pesarManual = async () => {
    const p = await chamar<Peca>('/api/operacao/pesagem/pecas', {
      recebimentoId,
      itemComercialBaseId,
      modoCaptura: 'manual_assistido',
      pesoManual: Number(pesoManual),
      motivo,
    });
    if (p) {
      setPeca(p);
      setSugestao(null);
      setManualAberto(false);
      setPesoManual('');
    }
  };

  const sugerir = async () => {
    if (!peca) return;
    setErro(null);
    const res = await fetch(`/api/operacao/pesagem/pecas/${peca.id}/sugestao`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((data as { message?: string }).message ?? 'Falha ao sugerir');
      return;
    }
    setSugestao(data as ResultadoSugestao);
  };

  const confirmar = async (s: SugestaoScored) => {
    if (!peca) return;
    const p = await chamar<Peca>(`/api/operacao/pesagem/pecas/${peca.id}/confirmar`, { pedidoVendaItemId: s.pedidoVendaItemId });
    if (p) {
      setPeca(p);
      setSugestao(null);
    }
  };

  const emitirEtiqueta = async () => {
    if (!peca) return;
    const r = await chamar<{ peca: Peca }>(`/api/operacao/pesagem/pecas/${peca.id}/etiqueta`);
    if (r) setPeca(r.peca);
  };

  const reimprimir = async () => {
    if (!peca) return;
    await chamar(`/api/operacao/pesagem/pecas/${peca.id}/etiqueta/reimprimir`);
  };

  const balancaIndisponivel = dispositivos?.balanca.status !== 'disponivel';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Pesagem &amp; Associação</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${status === 'conectado' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}
          aria-label={`Tempo real ${status}`}
        >
          {status === 'conectado' ? '● tempo real' : '○ reconectando'}
        </span>
      </div>

      {/* Status dos dispositivos — sempre visível (RA-05) */}
      <div className="flex flex-wrap gap-2" data-testid="status-dispositivos">
        <Badge rotulo="Balança" status={dispositivos?.balanca.status} />
        <Badge rotulo="Impressora" status={dispositivos?.impressora.status} />
        <Badge rotulo="Leitor" status={dispositivos?.leitor.status} />
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* Bloco de captura */}
      <section className="rounded-md border border-border p-4 space-y-3">
        <h2 className="font-medium">Captura de peso</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <Label htmlFor="receb">Recebimento (id)</Label>
            <Input id="receb" value={recebimentoId} onChange={(e) => setRecebimentoId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="item">Item comercial (id)</Label>
            <Input id="item" value={itemComercialBaseId} onChange={(e) => setItemComercialBaseId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="data">Data operação (sala de tempo real)</Label>
            <Input id="data" placeholder="YYYY-MM-DD" value={dataOperacao} onChange={(e) => setDataOperacao(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={pesarAutomatico} disabled={!recebimentoId || !itemComercialBaseId || submitting}>
            Capturar peso automático
          </Button>
          {/* Botão de peso manual gated por PESO_MANUAL (ADR-009) */}
          {pode('PESO_MANUAL') && (
            <Button variant="outline" onClick={() => setManualAberto((v) => !v)} disabled={submitting}>
              Peso manual assistido
            </Button>
          )}
          {balancaIndisponivel && (
            <span className="text-xs text-yellow-700">
              Balança indisponível/instável — use o peso manual assistido.
            </span>
          )}
        </div>

        {manualAberto && pode('PESO_MANUAL') && (
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="peso">Peso (kg)</Label>
                <Input id="peso" type="number" step="0.001" value={pesoManual} onChange={(e) => setPesoManual(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="motivo">Motivo</Label>
                <select
                  id="motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as MotivoCapturaManual)}
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                >
                  {MOTIVOS_CAPTURA_MANUAL.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button onClick={pesarManual} disabled={!pesoManual || submitting}>
              Confirmar peso manual
            </Button>
          </div>
        )}
      </section>

      {/* Peça pesada + associação */}
      {peca && (
        <section className="rounded-md border border-border p-4 space-y-3" data-testid="peca-atual">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Peça {peca.id.slice(0, 8)}</h2>
            <span className="text-sm text-muted-foreground">
              {peca.pesoOriginal} kg — <strong data-testid="peca-status">{peca.statusPeca}</strong> ({peca.modoCapturaPeso})
            </span>
          </div>

          {peca.statusPeca === 'pesada' && (
            <Button variant="outline" onClick={sugerir} disabled={submitting}>
              Sugerir pedido
            </Button>
          )}

          {sugestao && (
            <div className="space-y-2">
              {sugestao.sugestao ? (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
                  <p className="text-sm font-medium">Sugerido: pedido {sugestao.sugestao.pedidoVendaId.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{sugestao.sugestao.justificativa}</p>
                  {pode('ASSOCIACAO_GERENCIAR') && (
                    <Button className="mt-2" onClick={() => confirmar(sugestao.sugestao!)} disabled={submitting}>
                      Confirmar associação
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum pedido compatível em aberto.</p>
              )}

              {sugestao.compativeis.length > 1 && (
                <div className="rounded-md border border-border p-3">
                  <h3 className="mb-2 text-sm font-medium">Outros pedidos compatíveis (redirecionar)</h3>
                  <ul className="space-y-1 text-sm">
                    {sugestao.compativeis.slice(1).map((c) => (
                      <li key={c.pedidoVendaItemId} className="flex items-center justify-between gap-2">
                        <span>
                          pedido {c.pedidoVendaId.slice(0, 8)} — saldo {c.saldoPendente} — {c.justificativa}
                        </span>
                        {pode('ASSOCIACAO_GERENCIAR') && (
                          <Button variant="outline" size="sm" onClick={() => confirmar(c)} disabled={submitting}>
                            Escolher
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Etiqueta — só após associação (RF-PS-23) */}
          {peca.statusPeca === 'associada' && pode('ETIQUETA_GERENCIAR') && (
            <div className="flex items-center gap-2">
              {peca.etiquetaAtual ? (
                <>
                  <span className="text-sm" data-testid="etiqueta-atual">
                    Etiqueta: <code>{peca.etiquetaAtual}</code>
                  </span>
                  <Button variant="outline" size="sm" onClick={reimprimir} disabled={submitting}>
                    Reimprimir
                  </Button>
                </>
              ) : (
                <Button onClick={emitirEtiqueta} disabled={submitting}>
                  Emitir etiqueta
                </Button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
