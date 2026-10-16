import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import { ROTULOS_SITUACAO, type SituacaoEstabelecimento } from '@/lib/fiscal-empresas';

const VARIANTES: Record<SituacaoEstabelecimento, StatusPillVariant> = {
  DRAFT: 'pendente',
  REVIEW: 'divergencia',
  APPROVED: 'expedido',
  REJECTED: 'bloqueado',
  SUSPENDED: 'pesado',
};

/** Pill de situação do cadastro fiscal (estabelecimento, regime ou alteração). */
export function PillSituacao({ situacao, rotulo }: { situacao: SituacaoEstabelecimento; rotulo?: string }) {
  return <StatusPill variant={VARIANTES[situacao]} label={rotulo ?? ROTULOS_SITUACAO[situacao]} />;
}
