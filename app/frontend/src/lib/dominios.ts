export const UNIDADES_MEDIDA = ['kg', 'unidade'] as const;
export type UnidadeMedida = (typeof UNIDADES_MEDIDA)[number];

export const UNIDADE_MEDIDA_OPTIONS: Array<{ valor: UnidadeMedida; rotulo: string }> = [
  { valor: 'kg', rotulo: 'kg' },
  { valor: 'unidade', rotulo: 'Unidade' },
];

export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
export type UfBrasil = (typeof UFS_BRASIL)[number];

export const UF_OPTIONS = UFS_BRASIL.map((uf) => ({ valor: uf, rotulo: uf }));

export function labelCodigoNome(codigo: string, nome: string): string {
  return `${codigo} — ${nome}`;
}

export function labelCodigoDescricao(codigo: string, descricao: string): string {
  return `${codigo} — ${descricao}`;
}

export function labelCodigoRazaoSocial(codigo: string, razaoSocial: string): string {
  return `${codigo} — ${razaoSocial}`;
}

export function sufixoInativo(status: string): string {
  return status === 'ativo' ? '' : ' (inativo)';
}
