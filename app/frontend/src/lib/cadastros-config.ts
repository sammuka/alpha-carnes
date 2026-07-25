import { z } from 'zod';
import type { FieldValues } from 'react-hook-form';
import type { LucideIcon } from 'lucide-react';
import { Building2, MapPin, Truck } from 'lucide-react';

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
const documentoMsg = 'Informe um CNPJ (14 dígitos) ou CPF (11 dígitos), apenas números';

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
    capacidadeMaximaKg: z.coerce.number().int().min(0).optional(),
    toleranciaDivergenciaPercentual: z.coerce.number().min(0).max(100).optional(),
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
    { nome: 'codigo', rotulo: 'Código', tipo: 'text', obrigatorio: true, aba: 'gerais' },
    { nome: 'razaoSocial', rotulo: 'Razão Social', tipo: 'text', obrigatorio: true, aba: 'gerais' },
    { nome: 'nomeFantasia', rotulo: 'Nome Fantasia', tipo: 'text', aba: 'gerais' },
    {
      nome: 'documentoFiscal',
      rotulo: 'CNPJ/CPF',
      tipo: 'text',
      obrigatorio: true,
      placeholder: 'Somente números',
      aba: 'gerais',
    },
    { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: statusOpcoes, aba: 'gerais' },
    { nome: 'rotaPadrao', rotulo: 'Rota padrão', tipo: 'text', aba: 'gerais' },
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
    },
    {
      nome: 'numero',
      rotulo: 'Número',
      tipo: 'text',
      aba: 'fiscais',
      jsonCampo: 'dadosFiscaisJson',
    },
    {
      nome: 'bairro',
      rotulo: 'Bairro',
      tipo: 'text',
      aba: 'fiscais',
      jsonCampo: 'dadosFiscaisJson',
    },
    {
      nome: 'cidade',
      rotulo: 'Cidade',
      tipo: 'text',
      aba: 'fiscais',
      jsonCampo: 'dadosFiscaisJson',
    },
    { nome: 'uf', rotulo: 'UF', tipo: 'text', aba: 'fiscais', jsonCampo: 'dadosFiscaisJson' },
    { nome: 'cep', rotulo: 'CEP', tipo: 'text', aba: 'fiscais', jsonCampo: 'dadosFiscaisJson' },
    {
      nome: 'inscricaoEstadual',
      rotulo: 'Inscrição estadual',
      tipo: 'text',
      aba: 'fiscais',
      jsonCampo: 'dadosFiscaisJson',
    },
    {
      nome: 'nome',
      rotulo: 'Nome do contato',
      tipo: 'text',
      aba: 'contatos',
      jsonCampo: 'dadosContatoJson',
    },
    {
      nome: 'telefone',
      rotulo: 'Telefone',
      tipo: 'text',
      aba: 'contatos',
      jsonCampo: 'dadosContatoJson',
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
    codigo: z.string().min(1, 'Código obrigatório'),
    razaoSocial: z.string().min(1, 'Razão social obrigatória'),
    nomeFantasia: z.string().optional(),
    documentoFiscal: z.string().regex(documentoRegex, documentoMsg),
    status: z.enum(['ativo', 'inativo']).optional(),
    rotaPadrao: z.string().optional(),
    representanteId: z.string().uuid().optional().or(z.literal('')),
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
    { nome: 'codigo', rotulo: 'Código', tipo: 'text', obrigatorio: true, secao: 'dados-principais' },
    { nome: 'razaoSocial', rotulo: 'Razão Social', tipo: 'text', obrigatorio: true, secao: 'dados-principais' },
    {
      nome: 'documentoFiscal',
      rotulo: 'CNPJ/CPF',
      tipo: 'text',
      obrigatorio: true,
      placeholder: 'Somente números',
      secao: 'dados-principais',
    },
    { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: statusOpcoes, secao: 'dados-principais' },
    { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', secao: 'dados-principais' },
    {
      nome: 'nome',
      rotulo: 'Nome do contato',
      tipo: 'text',
      secao: 'endereco-contato',
      jsonCampo: 'contatosJson',
    },
    {
      nome: 'telefone',
      rotulo: 'Telefone',
      tipo: 'text',
      secao: 'endereco-contato',
      jsonCampo: 'contatosJson',
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
    documentoFiscal: z.string().regex(documentoRegex, documentoMsg),
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
    { nome: 'codigo', rotulo: 'Código', tipo: 'text', obrigatorio: true },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'text', obrigatorio: true },
    { nome: 'categoria', rotulo: 'Categoria', tipo: 'text' },
    { nome: 'unidadeCompra', rotulo: 'Unidade de Compra', tipo: 'text', obrigatorio: true },
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
    { nome: 'codigo', rotulo: 'Código', tipo: 'text', obrigatorio: true },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'text', obrigatorio: true },
    { nome: 'categoria', rotulo: 'Categoria', tipo: 'text' },
    { nome: 'unidadeComercial', rotulo: 'Unidade Comercial', tipo: 'text', obrigatorio: true },
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
  clientes: clientesConfig,
  fornecedores: fornecedoresConfig,
  'itens-compra': itensCompraConfig,
  'itens-comerciais': itensComerciaisConfig,
};

export const ABA_LABELS: Record<AbaCadastro, string> = {
  gerais: 'Gerais',
  fiscais: 'Fiscais',
  contatos: 'Contatos',
  preferencias: 'Preferências',
  parametros: 'Parâmetros',
};

export const ABA_ORDEM: AbaCadastro[] = ['gerais', 'fiscais', 'contatos', 'preferencias', 'parametros'];
