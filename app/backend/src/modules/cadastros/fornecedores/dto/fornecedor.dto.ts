import { z } from 'zod';
import { normalizarDocumento, validarDocumentoFiscal } from '../../../../common/validators/documento-fiscal';

const documentoFiscalSchema = z
  .string()
  .min(1, 'documentoFiscal é obrigatório')
  .transform(normalizarDocumento)
  .refine(validarDocumentoFiscal, { message: 'documentoFiscal inválido (CNPJ ou CPF com dígito verificador inválido)' });

export const createFornecedorSchema = z.object({
  codigo: z.string().trim().min(1).max(50),
  razaoSocial: z.string().trim().min(1).max(200),
  documentoFiscal: documentoFiscalSchema,
  status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
  contatosJson: z.record(z.string(), z.unknown()).optional(),
  parametrosOperacionaisJson: z.record(z.string(), z.unknown()).optional(),
  observacoes: z.string().trim().optional(),
});

export type CreateFornecedorDto = z.infer<typeof createFornecedorSchema>;

export const updateFornecedorSchema = createFornecedorSchema.partial();
export type UpdateFornecedorDto = z.infer<typeof updateFornecedorSchema>;
