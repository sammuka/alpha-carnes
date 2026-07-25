import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Pendências ainda abertas (plano mestre §7). P2, P4, P13 e P14 foram fechadas
 * por AD-03..AD-06 e por isso não podem receber badge "Provisório".
 */
export const PENDENCIAS_ABERTAS = {
  P1: { ref: 'v1.1 §16.2', descricao: 'separação obrigatória do estoque por operação seg/qua/sex (cadência)' },
  P3: { ref: 'v1.1 §16.4', descricao: 'ordem detalhada de consumo FIFO entre peças físicas' },
  P5: { ref: 'v1.1 §16.6', descricao: 'política de preço em adendos' },
  P6: { ref: 'v1.1 §16.7', descricao: 'momento exato da escolha da transformação na desossa' },
  P7: { ref: 'v1.1 §16.8/§16.9', descricao: 'N caminhões/NFs por pedido ao fornecedor e N pedidos por caminhão' },
  P8: { ref: 'v1.1 §16.10', descricao: 'lista e modelos oficiais dos relatórios SIF' },
  P9: { ref: 'v1.1 §16.12', descricao: 'campos finais da etiqueta' },
  P10: { ref: 'v1.1 §16.13', descricao: 'procedimento físico de substituição de etiqueta com peça no caminhão' },
  P11: { ref: 'v1.1 §16.14', descricao: 'catálogo oficial completo e saneado de produtos' },
  P12: { ref: 'v1.1 §16.15', descricao: 'outras transformações além do TZ' },
  P15: { ref: 'docs_v2/05 §3.3', descricao: 'marco exato de fechamento do pedido' },
} as const;

export type PendenciaAberta = keyof typeof PENDENCIAS_ABERTAS;

interface BadgeProvisorioProps {
  pendencia: PendenciaAberta;
  texto?: string;
  className?: string;
}

export function BadgeProvisorio({ pendencia, texto, className }: BadgeProvisorioProps) {
  const { ref, descricao } = PENDENCIAS_ABERTAS[pendencia];
  const title = `Provisório — pendência ${pendencia} (${ref}): ${descricao}. Valor parametrizável até decisão registrada em DECISOES.md.`;

  return (
    <span
      title={title}
      className={cn(
        'inline-flex cursor-help items-center gap-1 whitespace-nowrap rounded-full border border-provisorio-border bg-provisorio-bg px-2 py-0.5 text-[10px] font-bold text-provisorio-text',
        className,
      )}
    >
      <AlertTriangle size={10} strokeWidth={2} aria-hidden="true" />
      {texto ?? 'Provisório'}
    </span>
  );
}
