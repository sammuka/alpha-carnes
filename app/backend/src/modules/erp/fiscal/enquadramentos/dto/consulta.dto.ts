import { z } from 'zod';
import {
  ABRANGENCIAS_FISCAIS,
  FIN_NFE,
  TIPOS_PRODUTO_FISCAL,
  TP_NF,
} from '../../../../../database/schema/fiscal-enquadramentos.schema';
import { uuidSchema } from './comum.dto';
import { cestSchema } from './enquadramento.dto';

/** Chave inteira + data. Corpo parcial (só CFOP) não escolhe perfil (D9). */
export const consultaEnquadramentoSchema = z.object({
  estabelecimentoId: uuidSchema,
  data: z.iso.date(),
  operacaoId: uuidSchema,
  tpNf: z.enum(TP_NF),
  finNfe: z.enum(FIN_NFE),
  cfopId: uuidSchema,
  abrangencia: z.enum(ABRANGENCIAS_FISCAIS),
  tipoProduto: z.enum(TIPOS_PRODUTO_FISCAL),
  produtoId: uuidSchema,
  ncmId: uuidSchema,
  cest: cestSchema,
  clienteId: uuidSchema,
}).strict();
export type ConsultaEnquadramentoDto = z.infer<typeof consultaEnquadramentoSchema>;
