'use client';

import { useCallback, useEffect, useState } from 'react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import type { DisponibilidadeDia } from '@/lib/comercial';

// Data operacional padrão: hoje (YYYY-MM-DD).
function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DisponibilidadePage() {
  const [dataOperacao, setDataOperacao] = useState(hojeISO());
  const [linhas, setLinhas] = useState<DisponibilidadeDia[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');

  const refetch = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/comercial/disponibilidade?dataOperacao=${dataOperacao}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Erro ao carregar disponibilidade');
        return;
      }
      setLinhas((await res.json()) as DisponibilidadeDia[]);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
    }
  }, [dataOperacao]);

  // Fetch inicial + a cada troca de data.
  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Assinatura WebSocket: atualiza a linha afetada SEM refetch; reconexão refaz o fetch.
  useEffect(() => {
    const onMessage = (msg: RealtimeMensagem) => {
      if (msg.type === 'reserva_disponibilidade_atualizada') {
        const p = msg.payload as {
          disponibilidadeId: string;
          quantidadeReservada: string;
          quantidadeDisponivel: string;
        };
        setLinhas((prev) =>
          prev.map((l) =>
            l.id === p.disponibilidadeId
              ? { ...l, quantidadeReservada: p.quantidadeReservada, quantidadeDisponivel: p.quantidadeDisponivel }
              : l,
          ),
        );
      } else if (msg.type === 'disponibilidade_virtual_gerada') {
        // Saldo novo gerado para o dia → refetch para trazer as novas linhas.
        void refetch();
      }
    };

    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${dataOperacao}`],
      onMessage,
      onReconnect: () => void refetch(),
      onStatus: setStatus,
    });
    return desconectar;
  }, [dataOperacao, refetch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Disponibilidade do dia</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            status === 'conectado' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
          }`}
          aria-label={`Tempo real ${status}`}
        >
          {status === 'conectado' ? '● tempo real' : '○ reconectando'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="data" className="text-sm text-muted-foreground">
          Data operacional
        </label>
        <input
          id="data"
          type="date"
          value={dataOperacao}
          onChange={(e) => setDataOperacao(e.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma disponibilidade para esta data.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="border border-border p-2 text-left font-medium">Item comercial</th>
              <th className="border border-border p-2 text-right font-medium">Total</th>
              <th className="border border-border p-2 text-right font-medium">Reservado</th>
              <th className="border border-border p-2 text-right font-medium">Disponível</th>
              <th className="border border-border p-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="hover:bg-muted/50" data-testid={`disp-${l.id}`}>
                <td className="border border-border p-2 font-mono text-xs">{l.itemComercialId}</td>
                <td className="border border-border p-2 text-right">{l.quantidadeTotalGerada}</td>
                <td className="border border-border p-2 text-right">{l.quantidadeReservada}</td>
                <td className="border border-border p-2 text-right font-medium" data-testid={`disp-${l.id}-disponivel`}>
                  {l.quantidadeDisponivel}
                </td>
                <td className="border border-border p-2">{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
