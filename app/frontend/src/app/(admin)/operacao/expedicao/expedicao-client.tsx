'use client';

import { useCallback, useEffect, useState } from 'react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import { type Caminhao, type StatusCaminhao } from '@/lib/operacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const COR_STATUS: Record<StatusCaminhao, string> = {
  planejado: 'bg-muted text-muted-foreground',
  aguardando_carga: 'bg-yellow-100 text-yellow-800',
  em_carga: 'bg-blue-100 text-blue-800',
  em_conferencia: 'bg-purple-100 text-purple-800',
  fechado: 'bg-orange-100 text-orange-800',
  liberado_faturamento: 'bg-teal-100 text-teal-800',
  faturado: 'bg-cyan-100 text-cyan-800',
  liberado_saida: 'bg-green-100 text-green-800',
  expedido: 'bg-green-200 text-green-900',
};

function StatusBadge({ status }: { status: StatusCaminhao }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${COR_STATUS[status]}`}
      data-testid="status-badge"
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function ExpedicaoClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);

  const [dataOperacao, setDataOperacao] = useState(() => new Date().toISOString().slice(0, 10));
  const [caminhoes, setCaminhoes] = useState<Caminhao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<'conectado' | 'desconectado'>('desconectado');
  const [submitting, setSubmitting] = useState(false);

  const carregarCaminhoes = useCallback(async () => {
    setErro(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes?dataOperacao=${encodeURIComponent(dataOperacao)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Falha ao carregar caminhões');
        return;
      }
      setCaminhoes((await res.json()) as Caminhao[]);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [dataOperacao]);

  useEffect(() => {
    void carregarCaminhoes();
  }, [carregarCaminhoes]);

  useEffect(() => {
    const EVENTOS_EXPEDICAO = new Set([
      'carga_item_adicionado',
      'carga_item_transferido',
      'carga_item_removido',
      'conferencia_concluida',
      'expedicao_fechada',
      'expedicao_reaberta',
    ]);

    const onMessage = (msg: RealtimeMensagem) => {
      if (EVENTOS_EXPEDICAO.has(msg.type)) {
        void carregarCaminhoes();
      }
    };
    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${dataOperacao}`],
      onMessage,
      onReconnect: () => void carregarCaminhoes(),
      onStatus: setRealtimeStatus,
    });
    return desconectar;
  }, [carregarCaminhoes, dataOperacao]);

  async function abrirCarga(caminhaoId: string) {
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/operacao/expedicao/caminhoes/${caminhaoId}/abrir-carga`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Falha ao abrir carga');
        return;
      }
      await carregarCaminhoes();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Expedição</h1>
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
      </div>

      <div className="flex max-w-xs flex-col gap-1">
        <Label htmlFor="data-operacao">Data operacional</Label>
        <Input
          id="data-operacao"
          type="date"
          value={dataOperacao}
          onChange={(e) => setDataOperacao(e.target.value)}
        />
      </div>

      {erro && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {erro}
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground" data-testid="loading">
          Carregando caminhões...
        </p>
      )}

      {!loading && caminhoes !== null && caminhoes.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="sem-caminhoes">
          Nenhum caminhão programado para {dataOperacao}.
        </p>
      )}

      {!loading && caminhoes !== null && caminhoes.length > 0 && (
        <ul className="space-y-3" data-testid="lista-caminhoes">
          {caminhoes.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-border bg-card p-4"
              data-testid="caminhao-item"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    {c.placa} — {c.motorista}
                  </p>
                  {c.rota && (
                    <p className="text-xs text-muted-foreground">Rota: {c.rota}</p>
                  )}
                </div>
                <StatusBadge status={c.statusCaminhao} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {c.statusCaminhao === 'planejado' && pode('EXPEDICAO_GERENCIAR') && (
                  <Button
                    size="sm"
                    onClick={() => abrirCarga(c.id)}
                    disabled={submitting}
                    data-testid="btn-abrir-carga"
                  >
                    Abrir carga
                  </Button>
                )}
                <a
                  href={`/operacao/expedicao/${c.id}`}
                  className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  data-testid="link-detalhe"
                >
                  Ver detalhe
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
