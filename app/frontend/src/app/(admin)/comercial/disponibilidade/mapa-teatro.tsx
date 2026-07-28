'use client';

import { AlertTriangle } from 'lucide-react';
import type { EstadoMapa, MapaProduto } from '@/lib/mapa-disponibilidade';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';

const ESTADOS: Array<{
  estado: EstadoMapa;
  label: string;
  classe: string;
}> = [
  { estado: 'F', label: 'Físico disponível', classe: 'border-status-expedido bg-status-expedido text-white' },
  { estado: 'V', label: 'Virtual disponível', classe: 'border-2 border-dashed border-primary bg-background text-primary' },
  { estado: 'R', label: 'Reservado', classe: 'border-status-divergencia bg-status-divergencia text-white' },
  { estado: 'C', label: 'Confirmado', classe: 'border-primary bg-primary text-primary-foreground' },
  { estado: 'D', label: 'Em desossa', classe: 'border-status-pesado bg-status-pesado text-white' },
  { estado: 'O', label: 'Overbooking', classe: 'border-destructive bg-destructive text-destructive-foreground' },
  { estado: 'E', label: 'Expedido', classe: 'border-muted-foreground bg-muted-foreground text-background' },
  { estado: '!', label: 'Em ocorrência', classe: 'border-status-divergencia bg-status-divergencia text-white' },
];

interface MapaTeatroProps {
  produtos: MapaProduto[];
  onSelecionar: (produto: MapaProduto, estado: EstadoMapa) => void;
}

export function MapaTeatro({ produtos, onSelecionar }: MapaTeatroProps) {
  if (produtos.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum produto no catálogo para esta operação.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[260px_repeat(8,minmax(78px,1fr))] gap-2 border-b bg-muted/40 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Produto</span>
            {ESTADOS.map(({ estado }) => (
              <span key={estado} className="text-center text-xs font-black text-muted-foreground">{estado}</span>
            ))}
          </div>
          <div className="divide-y">
            {produtos.map((produto) => (
              <div
                key={produto.itemComercialId}
                className="grid grid-cols-[260px_repeat(8,minmax(78px,1fr))] items-center gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{produto.descricao}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{produto.codigo}</span>
                    {produto.provisorio && (
                      <BadgeProvisorio pendencia="P11" texto="Provisório · P11" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Saldo comercial: <strong className="text-foreground">{produto.saldoComercial}</strong>
                  </p>
                </div>
                {ESTADOS.map(({ estado, label, classe }) => {
                  const quantidade = produto.estados[estado];
                  const unidades = produto.unidades[estado];
                  return (
                    <button
                      key={estado}
                      type="button"
                      title={`${label} · ${quantidade} · ${unidades} unidade(s)`}
                      aria-label={`${produto.codigo} ${label}`}
                      className={`flex min-h-16 flex-col items-center justify-center rounded-lg border p-2 transition-transform hover:scale-105 ${classe}`}
                      onClick={() => onSelecionar(produto, estado)}
                    >
                      <span className="text-xs font-black">
                        {estado === '!' ? <AlertTriangle className="h-4 w-4" /> : estado}
                      </span>
                      <span className="mt-1 text-sm font-black">{quantidade}</span>
                      <span className="text-[10px] opacity-80">{unidades} un.</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border bg-muted/30 px-4 py-3">
        {ESTADOS.map(({ estado, label, classe }) => (
          <div key={estado} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`flex h-6 w-6 items-center justify-center rounded border text-[10px] font-black ${classe}`}>
              {estado === '!' ? <AlertTriangle className="h-3 w-3" /> : estado}
            </span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
