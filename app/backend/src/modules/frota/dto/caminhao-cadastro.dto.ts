import { z } from 'zod';

const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida — use o formato AAAA-MM-DD.');

export const createCaminhaoCadastroSchema = z.object({
  placa: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/, 'Placa inválida. Use o formato ABC-1D23'),
  descricao: z.string().trim().max(200).optional(),
  capacidadeKg: z.coerce.number().int().min(0).default(0),
  rotaPadraoId: z.string().uuid().nullable().optional(),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
  fabricante: z.string().trim().max(100).optional(),
  modelo: z.string().trim().max(100).optional(),
  anoFabricacao: z.coerce.number().int().min(1900).max(2100).optional(),
  anoModelo: z.coerce.number().int().min(1900).max(2100).optional(),
  cor: z.string().trim().max(50).optional(),
  chassi: z.string().trim().max(50).optional(),
  certificadoNumero: z.string().trim().max(50).optional(),
  certificadoCidade: z.string().trim().max(100).optional(),
  certificadoUf: z.string().trim().max(2).optional(),
  certificadoData: dataSchema.optional(),
  numeroSeguro: z.string().trim().max(50).optional(),
  kilometragem: z.coerce.number().int().min(0).optional(),
  taraKg: z.coerce.number().int().min(0).optional(),
  capacidadeM3: z.coerce.number().int().min(0).optional(),
  veiculoProprio: z.coerce.boolean().default(true),
  nomeProprietario: z.string().trim().max(200).optional(),
});

export type CreateCaminhaoCadastroDto = z.infer<typeof createCaminhaoCadastroSchema>;

export const updateCaminhaoCadastroSchema = createCaminhaoCadastroSchema.partial();
export type UpdateCaminhaoCadastroDto = z.infer<typeof updateCaminhaoCadastroSchema>;
