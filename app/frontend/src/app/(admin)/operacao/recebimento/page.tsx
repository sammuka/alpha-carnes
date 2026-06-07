'use client';

import { useCallback, useEffect, useState } from 'react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import { TIPOS_DIVERGENCIA, type RecebimentoDetalhe, type TipoDivergencia } from '@/lib/operacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormDivergencia {
  tipo: TipoDivergencia;
  descricao: string;
  acaoImediata: string;
}

export default function RecebimentoPage() {
  const [compraProgramadaId, setCompraProgramadaId] = useState('');
  const [recebimentoId, setRecebimentoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<RecebimentoDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');

  // Estado do formulário de registro por item (quantidade + divergência opcional).
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [divergencias, setDivergencias] = useState<Record<string, FormDivergencia>>({});

  const carregarDetalhe = useCallback(async (id: string) => {
    setErro(null);
    const res = await fetch(`/api/operacao/recebimentos/${id}`, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro((body as { message?: string }).message ?? 'Erro ao carregar recebimento');
      return;
    }
    setDetalhe((await res.json()) as RecebimentoDetalhe);
  }, []);

  useEffect(() => {
    if (recebimentoId) void carregarDetalhe(recebimentoId);
  }, [recebimentoId, carregarDetalhe]);

  // Tempo real: ao receber eventos do recebimento, recarrega o detalhe; reconexão refaz fetch.
  useEffect(() => {
    if (!detalhe) return;
    const onMessage = (msg: RealtimeMensagem) => {
      if (
        msg.type === 'recebimento_registrado' ||
        msg.type === 'divergencia_recebimento_aberta' ||
        msg.type === 'divergencia_recebimento_atualizada'
      ) {
        if (recebimentoId) void carregarDetalhe(recebimentoId);
      }
    };
    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${detalhe.dataOperacao}`],
      onMessage,
      onReconnect: () => recebimentoId && void carregarDetalhe(recebimentoId),
      onStatus: setStatus,
    });
    return desconectar;
  }, [detalhe, recebimentoId, carregarDetalhe]);

  const iniciar = async () => {
    setErro(null);
    const res = await fetch('/api/operacao/recebimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compraProgramadaId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao iniciar recebimento');
      return;
    }
    setRecebimentoId((body as { recebimento: { id: string } }).recebimento.id);
  };

  const registrarItem = async (itemComercialId: string) => {
    if (!recebimentoId) return;
    setErro(null);
    const quantidadeRecebida = Number(quantidades[itemComercialId] ?? '');
    const div = divergencias[itemComercialId];
    const payload: Record<string, unknown> = { itemComercialId, quantidadeRecebida };
    if (div) payload.divergencia = div;

    const res = await fetch(`/api/operacao/recebimentos/${recebimentoId}/itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao registrar item');
      return;
    }
    await carregarDetalhe(recebimentoId);
  };

  const concluir = async () => {
    if (!recebimentoId) return;
    setErro(null);
    const res = await fetch(`/api/operacao/recebimentos/${recebimentoId}/concluir`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao concluir recebimento');
      return;
    }
    await carregarDetalhe(recebimentoId);
  };

  const setQtd = (itemId: string, valor: string) => setQuantidades((p) => ({ ...p, [itemId]: valor }));
  const toggleDivergencia = (itemId: string, on: boolean) =>
    setDivergencias((p) => {
      const next = { ...p };
      if (on) next[itemId] = { tipo: 'quantidade_menor', descricao: '', acaoImediata: '' };
      else delete next[itemId];
      return next;
    });
  const setDivCampo = (itemId: string, campo: keyof FormDivergencia, valor: string) =>
    setDivergencias((p) => ({ ...p, [itemId]: { ...p[itemId]!, [campo]: valor } }));

  const temDivergenciaAberta = (detalhe?.divergencias ?? []).some((d) => d.status === 'aberta');
  const concluido = detalhe?.status === 'concluido';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Recebimento</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            status === 'conectado' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
          }`}
          aria-label={`Tempo real ${status}`}
        >
          {status === 'conectado' ? '● tempo real' : '○ reconectando'}
        </span>
      </div>

      {!recebimentoId && (
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="compra">Compra programada (confirmada)</Label>
            <Input id="compra" value={compraProgramadaId} onChange={(e) => setCompraProgramadaId(e.target.value)} />
          </div>
          <Button onClick={iniciar} disabled={!compraProgramadaId}>
            Iniciar recebimento
          </Button>
        </div>
      )}

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {detalhe && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Status: <strong data-testid="receb-status">{detalhe.status}</strong> — data {detalhe.dataOperacao}
          </p>

          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="border border-border p-2 text-left font-medium">Item</th>
                <th className="border border-border p-2 text-right font-medium">Esperado</th>
                <th className="border border-border p-2 text-right font-medium">Recebido</th>
                <th className="border border-border p-2 text-left font-medium">Apuração</th>
                <th className="border border-border p-2 text-left font-medium">Conferir</th>
              </tr>
            </thead>
            <tbody>
              {detalhe.itens.map((item) => {
                const div = divergencias[item.itemComercialId];
                return (
                  <tr key={item.id} data-testid={`item-${item.itemComercialId}`}>
                    <td className="border border-border p-2 font-mono text-xs">{item.itemComercialId}</td>
                    <td className="border border-border p-2 text-right">{item.quantidadeEsperada}</td>
                    <td className="border border-border p-2 text-right">{item.quantidadeRecebida}</td>
                    <td className="border border-border p-2">{item.statusApuracao}</td>
                    <td className="border border-border p-2">
                      {!concluido && (
                        <div className="space-y-2">
                          <Input
                            type="number"
                            step="0.001"
                            aria-label={`Quantidade recebida ${item.itemComercialId}`}
                            value={quantidades[item.itemComercialId] ?? ''}
                            onChange={(e) => setQtd(item.itemComercialId, e.target.value)}
                          />
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={Boolean(div)}
                              onChange={(e) => toggleDivergencia(item.itemComercialId, e.target.checked)}
                            />
                            Registrar divergência
                          </label>
                          {div && (
                            <div className="space-y-1 rounded-md border border-border p-2">
                              <select
                                aria-label={`Tipo de divergência ${item.itemComercialId}`}
                                value={div.tipo}
                                onChange={(e) => setDivCampo(item.itemComercialId, 'tipo', e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-card px-2 text-xs"
                              >
                                {TIPOS_DIVERGENCIA.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <Input
                                aria-label={`Descrição da divergência ${item.itemComercialId}`}
                                placeholder="Descrição"
                                value={div.descricao}
                                onChange={(e) => setDivCampo(item.itemComercialId, 'descricao', e.target.value)}
                              />
                              <Input
                                aria-label={`Ação imediata ${item.itemComercialId}`}
                                placeholder="Ação imediata"
                                value={div.acaoImediata}
                                onChange={(e) => setDivCampo(item.itemComercialId, 'acaoImediata', e.target.value)}
                              />
                            </div>
                          )}
                          <Button
                            type="button"
                            onClick={() => registrarItem(item.itemComercialId)}
                            disabled={div ? !div.descricao || !div.acaoImediata : false}
                          >
                            Registrar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {detalhe.divergencias.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <h2 className="mb-2 font-medium">Divergências</h2>
              <ul className="space-y-1 text-sm">
                {detalhe.divergencias.map((d) => (
                  <li key={d.id} data-testid={`diverg-${d.id}`}>
                    <strong>{d.tipo}</strong> — {d.descricao} <em>({d.status})</em>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!concluido && (
            <div>
              <Button onClick={concluir} disabled={temDivergenciaAberta} data-testid="btn-concluir">
                Concluir recebimento
              </Button>
              {temDivergenciaAberta && (
                <p className="mt-1 text-xs text-destructive">
                  Há divergência sem tratativa registrada — trate antes de concluir.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
