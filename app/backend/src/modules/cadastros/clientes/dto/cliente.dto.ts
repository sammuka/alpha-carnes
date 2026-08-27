import { z } from 'zod';
import {
  dadosContatoJsonSchema,
  dadosFiscaisJsonSchema,
  preferenciasJsonSchema,
} from '../../../../common/dto/json-cadastros.dto';
import { normalizarDocumento, validarDocumentoFiscal } from '../../../../common/validators/documento-fiscal';

// documentoFiscal: aceita CNPJ E CPF; validado por dígito verificador; normalizado (só dígitos).
const documentoFiscalSchema = z
  .string()
  .min(1, 'CNPJ ou CPF é obrigatório.')
  .transform(normalizarDocumento)
  .refine(validarDocumentoFiscal, { message: 'CNPJ ou CPF inválido — confira o número digitado.' });

const statusSchema = z.enum(['ativo', 'inativo']);

export const createClienteSchema = z.object({
  codigo: z.string().trim().min(1).max(50).optional(),
  razaoSocial: z.string().trim().min(1).max(200),
  nomeFantasia: z.string().trim().max(200).optional(),
  documentoFiscal: documentoFiscalSchema,
  status: statusSchema.optional().default('ativo'),
  representanteId: z.string().uuid().optional(),
  rotaId: z.string().uuid().optional().nullable(),
  prioridade: z.enum(['normal', 'alta']).optional(),
  preferenciasJson: preferenciasJsonSchema,
  dadosFiscaisJson: dadosFiscaisJsonSchema,
  dadosContatoJson: dadosContatoJsonSchema,
  observacoesOperacionais: z.string().trim().optional(),
});

export type CreateClienteDto = z.infer<typeof createClienteSchema>;

// Update: PATCH parcial. `codigo` é imutável após a criação (AD-13) e é omitido do DTO.
export const updateClienteSchema = createClienteSchema.omit({ codigo: true }).partial();
export type UpdateClienteDto = z.infer<typeof updateClienteSchema>;
