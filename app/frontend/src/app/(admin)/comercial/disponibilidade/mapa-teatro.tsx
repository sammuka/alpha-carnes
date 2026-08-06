'use client';

import { AlertTriangle } from 'lucide-react';
import type { EstadoMapa, MapaProduto } from '@/lib/mapa-disponibilidade';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { cn } from '@/lib/cn';

const ESTADOS: Array<{ estado: EstadoMapa; label: string }> = [
  { estado: 'F', label: 'Físico disponível' },
  { estado: 'V', label: 'Virtual disponível' },
  { estado: 'R', label: 'Reservado' },
  { estado: 'C', label: 'Confirmado' },
  { estado: 'D', label: 'Em desossa' },
  { estado: 'O', label: 'Overbooking' },
  { estado: 'E', label: 'Expedido' },
  { estado: '!', label: 'Em ocorrência' },
];

const COR_ESTADO: Record<EstadoMapa, string> = {
  F: 'var(--color-status-expedido-dot)',
  V: 'var(--color-status-recebido-dot)',
  R: 'var(--color-status-divergencia-dot)',
  C: 'var(--color-status-recebido-dot)',
  D: 'var(--color-status-pesado-dot)',
  O: 'var(--color-status-bloqueado-dot)',
  E: 'var(--color-status-pendente-dot)',
  '!': 'var(--color-status-divergencia-dot)',
};

interface MapaTeatroProps {
  produtos: MapaProduto[];
  selecionado?: { itemComercialId: string; estado: EstadoMapa } | null;
  onSelecionar: (produto: MapaProduto, estado: EstadoMapa) => void;
}

export function MapaTeatro({ produtos, selecionado, onSelecionar }: MapaTeatroProps) {
  if (produtos.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum produto no catálogo para esta operação.</p>;
  }

  return (
    <div className="space-y-2.5">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[260px_repeat(8,minmax(78px,1fr))] gap-2 border-b border-border bg-surface-2 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Produto</span>
            {ESTADOS.map(({ estado }) => (
              <span key={estado} className="text-center text-[11px] font-bold text-muted-foreground">{estado}</span>
            ))}
          </div>
          <div className="divide-y divide-border">
            {produtos.map((produto) => (
              <div
                key={produto.itemComercialId}
                className="grid grid-cols-[260px_repeat(8,minmax(78px,1fr))] items-center gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{produto.descricao}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="font-data text-[11px] text-fg-secondary">{produto.codigo}</span>
                    {produto.provisorio && <BadgeProvisorio codigo="P11" />}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Saldo comercial: <strong className="text-foreground">{produto.saldoComercial}</strong>
                  </p>
                </div>
                {ESTADOS.map(({ estado, label }) => {
                  const valor = produto.estados[estado];
                  const unidades = produto.unidades[estado];
                  const ativo = selecionado?.itemComercialId === produto.itemComercialId
                    && selecionado.estado === estado;
                  return (
                    <button
                      key={estado}
                      type="button"
                      title={`${label} · ${valor} · ${unidades} unidade(s)`}
                      aria-label={`${produto.codigo} ${label}`}
                      aria-pressed={ativo}
                      className={cn(
                        'min-w-[72px] rounded-md border border-border bg-card px-2 py-1.5 text-center transition-colors hover:border-fg-faint',
                        estado === 'V' && 'border-dashed',
                        ativo && 'border-primary ring-[3px] ring-ring/25',
                      )}
                      onClick={() => onSelecionar(produto, estado)}
                    >
                      <p className="text-[10px] font-bold text-muted-foreground">
                        {estado === '!' ? <AlertTriangle className="mx-auto h-3 w-3" /> : estado}
                      </p>
                      <p className="font-data text-base font-bold">{valor}</p>
                      <span
                        aria-hidden="true"
                        className="mx-auto mt-1 block h-[3px] w-8 rounded-full"
                        style={{ background: COR_ESTADO[estado] }}
                      />
                      <p className="text-[10px] text-fg-faint">{unidades} un.</p>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
        {ESTADOS.map(({ estado, label }) => (
          <div key={estado} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              aria-hidden="true"
              className="inline-block h-[3px] w-5 rounded-full"
              style={{ background: COR_ESTADO[estado] }}
            />
            {estado === '!' ? <AlertTriangle className="h-3 w-3" /> : estado} — {label}
          </div>
        ))}
        <BadgeProvisorio codigo="P11" />
      </div>
    </div>
  );
}
