import { z } from 'zod';

export const listarOcorrenciasPrecoQuerySchema = z.object({
  operacaoId: z.string().uuid(),
  status: z.enum(['aberta', 'ciente']).optional(),
  clienteId: z.string().uuid().optional(),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListarOcorrenciasPrecoQuery = z.infer<typeof listarOcorrenciasPrecoQuerySchema>;

export type OcorrenciaPrecoLista = {
  id: string;
  pedidoNumero: string;
  clienteNomeFantasia: string | null;
  status: 'aberta' | 'ciente';
  dataHora: string;
  usuarioFinalizacaoNome: string | null;
  quantidadeItensAjustados: number;
  diferencaTotal: string;
};

export type OcorrenciaPrecoItem = {
  produtoCodigo: string;
  produtoNome: string;
  precoTabelaOriginal: string | null;
  precoAplicado: string;
  diferencaAbsoluta: string;
  diferencaPercentual: string | null;
  usuarioAjusteNome: string | null;
};

export type OcorrenciaPrecoDetalhe = OcorrenciaPrecoLista & {
  itens: OcorrenciaPrecoItem[];
  usuarioCienteNome: string | null;
  dataHoraCiente: string | null;
};
