import { z } from 'zod';

export const listarAuditoriaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  modulo: z.string().trim().optional(),
  operacao: z.enum(['INSERT', 'UPDATE', 'DELETE', 'ACAO_MANUAL']).optional(),
  usuarioId: z.string().uuid().optional(),
  registroId: z.string().uuid().optional(),
  registroBusca: z.string().trim().min(1).max(64).optional(),
  tabela: z.string().trim().optional(),
  dataInicio: z.string().datetime({ offset: true }).optional(),
  dataFim: z.string().datetime({ offset: true }).optional(),
});

export type ListarAuditoriaQuery = z.infer<typeof listarAuditoriaQuerySchema>;
