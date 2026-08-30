import { z } from 'zod';
import { ufBrasilSchema } from './dominios.dto';

/** Endereço e dados fiscais do cliente (JSONB). */
export const dadosFiscaisJsonSchema = z
  .object({
    logradouro: z.string().trim().max(200).optional(),
    numero: z.string().trim().max(20).optional(),
    complemento: z.string().trim().max(100).optional(),
    bairro: z.string().trim().max(100).optional(),
    cidade: z.string().trim().max(100).optional(),
    uf: ufBrasilSchema.optional(),
    cep: z.string().trim().max(10).optional(),
    codigoIbge: z.string().trim().max(10).optional(),
    // IE: até 14 dígitos (leiaute NFe/SEFAZ) + pontuação de exibição por UF (ex.: "123.456.789.000").
    inscricaoEstadual: z.string().trim().max(18).optional(),
    // IM: até 15 caracteres — padrão adotado por sistemas fiscais integrados (varia por município).
    inscricaoMunicipal: z.string().trim().max(15).optional(),
    emailFiscal: z.string().trim().email().optional().or(z.literal('')),
    telefoneFiscal: z.string().trim().max(20).optional(),
    condicaoFiscal: z.string().trim().max(100).optional(),
  })
  .partial()
  .optional();

/** Contato do cliente (JSONB). */
export const dadosContatoJsonSchema = z
  .object({
    nome: z.string().trim().max(200).optional(),
    cargo: z.string().trim().max(100).optional(),
    telefone: z.string().trim().max(20).optional(),
    whatsapp: z.string().trim().max(20).optional(),
    email: z.string().trim().email().optional().or(z.literal('')),
    tipo: z.enum(['compra', 'financeiro', 'recebimento', 'fiscal']).optional(),
    principal: z.boolean().optional(),
  })
  .partial()
  .optional();

/** Preferências operacionais do cliente (JSONB). */
export const preferenciasJsonSchema = z
  .object({
    prefereMaisPesada: z.boolean().optional(),
    prefereMaisGorda: z.boolean().optional(),
    prefereMelhorAcabamento: z.boolean().optional(),
    faixaPesoMin: z.number().nonnegative().optional(),
    faixaPesoMax: z.number().nonnegative().optional(),
    aceitaSubstituicao: z.boolean().optional(),
    produtosPreferidos: z.array(z.string()).optional(),
    produtosRecusados: z.array(z.string()).optional(),
    observacaoBalanca: z.string().trim().max(500).optional(),
    observacaoDesossa: z.string().trim().max(500).optional(),
    observacaoCarga: z.string().trim().max(500).optional(),
    perfilGordura: z.string().trim().max(50).optional(),
    necessitaCorteAcerto: z.boolean().optional(),
  })
  .partial()
  .optional();

/** Contatos do fornecedor (JSONB). */
export const contatosFornecedorJsonSchema = z
  .object({
    nome: z.string().trim().max(200).optional(),
    telefone: z.string().trim().max(20).optional(),
    email: z.string().trim().email().optional().or(z.literal('')),
    cargo: z.string().trim().max(100).optional(),
  })
  .partial()
  .optional();

/** Parâmetros operacionais do fornecedor (JSONB). */
export const parametrosOperacionaisJsonSchema = z
  .object({
    romaneioAntecipado: z.boolean().optional(),
    horarioLimiteRecebimento: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    capacidadeMaximaKg: z.number().int().nonnegative().optional(),
    toleranciaDivergenciaPercentual: z.number().min(0).max(100).optional(),
    notaQualidade: z.enum(['A', 'B', 'C']).optional(),
    produtosFornecidos: z.array(z.string()).optional(),
    prazoEntrega: z.number().int().nonnegative().optional(),
  })
  .partial()
  .optional();

export type DadosFiscaisJson = z.infer<NonNullable<typeof dadosFiscaisJsonSchema>>;
export type DadosContatoJson = z.infer<NonNullable<typeof dadosContatoJsonSchema>>;
export type PreferenciasJson = z.infer<NonNullable<typeof preferenciasJsonSchema>>;
