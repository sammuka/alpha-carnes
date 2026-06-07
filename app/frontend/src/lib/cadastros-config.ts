import { z } from 'zod';
import type { FieldValues } from 'react-hook-form';

export interface CampoConfig {
  nome: string;
  rotulo: string;
  tipo: 'text' | 'select' | 'checkbox' | 'date' | 'number';
  obrigatorio?: boolean;
  opcoes?: Array<{ valor: string; rotulo: string }>;
  placeholder?: string;
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
    { nome: 'codigo', rotulo: 'Código', tipo: 'text', obrigatorio: true },
    { nome: 'razaoSocial', rotulo: 'Razão Social', tipo: 'text', obrigatorio: true },
    { nome: 'nomeFantasia', rotulo: 'Nome Fantasia', tipo: 'text' },
    {
      nome: 'documentoFiscal',
      rotulo: 'CNPJ/CPF',
      tipo: 'text',
      obrigatorio: true,
      placeholder: 'Somente números',
    },
    { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: statusOpcoes },
  ],
  schema: z.object({
    codigo: z.string().min(1, 'Código obrigatório'),
    razaoSocial: z.string().min(1, 'Razão social obrigatória'),
    nomeFantasia: z.string().optional(),
    documentoFiscal: z.string().regex(documentoRegex, documentoMsg),
    status: z.enum(['ativo', 'inativo']).optional(),
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
  campos: [
    { nome: 'codigo', rotulo: 'Código', tipo: 'text', obrigatorio: true },
    { nome: 'razaoSocial', rotulo: 'Razão Social', tipo: 'text', obrigatorio: true },
    { nome: 'documentoFiscal', rotulo: 'CNPJ/CPF', tipo: 'text', obrigatorio: true, placeholder: 'Somente números' },
    { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: statusOpcoes },
  ],
  schema: z.object({
    codigo: z.string().min(1, 'Código obrigatório'),
    razaoSocial: z.string().min(1, 'Razão social obrigatória'),
    documentoFiscal: z.string().regex(documentoRegex, documentoMsg),
    status: z.enum(['ativo', 'inativo']).optional(),
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
