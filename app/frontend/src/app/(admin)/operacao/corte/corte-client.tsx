'use client';

import { useCallback, useEffect, useState } from 'react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import {
  TIPOS_TRANSFORMACAO,
  MOTIVOS_TRANSFORMACAO,
  MODOS_CAPTURA,
  MOTIVOS_CAPTURA_MANUAL,
  type TipoTransformacao,
  type MotivoTransformacao,
  type MotivoCapturaManual,
  type Transformacao,
  type Subitem,
  type CorteDetalhe,
  type StatusDispositivos,
  type StatusDispositivo,
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

interface SugestaoSubitem {
  subitemId: string;
  sugestao: SugestaoScored | null;
  compativeis: SugestaoScored[];
}

export function CorteClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);

  const [pecaId, setPecaId] = useState('');
  const [tipoTransformacao, setTipoTransformacao] = useState<TipoTransformacao>('subdivisao');
  const [motivo, setMotivo] = useState<MotivoTransformacao>('necessidade_operacional');
  const [dataOperacao, setDataOperacao] = useState('');
  const [dispositivos, setDispositivos] = useState<StatusDispositivos | null>(null);
  const [corte, setCorte] = useState<CorteDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');
  const [submitting, setSubmitting] = useState(false);
  const [itemComercialSubitemId, setItemComercialSubitemId] = useState('');
  const [pedidoItemPorSubitem, setPedidoItemPorSubitem] = useState<Record<string, string>>({});

  // Pesar subitem — campos de captura manual
  const [manualAberto, setManualAberto] = useState<string | null>(null); // subitemId ou null
  const [pesoManual, setPesoManual] = useState('');
  const [motivoCaptura, setMotivoCaptura] = useState<MotivoCapturaManual>('dispositivo_indisponivel');
  // Justificativa de diferença de peso
  const [justificativaDif, setJustificativaDif] = useState('');

  const carregarStatus = useCallback(async () => {
    const res = await fetch('/api/operacao/pesagem/dispositivos/status', { cache: 'no-store' });
    if (res.ok) setDispositivos((await res.json()) as StatusDispositivos);
  }, []);

  const carregarDetalhe = useCallback(async (id: string) => {
    const res = await fetch(`/api/operacao/corte/${id}`, { cache: 'no-store' });
    if (res.ok) setCorte((await res.json()) as CorteDetalhe);
  }, []);

  useEffect(() => { void carregarStatus(); }, [carregarStatus]);

  useEffect(() => {
    if (!dataOperacao) return;
    const onMessage = (msg: RealtimeMensagem) => {
      if (
        msg.type === 'corte_iniciado' ||
        msg.type === 'subitem_gerado' ||
        msg.type === 'subitem_pesado' ||
        msg.type === 'subitem_associado' ||
        msg.type === 'corte_concluido' ||
        msg.type === 'dispositivo_status_alterado'
      ) {
        void carregarStatus();
        if (corte) void carregarDetalhe(corte.transformacao.id);
      }
    };
    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${dataOperacao}`],
      onMessage,
      onReconnect: () => {
        void carregarStatus();
        if (corte) void carregarDetalhe(corte.transformacao.id);
      },
      onStatus: setStatus,
    });
    return desconectar;
  }, [dataOperacao, corte, carregarStatus, carregarDetalhe]);

  async function chamar<T>(url: string, body?: unknown): Promise<T | null> {
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : '{}',
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

  const iniciar = async () => {
    const t = await chamar<Transformacao>(`/api/operacao/corte/pecas/${pecaId}/iniciar`, {
      tipoTransformacao,
      motivo,
    });
    if (t) {
      await carregarDetalhe(t.id);
    }
  };

  const adicionarSubitem = async () => {
    if (!corte) return;
    const s = await chamar<Subitem>(`/api/operacao/corte/${corte.transformacao.id}/subitens`, {
      itemComercialId: itemComercialSubitemId,
    });
    if (s) {
      setItemComercialSubitemId('');
      await carregarDetalhe(corte.transformacao.id);
    }
  };

  const pesarAuto = async (subitemId: string) => {
    const s = await chamar<Subitem>(`/api/operacao/corte/subitens/${subitemId}/pesar`, {
      modoCaptura: 'automatico',
    });
    if (s && corte) await carregarDetalhe(corte.transformacao.id);
  };

  const pesarManual = async (subitemId: string) => {
    const s = await chamar<Subitem>(`/api/operacao/corte/subitens/${subitemId}/pesar`, {
      modoCaptura: 'manual_assistido',
      pesoManual: Number(pesoManual),
      motivo: motivoCaptura,
    });
    if (s && corte) {
      setManualAberto(null);
      setPesoManual('');
      await carregarDetalhe(corte.transformacao.id);
    }
  };

  const associar = async (subitemId: string, pedidoVendaItemId: string) => {
    const s = await chamar<Subitem>(`/api/operacao/corte/subitens/${subitemId}/associar`, { pedidoVendaItemId });
    if (s && corte) await carregarDetalhe(corte.transformacao.id);
  };

  const sugerirSubitem = async (subitemId: string) => {
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/operacao/corte/subitens/${subitemId}/sugestao`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Falha ao sugerir pedido');
        return;
      }
      const sugestao = data as SugestaoSubitem;
      if (!sugestao.sugestao) {
        setErro('Nenhum pedido compatível em aberto para este subitem');
        return;
      }
      setPedidoItemPorSubitem((prev) => ({
        ...prev,
        [subitemId]: sugestao.sugestao!.pedidoVendaItemId,
      }));
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  const reetiquetar = async (subitemId: string) => {
    const r = await chamar<{ subitem: Subitem }>(`/api/operacao/corte/subitens/${subitemId}/etiqueta`);
    if (r && corte) await carregarDetalhe(corte.transformacao.id);
  };

  const concluir = async () => {
    if (!corte) return;
    const diferenca = corte.transformacao.diferencaPeso;
    const body = diferenca && diferenca !== '0.000' ? { justificativaDiferenca: justificativaDif } : {};
    const t = await chamar<Transformacao>(`/api/operacao/corte/${corte.transformacao.id}/concluir`, body);
    if (t) await carregarDetalhe(corte.transformacao.id);
  };

  // Calcular Σ pesos dos subitens (só exibição)
  const somaSubitens = corte
    ? corte.subitens.reduce((acc, s) => acc + Number(s.peso ?? 0), 0).toFixed(3)
    : '0.000';
  const balancaIndisponivel = dispositivos?.balanca.status !== 'disponivel';

  // Suppress unused import warning — MODOS_CAPTURA is imported for parity with spec
  void MODOS_CAPTURA;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Corte / Transformação</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${status === 'conectado' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}
          aria-label={`Tempo real ${status}`}
        >
          {status === 'conectado' ? '● tempo real' : '○ reconectando'}
        </span>
      </div>

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

      {!corte && (
        <section className="rounded-md border border-border p-4 space-y-3">
          <h2 className="font-medium">Iniciar transformação</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="pecaId">Peça (id)</Label>
              <Input id="pecaId" value={pecaId} onChange={(e) => setPecaId(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="dataOp">Data operação (sala WS)</Label>
              <Input id="dataOp" placeholder="YYYY-MM-DD" value={dataOperacao} onChange={(e) => setDataOperacao(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tipo">Tipo de transformação</Label>
              <select
                id="tipo"
                value={tipoTransformacao}
                onChange={(e) => setTipoTransformacao(e.target.value as TipoTransformacao)}
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                {TIPOS_TRANSFORMACAO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="motivo">Motivo</Label>
              <select
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoTransformacao)}
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                {MOTIVOS_TRANSFORMACAO.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {pode('CORTE_GERENCIAR') && (
            <Button onClick={iniciar} disabled={!pecaId || submitting}>
              Iniciar corte
            </Button>
          )}
        </section>
      )}

      {corte && (
        <section className="rounded-md border border-border p-4 space-y-4" data-testid="corte-atual">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Transformação {corte.transformacao.id.slice(0, 8)}</h2>
            <span className="text-sm text-muted-foreground">
              Status: <strong>{corte.transformacao.statusTransformacao}</strong>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>Peso original: <strong>{corte.transformacao.pesoOriginal} kg</strong></div>
            <div>Σ subitens: <strong>{somaSubitens} kg</strong></div>
            <div>Diferença: <strong>{(Number(corte.transformacao.pesoOriginal) - Number(somaSubitens)).toFixed(3)} kg</strong></div>
          </div>

          {corte.transformacao.diferencaPeso && corte.transformacao.diferencaPeso !== '0.000' && pode('CORTE_GERENCIAR') && corte.transformacao.statusTransformacao !== 'concluida' && (
            <div>
              <Label htmlFor="justif">Justificativa da diferença de peso</Label>
              <Input id="justif" value={justificativaDif} onChange={(e) => setJustificativaDif(e.target.value)} placeholder="Obrigatório quando há diferença" />
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-medium text-sm">Subitens ({corte.subitens.length})</h3>
            {corte.subitens.map((s) => (
              <div key={s.id} className="rounded border border-border p-2 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Subitem {s.id.slice(0, 8)}</span>
                  <span className="text-muted-foreground">Status: <strong data-testid="subitem-status">{s.statusSubitem}</strong></span>
                </div>
                {s.peso && <div className="text-xs text-muted-foreground">Peso: {s.peso} kg</div>}
                {s.statusSubitem === 'gerado' && pode('CORTE_GERENCIAR') && (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" onClick={() => pesarAuto(s.id)} disabled={balancaIndisponivel || submitting}>
                      Pesar automático
                    </Button>
                    {pode('PESO_MANUAL') && (
                      <Button size="sm" variant="outline" onClick={() => setManualAberto(s.id)} disabled={submitting}>
                        Pesar manual
                      </Button>
                    )}
                  </div>
                )}
                {manualAberto === s.id && (
                  <div className="rounded border p-2 space-y-2">
                    <Input type="number" step="0.001" placeholder="Peso (kg)" value={pesoManual} onChange={(e) => setPesoManual(e.target.value)} />
                    <select value={motivoCaptura} onChange={(e) => setMotivoCaptura(e.target.value as MotivoCapturaManual)} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
                      {MOTIVOS_CAPTURA_MANUAL.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <Button size="sm" onClick={() => pesarManual(s.id)} disabled={!pesoManual || submitting}>Confirmar peso manual</Button>
                  </div>
                )}
                {s.statusSubitem === 'pesado' && pode('CORTE_GERENCIAR') && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <Input
                      aria-label={`Item do pedido ${s.id}`}
                      placeholder="Pedido venda item (id)"
                      value={pedidoItemPorSubitem[s.id] ?? ''}
                      onChange={(e) =>
                        setPedidoItemPorSubitem((prev) => ({
                          ...prev,
                          [s.id]: e.target.value,
                        }))
                      }
                    />
                    <Button size="sm" variant="outline" onClick={() => sugerirSubitem(s.id)} disabled={submitting}>
                      Sugerir pedido
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => associar(s.id, pedidoItemPorSubitem[s.id] ?? '')}
                      disabled={submitting || !pedidoItemPorSubitem[s.id]}
                    >
                      Associar
                    </Button>
                  </div>
                )}
                {s.statusSubitem === 'associado' && pode('ETIQUETA_GERENCIAR') && !s.etiquetaAtual && (
                  <Button size="sm" onClick={() => reetiquetar(s.id)} disabled={submitting}>
                    Emitir etiqueta
                  </Button>
                )}
                {s.etiquetaAtual && <div className="text-xs text-muted-foreground">Etiqueta: <code>{s.etiquetaAtual}</code></div>}
              </div>
            ))}
          </div>

          {pode('CORTE_GERENCIAR') && corte.transformacao.statusTransformacao !== 'concluida' && corte.transformacao.statusTransformacao !== 'cancelada' && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-72 flex-1">
                <Label htmlFor="itemComercialSubitem">Item comercial do subitem</Label>
                <Input
                  id="itemComercialSubitem"
                  placeholder="UUID do item comercial"
                  value={itemComercialSubitemId}
                  onChange={(e) => setItemComercialSubitemId(e.target.value)}
                />
              </div>
              <Button onClick={adicionarSubitem} variant="outline" disabled={submitting || !itemComercialSubitemId}>
                + Adicionar subitem
              </Button>
              <Button
                onClick={concluir}
                disabled={submitting || corte.subitens.some((s) => !s.peso || !['associado', 'em_sobra', 'em_analise'].includes(s.statusSubitem) || !s.etiquetaAtual)}
              >
                Concluir corte
              </Button>
            </div>
          )}

          {corte.transformacao.statusTransformacao === 'concluida' && (
            <p className="text-sm text-green-700 font-medium">✓ Transformação concluída</p>
          )}
        </section>
      )}
    </div>
  );
}
