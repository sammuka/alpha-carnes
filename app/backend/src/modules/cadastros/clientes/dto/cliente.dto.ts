import { z } from 'zod';
import { normalizarDocumento, validarDocumentoFiscal } from '../../../../common/validators/documento-fiscal';

// documentoFiscal: aceita CNPJ E CPF; validado por dígito verificador; normalizado (só dígitos).
const documentoFiscalSchema = z
  .string()
  .min(1, 'documentoFiscal é obrigatório')
  .transform(normalizarDocumento)
  .refine(validarDocumentoFiscal, { message: 'documentoFiscal inválido (CNPJ ou CPF com dígito verificador inválido)' });

const statusSchema = z.enum(['ativo', 'inativo']);

export const createClienteSchema = z.object({
  codigo: z.string().trim().min(1).max(50),
  razaoSocial: z.string().trim().min(1).max(200),
  nomeFantasia: z.string().trim().max(200).optional(),
  documentoFiscal: documentoFiscalSchema,
  status: statusSchema.optional().default('ativo'),
  rotaPadrao: z.string().trim().max(100).optional(),
  representanteId: z.string().uuid().optional(),
  prioridade: z.string().trim().max(50).optional(),
  preferenciasJson: z.record(z.string(), z.unknown()).optional(),
  dadosFiscaisJson: z.record(z.string(), z.unknown()).optional(),
  dadosContatoJson: z.record(z.string(), z.unknown()).optional(),
  observacoesOperacionais: z.string().trim().optional(),
});

export type CreateClienteDto = z.infer<typeof createClienteSchema>;

// Update: todos os campos opcionais (PATCH parcial), sem permitir documento/codigo vazios.
export const updateClienteSchema = createClienteSchema.partial();
export type UpdateClienteDto = z.infer<typeof updateClienteSchema>;
