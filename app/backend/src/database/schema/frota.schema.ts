import { relations, sql } from 'drizzle-orm';
import {
  boolean, check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import { fornecedores } from './fornecedores.schema';

// ── frota_caminhoes ───────────────────────────────────────────────────────────
// Cadastro da frota (Cadastros & Regras / Caminhões). Não confundir com `caminhoes`,
// que é a carga da expedição (decisão 12 da Onda 3).
export const frotaCaminhoes = pgTable(
  'frota_caminhoes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    placa: text('placa').notNull(),
    descricao: text('descricao'),
    capacidadeKg: integer('capacidade_kg').notNull().default(0),
    rotaPadraoId: uuid('rota_padrao_id'),
    status: text('status').notNull().default('ativo'),
    // Documentação/identificação do veículo — carga inicial a partir do cadastro legado.
    fabricante: text('fabricante'),
    modelo: text('modelo'),
    anoFabricacao: integer('ano_fabricacao'),
    anoModelo: integer('ano_modelo'),
    cor: text('cor'),
    chassi: text('chassi'),
    certificadoNumero: text('certificado_numero'),
    certificadoCidade: text('certificado_cidade'),
    certificadoUf: text('certificado_uf'),
    certificadoData: date('certificado_data'),
    numeroSeguro: text('numero_seguro'),
    kilometragem: integer('kilometragem'),
    taraKg: integer('tara_kg'),
    capacidadeM3: integer('capacidade_m3'),
    veiculoProprio: boolean('veiculo_proprio').notNull().default(true),
    nomeProprietario: text('nome_proprietario'),
    // Dimensões de plataforma/alcance — informativo, sem uso em regra de negócio hoje.
    dimensoesJson: jsonb('dimensoes_json').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_frota_caminhoes_status', sql`${t.status} IN ('ativo','inativo')`),
    check('chk_frota_caminhoes_capacidade', sql`${t.capacidadeKg} >= 0`),
    uniqueIndex('uq_frota_caminhoes_placa').on(t.placa).where(sql`${t.deletedAt} IS NULL`),
    index('idx_frota_caminhoes_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ── frota_motoristas ──────────────────────────────────────────────────────────
export const frotaMotoristas = pgTable(
  'frota_motoristas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    nome: text('nome').notNull(),
    documento: text('documento').notNull(),
    telefone: text('telefone'),
    caminhaoPadraoId: uuid('caminhao_padrao_id').references(() => frotaCaminhoes.id),
    status: text('status').notNull().default('ativo'),
    // Documentos e vínculo — carga inicial a partir do cadastro legado (motorista = fornecedor de frete).
    rg: text('rg'),
    carteiraProfissional: text('carteira_profissional'),
    nacionalidade: text('nacionalidade'),
    carteiraHabilitacao: text('carteira_habilitacao'),
    validadeHabilitacao: date('validade_habilitacao'),
    emissaoHabilitacao: date('emissao_habilitacao'),
    dataPrimeiraHabilitacao: date('data_primeira_habilitacao'),
    celular: text('celular'),
    contato: text('contato'),
    email: text('email'),
    tipoVinculo: text('tipo_vinculo'),
    inicioVinculo: date('inicio_vinculo'),
    // Endereço — informativo, sem uso em regra de negócio hoje.
    enderecoJson: jsonb('endereco_json').notNull().default(sql`'{}'::jsonb`),
    // Rastreabilidade do legado: no ERP antigo, motorista é um cadastro complementar
    // sobre um fornecedor (mesmo ID). Não é FK obrigatória — só existe para motoristas
    // migrados da carga inicial.
    fornecedorLegadoId: uuid('fornecedor_legado_id').references(() => fornecedores.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_frota_motoristas_status', sql`${t.status} IN ('ativo','inativo')`),
    check('chk_frota_motoristas_tipo_vinculo', sql`${t.tipoVinculo} IS NULL OR ${t.tipoVinculo} IN ('motorista','agregado','chapa')`),
    uniqueIndex('uq_frota_motoristas_documento').on(t.documento).where(sql`${t.deletedAt} IS NULL`),
    index('idx_frota_motoristas_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_frota_motoristas_caminhao').on(t.caminhaoPadraoId),
  ],
);

export const frotaCaminhoesRelations = relations(frotaCaminhoes, ({ many }) => ({
  motoristas: many(frotaMotoristas),
}));

export const frotaMotoristasRelations = relations(frotaMotoristas, ({ one }) => ({
  caminhaoPadrao: one(frotaCaminhoes, {
    fields: [frotaMotoristas.caminhaoPadraoId],
    references: [frotaCaminhoes.id],
  }),
}));
