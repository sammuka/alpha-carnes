import { Info, Scale } from 'lucide-react';

export interface ItemComparativo {
  produtoId: string;
  codigo: string | null;
  descricao: string | null;
  qtdPedido: string;
  qtdNf: string;
  qtdApurada: string;
  pesoNf: string | null;
  pesoApurado: string | null;
  difQtd: string;
  difPeso: string | null;
  situacao?: string;
}

interface QuadroComparativoProps {
  itens: ItemComparativo[];
}

function formatDif(valor: string | null): string {
  if (valor == null) return '—';
  const n = Number(valor);
  if (Number.isNaN(n)) return valor;
  if (n > 0) return `+${valor}`;
  return valor;
}

function ehDivergente(difQtd: string): boolean {
  const n = Number(difQtd);
  return !Number.isNaN(n) && n !== 0;
}

export function QuadroComparativo({ itens }: QuadroComparativoProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <Scale size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground">Quadro comparativo — Pedido × NF × Pesagem</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Produto', 'Pedido: qtd.', 'NF: qtd.', 'Pesado: qtd.', 'NF: peso', 'Peso apurado', 'Dif. qtd.', 'Dif. peso'].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              const divergente = ehDivergente(item.difQtd);
              const produto = item.codigo ?? item.descricao ?? item.produtoId.slice(0, 8);
              return (
                <tr key={item.produtoId} className={`border-b border-border last:border-0 ${divergente ? 'bg-[var(--color-status-divergencia-bg)]/40' : ''}`}>
                  <td className="px-4 py-2.5 font-bold text-primary">{produto}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.qtdPedido}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.qtdNf}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.qtdApurada}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{item.pesoNf ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{item.pesoApurado ?? '—'}</td>
                  <td className={`px-4 py-2.5 font-bold ${divergente ? 'text-[var(--color-status-divergencia)]' : 'text-[var(--color-status-expedido)]'}`}>
                    {formatDif(item.difQtd)}
                  </td>
                  <td className={`px-4 py-2.5 font-mono font-bold ${divergente ? 'text-[var(--color-status-divergencia)]' : 'text-[var(--color-status-expedido)]'}`}>
                    {formatDif(item.difPeso)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-start gap-2 border-t border-border bg-muted/30 px-5 py-3">
        <Info size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] italic text-muted-foreground">
          Os totais históricos da pesagem não são alterados pela tratativa. Os valores acima são imutáveis e servem apenas de referência para a negociação administrativa.
        </p>
      </div>
    </div>
  );
}
