export type TipoRelatorioSif =
  | 'mapa_recebimento' | 'producao_desossa' | 'controle_expedicao' | 'perdas_destinacao';

export interface DefinicaoRelatorioSif {
  tipo: TipoRelatorioSif;
  codigo: string;
  nome: string;
  perfilResponsavel: string;
}

export const CATALOGO_SIF: readonly DefinicaoRelatorioSif[] = [
  { tipo: 'mapa_recebimento', codigo: 'SIF-01', nome: 'Mapa de recebimento diário (provisório)', perfilResponsavel: 'recebimento_pesagem' },
  { tipo: 'producao_desossa', codigo: 'SIF-02', nome: 'Relatório de produção/desossa (provisório)', perfilResponsavel: 'corte' },
  { tipo: 'controle_expedicao', codigo: 'SIF-03', nome: 'Controle de expedição (provisório)', perfilResponsavel: 'expedicao' },
  { tipo: 'perdas_destinacao', codigo: 'SIF-04', nome: 'Relatório de perdas e destinação (provisório)', perfilResponsavel: 'administrador' },
] as const;

export function derivarStatus(
  pendencias: string[],
  versaoAtual: number,
  ultimoTipoGeracao: 'gerado' | 'retificado' | null,
): 'pendente_dados' | 'pronto_para_gerar' | 'gerado' | 'retificado' {
  if (pendencias.length > 0) return 'pendente_dados';
  if (versaoAtual === 0 || ultimoTipoGeracao === null) return 'pronto_para_gerar';
  return ultimoTipoGeracao;
}
