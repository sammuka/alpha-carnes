import { z } from 'zod';

export const pecasElegiveisQuerySchema = z.object({
  operacaoId: z.string().uuid(),
});
export type PecasElegiveisQuery = z.infer<typeof pecasElegiveisQuerySchema>;

export type PecaElegivelDesossa = {
  pecaId: string;
  etiquetaAtual: string | null;
  statusPeca: string;
  pesoOriginal: string | null;
  itemComercialId: string;
  produtoCodigo: string | null;
  recebimentoId: string;
  transformacaoId: string | null;
  lote: string | null;
  origem: string | null;
  entrada: string | null;
  caracteristicas: string;
  situacao: 'Disponível para desossa' | 'Aguardando chegada à desossa' | 'Prioritário';
  obs: string | null;
};
