import { CheckCircle2, ChevronRight } from 'lucide-react';
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
    <ul
      aria-label="Etapas da operação"
      className={cn(
        'mb-6 flex items-center overflow-hidden rounded-lg border border-border-chip bg-card shadow-sm',
        className,
      )}
    >
      {ETAPAS_PIPELINE.map((etapa, index) => {
        const estado = index < indiceAtual ? 'concluida' : index === indiceAtual ? 'atual' : 'futura';
        // `noUncheckedIndexedAccess`: o índice devolve `| undefined`, então a chave é estreitada antes de indexar.
        const chave = CHAVES_CONTADOR[index];
        const contador = chave ? contadores?.[chave] : undefined;

        return (
          <li
            key={etapa}
            aria-current={estado === 'atual' ? 'step' : undefined}
            className="flex flex-1 items-center"
          >
            <div
              data-estado={estado}
              className={cn(
                'flex flex-1 items-center justify-center px-4 py-3 transition-colors',
                estado === 'concluida' && 'font-medium text-pipeline-done',
                estado === 'atual' && 'bg-action-blue font-bold text-white',
                estado === 'futura' && 'text-pipeline-future',
              )}
            >
              {estado === 'concluida' && (
                <CheckCircle2 size={16} className="mr-2 text-pipeline-done" aria-hidden="true" />
              )}
              <span className="text-sm tracking-wide">{etapa}</span>
              {contador && (
                <span
                  className={cn(
                    'ml-3 rounded-full px-2 py-0.5 text-xs font-bold',
                    estado === 'atual' ? 'bg-white/20 text-white' : 'bg-surface-chip text-login-text',
                  )}
                >
                  {contador}
                </span>
              )}
            </div>
            {index < ETAPAS_PIPELINE.length - 1 && (
              <div className="shrink-0 px-1 text-border-chip" aria-hidden="true">
                <ChevronRight size={20} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
