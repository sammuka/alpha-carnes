import { z } from 'zod';
import type { FieldValues } from 'react-hook-form';
import type { LucideIcon } from 'lucide-react';
import { Building2, MapPin, Truck } from 'lucide-react';
import { mascararCep, mascararCpfCnpj, mascararTelefone } from '@/lib/masks';

export type AbaCadastro = 'gerais' | 'fiscais' | 'contatos' | 'preferencias' | 'parametros';

export interface SecaoCadastro {
  chave: string;
  titulo: string;
  icone: LucideIcon;
  coluna: 1 | 2;
}

export interface CampoConfig {
  nome: string;
  rotulo: string;
  tipo: 'text' | 'select' | 'checkbox' | 'date' | 'number' | 'textarea';
  obrigatorio?: boolean;
  opcoes?: Array<{ valor: string; rotulo: string }>;
  placeholder?: string;
  aba?: AbaCadastro;
  secao?: string;
  jsonCampo?: string;
  /** Reformata o valor a cada digitação (ex.: mascararCpfCnpj). Nunca bloqueia colar. */
  mascara?: (valor: string) => string;
  /** Limite físico de digitação — copiar do `.max(N)` do DTO do backend, nunca inventar. */
  maxLength?: number;
}

export interface ColunaConfig {
  campo: string;
  rotulo: string;
}

export interface CadastroConfig {
  recurso: string; // segmento da rota da API e da URL (ex.: 'clientes')
  titulo: string;
  permissaoLer: string;
  permissaoGerenciar: string;
  colunas: ColunaConfig[];
  campos: CampoConfig[];
  secoes?: SecaoCadastro[];
  // Schema de validação do formulário; produz FieldValues compatível com react-hook-form.
  schema: z.ZodType<FieldValues, FieldValues>;
}

const statusOpcoes = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'inativo', rotulo: 'Inativo' },
];

// Schemas de formulário (validação na borda do front — RA-01: regra crítica fica no backend).
const documentoRegex = /^\d{11}$|^\d{14}$/;
const documentoMsg = 'Informe um CNPJ (14 dígitos) ou CPF (11 dígitos)';
/** Valida ignorando a pontuação da máscara — mesmo critério do backend (normalizarDocumento). */
const documentoValido = (valor: string) => documentoRegex.test(valor.replace(/\D/g, ''));

const dadosFiscaisFormSchema = z
  .object({
    logradouro: z.string().optional(),
    numero: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    uf: z.string().optional(),
    cep: z.string().optional(),
    inscricaoEstadual: z.string().optional(),
  })
  .optional();

const dadosContatoFormSchema = z
  .object({
    nome: z.string().optional(),
    telefone: z.string().optional(),
    email: z.string().optional(),
    cargo: z.string().optional(),
  })
  .optional();

const preferenciasFormSchema = z
  .object({
    prefereMaisPesada: z.boolean().optional(),
    prefereMaisGorda: z.boolean().optional(),
    observacaoBalanca: z.string().optional(),
  })
  .optional();

const contatosFornecedorFormSchema = z
  .object({
    nome: z.string().optional(),
    telefone: z.string().optional(),
    email: z.string().optional(),
    cargo: z.string().optional(),
  })
  .optional();

const parametrosFornecedorFormSchema = z
  .object({
    romaneioAntecipado: z.boolean().optional(),
    horarioLimiteRecebimento: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')
      .optional()
      .or(z.literal('')),
    capacidadeMaximaKg: z.coerce.number().int().min(0, 'Deve ser maior ou igual a zero').optional(),
    toleranciaDivergenciaPercentual: z.coerce
      .number()
      .min(0, 'Deve ser maior ou igual a zero')
      .max(100, 'Deve ser no máximo 100')
      .optional(),
    notaQualidade: z.enum(['A', 'B', 'C']).optional(),
  })
  .optional();

export const clientesConfig: CadastroConfig = {
  recurso: 'clientes',
  titulo: 'Clientes',
  permissaoLer: 'CLIENTES_LER',
  permissaoGerenciar: 'CLIENTES_GERENCIAR',
  colunas: [
    { campo: 'codigo', rotulo: 'Código' },
    { campo: 'razaoSocial', rotulo: 'Razão Social' },
    { campo: 'documentoFiscal', rotulo: 'CNPJ/CPF' },
    { campo: 'status', rotulo: 'Status' },
  ],
  campos: [
    {
      nome: 'razaoSocial',
      rotulo: 'Razão Social',
      tipo: 'text',
      obrigatorio: true,
      aba: 'gerais',
      maxLength: 200,
    },
    { nome: 'nomeFantasia', rotulo: 'Nome Fantasia/Marca', tipo: 'text', aba: 'gerais', maxLength: 200 },
    {
      nome: 'documentoFiscal',
      rotulo: 'CNPJ/CPF',
      tipo: 'text',
      obrigatorio: true,
      placeholder: '00.000.000/0000-00',
      aba: 'gerais',
      mascara: mascararCpfCnpj,
    },
    { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: statusOpcoes, aba: 'gerais' },
    {
      nome: 'representanteId',
      rotulo: 'Representante (UUID)',
      tipo: 'text',
      placeholder: 'ID do representante',
      aba: 'gerais',
    },
    { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'text', aba: 'gerais' },
    {
      nome: 'observacoesOperacionais',
      rotulo: 'Observações operacionais',
      tipo: 'textarea',
      aba: 'gerais',
    },
    {
      nome: 'logradouro',
      rotulo: 'Logradouro',
      tipo: 'text',
      aba: 'fiscais',
      jsonCampo: 'dadosFiscaisJson',
      maxLength: 200,
    },
    {
      nome: 'numero',
      rotulo: 'Número',
      tipo: 'text',
      aba: 'fiscais',
      jsonCampo: 'dadosFiscaisJson',
      maxLength: 20,
    },
    {
      nome: 'bairro',
      rotulo: 'Bairro',
      tipo: 'text',
      aba: 'fiscais',
      jsonCampo: 'dadosFiscaisJson',
      maxLength: 100,
    },
    {
      nome: 'cidade',
      rotulo: 'Cidade',
      tipo: 'text',
      aba: 'fiscais',
      jsonCampo: 'dadosFiscaisJson',
      maxLength: 100,
    },
    {
      nome: 'uf',
      rotulo: 'UF',
      tipo: 'text',
      aba: 'fiscais',
      jsonCampo: 'dadosFiscaisJson',
      maxLength: 2,
      mascara: (v: string) => v.toUpperCase(),
    },
    {
      nome: 'cep',
      rotulo: 'CEP',
      tipo: 'text',
      aba: 'fiscais',
      jsonCampo: 'dadosFiscaisJson',
      mascara: mascararCep,
    },
    {
      nome: 'inscricaoEstadual',
      rotulo: 'Inscrição estadual',
      tipo: 'text',
      aba: 'fiscais',
      jsonCampo: 'dadosFiscaisJson',
      maxLength: 18,
    },
    {
      nome: 'nome',
      rotulo: 'Nome do contato',
      tipo: 'text',
      aba: 'contatos',
      jsonCampo: 'dadosContatoJson',
      maxLength: 200,
    },
    {
      nome: 'telefone',
      rotulo: 'Telefone',
      tipo: 'text',
      aba: 'contatos',
      jsonCampo: 'dadosContatoJson',
      mascara: mascararTelefone,
    },
    {
      nome: 'email',
      rotulo: 'E-mail',
      tipo: 'text',
      aba: 'contatos',
      jsonCampo: 'dadosContatoJson',
    },
    {
      nome: 'cargo',
      rotulo: 'Cargo',
      tipo: 'text',
      aba: 'contatos',
      jsonCampo: 'dadosContatoJson',
      maxLength: 100,
    },
    {
      nome: 'prefereMaisPesada',
      rotulo: 'Prefere peça mais pesada',
      tipo: 'checkbox',
      aba: 'preferencias',
      jsonCampo: 'preferenciasJson',
    },
    {
      nome: 'prefereMaisGorda',
      rotulo: 'Prefere peça mais gorda',
      tipo: 'checkbox',
      aba: 'preferencias',
      jsonCampo: 'preferenciasJson',
    },
    {
      nome: 'observacaoBalanca',
      rotulo: 'Observação para balança',
      tipo: 'textarea',
      aba: 'preferencias',
      jsonCampo: 'preferenciasJson',
    },
  ],
  schema: z.object({
    razaoSocial: z.string().min(1, 'Razão social obrigatória'),
    nomeFantasia: z.string().optional(),
    documentoFiscal: z.string().refine(documentoValido, documentoMsg),
    status: z.enum(['ativo', 'inativo']).optional(),
    representanteId: z.string().uuid('Identificador do representante inválido').optional().or(z.literal('')),
    prioridade: z.string().optional(),
    observacoesOperacionais: z.string().optional(),
    dadosFiscaisJson: dadosFiscaisFormSchema,
    dadosContatoJson: dadosContatoFormSchema,
    preferenciasJson: preferenciasFormSchema,
  }),
};

export const fornecedoresConfig: CadastroConfig = {
  recurso: 'fornecedores',
  titulo: 'Fornecedores',
  permissaoLer: 'FORNECEDORES_LER',
  permissaoGerenciar: 'FORNECEDORES_GERENCIAR',
  colunas: [
    { campo: 'codigo', rotulo: 'Código' },
    { campo: 'razaoSocial', rotulo: 'Razão Social' },
    { campo: 'documentoFiscal', rotulo: 'CNPJ/CPF' },
    { campo: 'status', rotulo: 'Status' },
  ],
  secoes: [
    { chave: 'dados-principais', titulo: 'Dados Principais', icone: Building2, coluna: 1 },
    { chave: 'endereco-contato', titulo: 'Endereço e Contato', icone: MapPin, coluna: 1 },
    { chave: 'parametros-operacionais', titulo: 'Parâmetros Operacionais', icone: Truck, coluna: 2 },
  ],
  campos: [
    {
      nome: 'codigo',
      rotulo: 'Código',
      tipo: 'text',
      obrigatorio: true,
      secao: 'dados-principais',
      maxLength: 50,
    },
    {
      nome: 'razaoSocial',
      rotulo: 'Razão Social',
      tipo: 'text',
      obrigatorio: true,
      secao: 'dados-principais',
      maxLength: 200,
    },
    {
      nome: 'documentoFiscal',
      rotulo: 'CNPJ/CPF',
      tipo: 'text',
      obrigatorio: true,
      placeholder: '00.000.000/0000-00',
      secao: 'dados-principais',
      mascara: mascararCpfCnpj,
    },
    { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: statusOpcoes, secao: 'dados-principais' },
    { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', secao: 'dados-principais' },
    {
      nome: 'nome',
      rotulo: 'Nome do contato',
      tipo: 'text',
      secao: 'endereco-contato',
      jsonCampo: 'contatosJson',
      maxLength: 200,
    },
    {
      nome: 'telefone',
      rotulo: 'Telefone',
      tipo: 'text',
      secao: 'endereco-contato',
      jsonCampo: 'contatosJson',
      mascara: mascararTelefone,
    },
    {
      nome: 'email',
      rotulo: 'E-mail',
      tipo: 'text',
      secao: 'endereco-contato',
      jsonCampo: 'contatosJson',
    },
    {
      nome: 'cargo',
      rotulo: 'Cargo',
      tipo: 'text',
      secao: 'endereco-contato',
      jsonCampo: 'contatosJson',
      maxLength: 100,
    },
    {
      nome: 'romaneioAntecipado',
      rotulo: 'Romaneio antecipado',
      tipo: 'checkbox',
      secao: 'parametros-operacionais',
      jsonCampo: 'parametrosOperacionaisJson',
    },
    {
      nome: 'horarioLimiteRecebimento',
      rotulo: 'Horário Limite Recebimento',
      tipo: 'text',
      placeholder: 'HH:MM',
      secao: 'parametros-operacionais',
      jsonCampo: 'parametrosOperacionaisJson',
      maxLength: 5,
    },
    {
      nome: 'capacidadeMaximaKg',
      rotulo: 'Capacidade Max. Caminhão (kg)',
      tipo: 'number',
      secao: 'parametros-operacionais',
      jsonCampo: 'parametrosOperacionaisJson',
    },
    {
      nome: 'toleranciaDivergenciaPercentual',
      rotulo: 'Tolerância de Divergência (%)',
      tipo: 'number',
      secao: 'parametros-operacionais',
      jsonCampo: 'parametrosOperacionaisJson',
    },
    {
      nome: 'notaQualidade',
      rotulo: 'Nota de Qualidade',
      tipo: 'select',
      opcoes: [
        { valor: 'A', rotulo: 'A (Excelente)' },
        { valor: 'B', rotulo: 'B (Bom)' },
        { valor: 'C', rotulo: 'C (Regular)' },
      ],
      secao: 'parametros-operacionais',
      jsonCampo: 'parametrosOperacionaisJson',
    },
  ],
  schema: z.object({
    codigo: z.string().min(1, 'Código obrigatório'),
    razaoSocial: z.string().min(1, 'Razão social obrigatória'),
    documentoFiscal: z.string().refine(documentoValido, documentoMsg),
    status: z.enum(['ativo', 'inativo']).optional(),
    observacoes: z.string().optional(),
    contatosJson: contatosFornecedorFormSchema,
    parametrosOperacionaisJson: parametrosFornecedorFormSchema,
  }),
};

export const itensCompraConfig: CadastroConfig = {
  recurso: 'itens-compra',
  titulo: 'Itens de Compra',
  permissaoLer: 'ITENS_COMPRA_LER',
  permissaoGerenciar: 'ITENS_COMPRA_GERENCIAR',
  colunas: [
    { campo: 'codigo', rotulo: 'Código' },
    { campo: 'descricao', rotulo: 'Descrição' },
    { campo: 'unidadeCompra', rotulo: 'Unidade' },
    { campo: 'status', rotulo: 'Status' },
  ],
  campos: [
    { nome: 'codigo', rotulo: 'Código', tipo: 'text', obrigatorio: true, maxLength: 50 },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'text', obrigatorio: true, maxLength: 200 },
    { nome: 'categoria', rotulo: 'Categoria', tipo: 'text', maxLength: 100 },
    {
      nome: 'unidadeCompra',
      rotulo: 'Unidade de Compra',
      tipo: 'text',
      obrigatorio: true,
      maxLength: 30,
    },
    { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: statusOpcoes },
  ],
  schema: z.object({
    codigo: z.string().min(1, 'Código obrigatório'),
    descricao: z.string().min(1, 'Descrição obrigatória'),
    categoria: z.string().optional(),
    unidadeCompra: z.string().min(1, 'Unidade obrigatória'),
    status: z.enum(['ativo', 'inativo']).optional(),
  }),
};

export const itensComerciaisConfig: CadastroConfig = {
  recurso: 'itens-comerciais',
  titulo: 'Itens Comerciais',
  permissaoLer: 'ITENS_COMERCIAIS_LER',
  permissaoGerenciar: 'ITENS_COMERCIAIS_GERENCIAR',
  colunas: [
    { campo: 'codigo', rotulo: 'Código' },
    { campo: 'descricao', rotulo: 'Descrição' },
    { campo: 'unidadeComercial', rotulo: 'Unidade' },
    { campo: 'status', rotulo: 'Status' },
  ],
  campos: [
    { nome: 'codigo', rotulo: 'Código', tipo: 'text', obrigatorio: true, maxLength: 50 },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'text', obrigatorio: true, maxLength: 200 },
    { nome: 'categoria', rotulo: 'Categoria', tipo: 'text', maxLength: 100 },
    {
      nome: 'unidadeComercial',
      rotulo: 'Unidade Comercial',
      tipo: 'text',
      obrigatorio: true,
      maxLength: 30,
    },
    { nome: 'permiteCorte', rotulo: 'Permite Corte', tipo: 'checkbox' },
    { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: statusOpcoes },
  ],
  schema: z.object({
    codigo: z.string().min(1, 'Código obrigatório'),
    descricao: z.string().min(1, 'Descrição obrigatória'),
    categoria: z.string().optional(),
    unidadeComercial: z.string().min(1, 'Unidade obrigatória'),
    permiteCorte: z.boolean().optional(),
    status: z.enum(['ativo', 'inativo']).optional(),
  }),
};

export const CADASTROS: Record<string, CadastroConfig> = {
  fornecedores: fornecedoresConfig,
  'itens-compra': itensCompraConfig,
  'itens-comerciais': itensComerciaisConfig,
};

/**
 * Props seguras para Client Components: schema Zod, ícones Lucide e máscaras
 * são funções e o Next.js recusa serializá-las (quebra a rota de criação).
 * O formulário relê schema e máscaras de CADASTROS no cliente.
 */
export function configCadastroParaCliente(
  config: CadastroConfig,
): Omit<CadastroConfig, 'schema' | 'secoes'> {
  const { schema: _schema, secoes: _secoes, ...rest } = config;
  void _schema;
  void _secoes;
  return {
    ...rest,
    campos: rest.campos.map(({ mascara: _mascara, ...campo }) => {
      void _mascara;
      return campo;
    }),
  };
}

export const ABA_LABELS: Record<AbaCadastro, string> = {
  gerais: 'Gerais',
  fiscais: 'Fiscais',
  contatos: 'Contatos',
  preferencias: 'Preferências',
  parametros: 'Parâmetros',
};

export const ABA_ORDEM: AbaCadastro[] = ['gerais', 'fiscais', 'contatos', 'preferencias', 'parametros'];
