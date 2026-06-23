'use client';

import { useCallback, useEffect, useState } from 'react';
import { Scale, Wifi, WifiOff } from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import {
  DESTINOS_SEM_COBERTURA,
  MOTIVOS_CAPTURA_MANUAL,
  type MotivoCapturaManual,
  type PaginadoRecebimento,
  type Peca,
  type RecebimentoResumo,
  type ResultadoSugestao,
  type StatusDispositivo,
  type StatusDispositivos,
  type SugestaoScored,
} from '@/lib/operacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Mapeamento protótipo → backend: Pedido/Estoque/Desossa → pedido/sobra/corte */
const DESTINOS_UI = [
  { ui: 'Pedido', backend: 'pedido' as const },
  { ui: 'Estoque (sobra)', backend: 'sobra' as const },
  { ui: 'Desossa (corte)', backend: 'corte' as const },
];

const corStatus: Record<StatusDispositivo, string> = {
  disponivel: 'bg-green-100 text-green-800',
  instavel: 'bg-yellow-100 text-yellow-800',
  indisponivel: 'bg-red-100 text-red-800',
};

function BadgeDispositivo({ rotulo, status }: { rotulo: string; status?: StatusDispositivo }) {
  const cls = status ? corStatus[status] : 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {status === 'disponivel' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {rotulo}: {status ?? '—'}
    </span>
  );
}

export function PesagemDestinacaoClient({ permissoes }: { permissoes: string[] }) {
  const podePesar = permissoes.includes('PESAGEM_GERENCIAR');
  const podeAssociar = permissoes.includes('ASSOCIACAO_GERENCIAR');
  const podeManual = permissoes.includes('PESO_MANUAL');
  const podeEtiqueta = permissoes.includes('ETIQUETA_GERENCIAR');

  const [recebimentos, setRecebimentos] = useState<RecebimentoResumo[]>([]);
  const [recebimentoId, setRecebimentoId] = useState('');
  const [itemComercialBaseId, setItemComercialBaseId] = useState('');
  const [dataOperacao, setDataOperacao] = useState('');
  const [destinoUi, setDestinoUi] = useState('Pedido');
  const [motivoSobra, setMotivoSobra] = useState('');

  const [dispositivos, setDispositivos] = useState<StatusDispositivos | null>(null);
  const [peca, setPeca] = useState<Peca | null>(null);
  const [sugestao, setSugestao] = useState<ResultadoSugestao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');
  const [submitting, setSubmitting] = useState(false);
  const [manualAberto, setManualAberto] = useState(false);
  const [pesoManual, setPesoManual] = useState('');
  const [motivo, setMotivo] = useState<MotivoCapturaManual>('dispositivo_indisponivel');

  const carregarRecebimentos = useCallback(async () => {
    const res = await fetch('/api/operacao/recebimentos?pageSize=30', { cache: 'no-store' });
    if (res.ok) {
      const pag = (await res.json()) as PaginadoRecebimento;
      setRecebimentos(pag.data.filter((r) => r.status !== 'concluido'));
      if (pag.data[0] && !recebimentoId) {
        setRecebimentoId(pag.data[0].id);
        setDataOperacao(pag.data[0].dataOperacao);
      }
    }
  }, [recebimentoId]);

  const carregarStatus = useCallback(async () => {
    const res = await fetch('/api/operacao/pesagem/dispositivos/status', { cache: 'no-store' });
    if (res.ok) setDispositivos((await res.json()) as StatusDispositivos);
  }, []);

  useEffect(() => {
    void carregarRecebimentos();
    void carregarStatus();
  }, [carregarRecebimentos, carregarStatus]);

  useEffect(() => {
    const rec = recebimentos.find((r) => r.id === recebimentoId);
    if (rec) setDataOperacao(rec.dataOperacao);
  }, [recebimentoId, recebimentos]);

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

  const pesar = async (modo: 'automatico' | 'manual_assistido') => {
    const body =
      modo === 'automatico'
        ? { recebimentoId, itemComercialBaseId, modoCaptura: 'automatico' }
        : {
            recebimentoId,
            itemComercialBaseId,
            modoCaptura: 'manual_assistido',
            pesoManual: Number(pesoManual),
            motivo,
          };
    const p = await chamar<Peca>('/api/operacao/pesagem/pecas', body);
    if (p) {
      setPeca(p);
      setSugestao(null);
      setManualAberto(false);
    }
  };

  const sugerir = async () => {
    if (!peca) return;
    const res = await fetch(`/api/operacao/pesagem/pecas/${peca.id}/sugestao`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((data as { message?: string }).message ?? 'Falha ao sugerir');
      return;
    }
    setSugestao(data as ResultadoSugestao);
  };

  const confirmarPedido = async (s: SugestaoScored) => {
    if (!peca) return;
    const p = await chamar<Peca>(`/api/operacao/pesagem/pecas/${peca.id}/confirmar`, {
      pedidoVendaItemId: s.pedidoVendaItemId,
    });
    if (p) {
      setPeca(p);
      setSugestao(null);
    }
  };

  const destinarSemCobertura = async () => {
    if (!peca) return;
    const map = DESTINOS_UI.find((d) => d.ui === destinoUi);
    if (!map || map.backend === 'pedido') return;
    const destino = map.backend;
    if (!DESTINOS_SEM_COBERTURA.includes(destino)) return;
    const body: Record<string, unknown> = { destino };
    if (destino === 'sobra') body.motivo = motivoSobra || 'Destinação operacional para estoque';
    const p = await chamar<Peca>(`/api/operacao/pesagem/pecas/${peca.id}/sem-cobertura`, body);
    if (p) setPeca(p);
  };

  const emitirEtiqueta = async () => {
    if (!peca) return;
    const r = await chamar<{ peca: Peca }>(`/api/operacao/pesagem/pecas/${peca.id}/etiqueta`);
    if (r) setPeca(r.peca);
  };

  const balancaIndisponivel = dispositivos?.balanca.status !== 'disponivel';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pesagem & destinação</h1>
          <p className="text-sm text-muted-foreground">Captura de peso e destino da peça (pedido / estoque / desossa)</p>
        </div>
        <Badge variant="outline" className={status === 'conectado' ? 'border-green-200 bg-green-50 text-green-700' : ''}>
          {status === 'conectado' ? '● tempo real' : '○ reconectando'}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2" data-testid="status-dispositivos">
        <BadgeDispositivo rotulo="Balança" status={dispositivos?.balanca.status} />
        <BadgeDispositivo rotulo="Impressora" status={dispositivos?.impressora.status} />
        <BadgeDispositivo rotulo="Leitor" status={dispositivos?.leitor.status} />
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Captura</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Recebimento (lote)</Label>
                <Select value={recebimentoId} onValueChange={setRecebimentoId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {recebimentos.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.dataOperacao} — {r.id.slice(0, 8)}… ({r.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Item comercial base</Label>
                <Input className="mt-1 font-mono text-xs" value={itemComercialBaseId} onChange={(e) => setItemComercialBaseId(e.target.value)} />
              </div>
              <div>
                <Label>Destino pretendido</Label>
                <Select value={destinoUi} onValueChange={setDestinoUi}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINOS_UI.map((d) => (
                      <SelectItem key={d.ui} value={d.ui}>
                        {d.ui}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {podePesar && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => pesar('automatico')} disabled={!recebimentoId || !itemComercialBaseId || submitting}>
                  Pesar automático
                </Button>
                {podeManual && (
                  <Button variant="outline" onClick={() => setManualAberto((v) => !v)}>
                    Peso manual
                  </Button>
                )}
              </div>
            )}
            {manualAberto && podeManual && (
              <div className="space-y-2 rounded border p-3">
                <Input type="number" step="0.001" placeholder="Peso (kg)" value={pesoManual} onChange={(e) => setPesoManual(e.target.value)} />
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as MotivoCapturaManual)}
                  className="h-9 w-full rounded-md border px-2 text-sm"
                >
                  {MOTIVOS_CAPTURA_MANUAL.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <Button onClick={() => pesar('manual_assistido')} disabled={!pesoManual}>
                  Confirmar peso manual
                </Button>
              </div>
            )}
            {balancaIndisponivel && (
              <p className="text-xs text-amber-700">Balança indisponível — use peso manual assistido.</p>
            )}
          </CardContent>
        </Card>

        {peca && (
          <Card>
            <CardContent className="space-y-4 p-6" data-testid="peca-atual">
              <h2 className="font-semibold">Peça {peca.id.slice(0, 8)}…</h2>
              <p className="text-sm text-muted-foreground">
                {peca.pesoOriginal} kg — <strong data-testid="peca-status">{peca.statusPeca}</strong>
              </p>

              {peca.statusPeca === 'pesada' && destinoUi === 'Pedido' && (
                <Button variant="outline" onClick={sugerir} disabled={submitting}>
                  Sugerir pedido
                </Button>
              )}

              {peca.statusPeca === 'pesada' && destinoUi !== 'Pedido' && podeAssociar && (
                <div className="space-y-2">
                  {destinoUi === 'Estoque (sobra)' && (
                    <Input placeholder="Motivo (sobra)" value={motivoSobra} onChange={(e) => setMotivoSobra(e.target.value)} />
                  )}
                  <Button onClick={destinarSemCobertura} disabled={submitting}>
                    Destinar para {destinoUi}
                  </Button>
                </div>
              )}

              {sugestao?.sugestao && podeAssociar && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="font-medium">Sugerido: pedido {sugestao.sugestao.pedidoVendaId.slice(0, 8)}…</p>
                  <p className="text-xs text-muted-foreground">{sugestao.sugestao.justificativa}</p>
                  <Button className="mt-2" size="sm" onClick={() => confirmarPedido(sugestao.sugestao!)}>
                    Confirmar associação
                  </Button>
                </div>
              )}

              {(peca.statusPeca === 'associada' || peca.statusPeca === 'em_sobra' || peca.statusPeca === 'para_corte') &&
                podeEtiqueta && (
                  <Button onClick={emitirEtiqueta} disabled={submitting || Boolean(peca.etiquetaAtual)}>
                    {peca.etiquetaAtual ? `Etiqueta: ${peca.etiquetaAtual}` : 'Emitir etiqueta'}
                  </Button>
                )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
