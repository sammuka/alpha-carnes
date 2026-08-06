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
  /** API nova (DS v3): código de pendência solto no rótulo, ex.: "P11". */
  codigo?: string;
  /** @deprecated API antiga — mantida até a migração das telas (Tarefas 20/23/24/25/26/29). */
  pendencia?: PendenciaAberta;
  /** @deprecated API antiga — mantida até a migração das telas. */
  texto?: string;
  className?: string;
}

/** Badge "Provisório" — pendências v1.1 §16. Remoção exige AD-xx (Princípio VIII). */
export function BadgeProvisorio({ codigo, pendencia, texto, className }: BadgeProvisorioProps) {
  const rotulo = texto ?? (codigo ? `Provisório · ${codigo}` : 'Provisório');
  const title = pendencia
    ? `Provisório — pendência ${pendencia} (${PENDENCIAS_ABERTAS[pendencia].ref}): ${PENDENCIAS_ABERTAS[pendencia].descricao}. Valor parametrizável até decisão registrada em DECISOES.md.`
    : undefined;

  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-[18px] items-center gap-1 whitespace-nowrap rounded px-1.5 text-[10px] font-bold tracking-[0.03em]',
        'border border-provisorio-border bg-provisorio-bg text-provisorio-text',
        className,
      )}
    >
      <AlertTriangle className="size-2.5" aria-hidden="true" />
      {rotulo}
    </span>
  );
}
