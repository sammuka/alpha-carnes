import { extrairCodigoErro, extrairMensagemErro, mensagemDeErro } from '@/lib/error-message';

export type StatusRelatorioSif =
  | 'pendente_dados'
  | 'pronto_para_gerar'
  | 'gerado'
  | 'retificado';

export const ROTULO_STATUS_SIF: Record<StatusRelatorioSif, string> = {
  pendente_dados: 'Pendente de dados',
  pronto_para_gerar: 'Pronto para gerar',
  gerado: 'Gerado',
  retificado: 'Retificado',
};

export const ROTULO_TIPO_GERACAO: Record<string, string> = {
  gerado: 'Gerado',
  retificado: 'Retificado',
};

export interface VersaoSif {
  id: string;
  versao: number;
  tipoGeracao: 'gerado' | 'retificado';
  motivoRetificacao: string | null;
  geradoEm: string;
  geradoPorNome: string | null;
  conteudoJson?: unknown;
}

export interface RelatorioSif {
  id: string;
  operacaoId: string;
  tipo: string;
  codigo: string;
  nome: string;
  perfilResponsavel: string;
  status: StatusRelatorioSif;
  pendenciasJson: string[];
  versaoAtual: number;
  ultimaVersao?: VersaoSif | null;
}

export async function listarRelatorios(operacaoId: string): Promise<RelatorioSif[]> {
  const res = await fetch(`/api/sif/relatorios?operacaoId=${encodeURIComponent(operacaoId)}`);
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json() as Promise<RelatorioSif[]>;
}

export async function buscarVersoes(id: string): Promise<VersaoSif[]> {
  const res = await fetch(`/api/sif/relatorios/${id}/versoes`);
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json() as Promise<VersaoSif[]>;
}

export async function gerarRelatorio(id: string) {
  const res = await fetch(`/api/sif/relatorios/${id}/gerar`, { method: 'POST' });
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json();
}

export async function retificarRelatorio(id: string, motivo: string) {
  const res = await fetch(`/api/sif/relatorios/${id}/retificar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  });
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json();
}

export async function previewRelatorio(id: string): Promise<VersaoSif | null> {
  const res = await fetch(`/api/sif/relatorios/${id}/preview`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = extrairMensagemErro(body, 'Falha ao carregar preview');
    if (
      extrairCodigoErro(body) === 'SEM_VERSAO_GERADA' ||
      msg.includes('SEM_VERSAO_GERADA')
    ) {
      return null;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<VersaoSif>;
}
