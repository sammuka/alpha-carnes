import { AlertTriangle } from 'lucide-react';
import type { ImpactoCompra } from '@/lib/comercial';

interface PainelImpactoProps {
  impacto: ImpactoCompra;
}

export function PainelImpacto({ impacto }: PainelImpactoProps) {
  const itensAlterados = impacto.itens.filter((i) => i.delta !== '0.000' && i.delta !== '0' && i.delta !== '-0.000');

  if (itensAlterados.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-provisorio-border)] bg-[var(--color-provisorio-bg)] p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-[var(--color-provisorio-text)]" />
        <p className="text-sm font-bold text-[var(--color-provisorio-text)]">Painel de impacto</p>
      </div>
      {itensAlterados.map((item) => {
        const reducao = item.delta.startsWith('-');
        const deltaAbs = item.delta.replace('-', '');
        const temDeficit = item.deficitProjetado !== '0.000' && item.deficitProjetado !== '0' && !item.deficitProjetado.startsWith('0.000');
        return (
          <p key={item.itemComercialId} className="text-xs leading-relaxed text-[var(--color-provisorio-text)]">
            {reducao ? (
              <>
                Atenção: reduzir a compra remove <strong>{deltaAbs} {item.codigo}</strong> virtuais.
                {' '}Reservas existentes: <strong>{item.quantidadeReservada} {item.codigo}</strong>.{' '}
                {temDeficit ? (
                  <>
                    Déficit resultante: <strong className="text-destructive">{item.deficitProjetado} {item.codigo}</strong>
                    {' '}→ aparecerá como overbooking/risco no mapa e no painel da gestão.
                  </>
                ) : (
                  <>
                    Saldo virtual restante após a alteração: <strong>{item.saldoProjetado} {item.codigo}</strong> (sem déficit projetado).
                  </>
                )}
              </>
            ) : (
              <>
                +{deltaAbs} {item.codigo} virtuais
              </>
            )}
          </p>
        );
      })}
      {impacto.deficitTotal !== '0.000' && impacto.deficitTotal !== '0' && (
        <p className="text-xs font-semibold text-destructive">
          Total de déficit projetado: {impacto.deficitTotal}
        </p>
      )}
    </div>
  );
}
