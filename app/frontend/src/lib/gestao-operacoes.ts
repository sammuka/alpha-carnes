import { mensagemDeErro } from '@/lib/error-message';

export interface Operacao {
  id: string;
  data: string;
  diaSemana: number;
  rotulo: string;
  status: 'aberta' | 'em_andamento' | 'fechada';
  extraordinaria: boolean;
  comprasProgramadas: number;
  pedidosVenda: number;
  pendenciasOverbookingAbertas: number;
}

export const ROTULO_STATUS_OPERACAO: Record<Operacao['status'], string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  fechada: 'Fechada',
};

export async function listarOperacoes(params: {
  status?: Operacao['status'];
  de?: string;
  ate?: string;
} = {}): Promise<Operacao[]> {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) if (valor) busca.set(chave, valor);
  const resposta = await fetch(`/api/operacoes?${busca.toString()}`);
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
  const corpo = await resposta.json();
  return corpo.data as Operacao[];
}
