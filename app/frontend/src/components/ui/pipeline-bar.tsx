import { cn } from '@/lib/cn';

export const ETAPAS_PIPELINE = [
  'Recebimento',
  'Conferência & Destinação',
  'Carga',
  'Faturamento',
] as const;

export type EtapaPipeline = (typeof ETAPAS_PIPELINE)[number];

interface PipelineBarProps {
  etapaAtual: EtapaPipeline;
  contadores?: {
    recebimento?: string;
    conferencia?: string;
    carga?: string;
    faturamento?: string;
  };
  className?: string;
}

const CHAVES_CONTADOR = ['recebimento', 'conferencia', 'carga', 'faturamento'] as const;

export function PipelineBar({ etapaAtual, contadores, className }: PipelineBarProps) {
  const indiceAtual = ETAPAS_PIPELINE.indexOf(etapaAtual);

  return (
    <ul aria-label="Etapas da operação" className={cn('flex items-center', className)}>
      {ETAPAS_PIPELINE.map((etapa, index) => {
        const estado = index < indiceAtual ? 'concluida' : index === indiceAtual ? 'atual' : 'futura';
        // `noUncheckedIndexedAccess`: o índice devolve `| undefined`, então a chave é estreitada antes de indexar.
        const chave = CHAVES_CONTADOR[index];
        const contador = chave ? contadores?.[chave] : undefined;

        return (
          <li key={etapa} aria-current={estado === 'atual' ? 'step' : undefined} className="flex items-center">
            <span
              data-estado={estado}
              className={cn(
                'flex items-center gap-1.5 text-[11px] font-semibold text-fg-faint',
                estado === 'concluida' && 'text-success-fg',
                estado === 'atual' && 'text-primary-fg',
              )}
            >
              <span
                className={cn(
                  'flex size-[18px] shrink-0 items-center justify-center rounded-full bg-surface-3 font-data text-[10px] text-fg-faint',
                  estado === 'concluida' && 'bg-success text-white',
                  estado === 'atual' && 'bg-primary text-white shadow-[0_0_0_3px_var(--color-primary-soft)]',
                )}
                aria-hidden="true"
              >
                {estado === 'concluida' ? '✓' : index + 1}
              </span>
              {etapa}
              {contador && (
                <span className="inline-flex h-[18px] items-center rounded-full bg-surface-3 px-1.5 font-data text-[10px] font-bold text-fg-secondary">
                  {contador}
                </span>
              )}
            </span>
            {index < ETAPAS_PIPELINE.length - 1 && (
              <span
                aria-hidden="true"
                className={cn('mx-1.5 h-px w-6 bg-border-strong', index < indiceAtual && 'bg-success')}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
