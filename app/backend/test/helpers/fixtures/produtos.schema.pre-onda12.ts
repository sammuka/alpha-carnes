import { sql } from 'drizzle-orm';
import { boolean, check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { itensComerciais } from './itens-comerciais.schema';
import { itensCompra } from './itens-compra.schema';

export const produtos = pgTable(
  'produtos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    codigo: text('codigo').notNull(),
    nome: text('nome').notNull(),
    nomeOperacional: text('nome_operacional'),
    categoria: text('categoria'),
    tipoOperacional: text('tipo_operacional').notNull().default('peca_inteira_pesavel'),
    unidadePedido: text('unidade_pedido').notNull(),
    unidadePreco: text('unidade_preco').notNull().default('kg'),
    exigePeso: boolean('exige_peso').notNull().default(true),
    passaBalanca: boolean('passa_balanca').notNull().default(false),
    passaDesossa: boolean('passa_desossa').notNull().default(false),
    origemTransformacao: boolean('origem_transformacao').notNull().default(false),
    saidaTransformacao: boolean('saida_transformacao').notNull().default(false),
    podeEstoque: boolean('pode_estoque').notNull().default(true),
    ativoVenda: boolean('ativo_venda').notNull().default(true),
    ativoCompra: boolean('ativo_compra').notNull().default(false),
    status: text('status').notNull().default('ativo'),
    observacoesOperacionais: text('observacoes_operacionais'),
    atributosJson: jsonb('atributos_json').notNull().default(sql`'{}'::jsonb`),
    legadoItemComercialId: uuid('legado_item_comercial_id').references(() => itensComerciais.id),
    legadoItemCompraId: uuid('legado_item_compra_id').references(() => itensCompra.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_produtos_status', sql`${t.status} IN ('ativo','inativo')`),
    check('chk_produtos_unidade_preco', sql`${t.unidadePreco} IN ('kg','unidade')`),
    check('chk_produtos_tipo_operacional', sql`${t.tipoOperacional} IN ('peca_inteira_pesavel','derivado_desossa','entrada_unidade','compra_base')`),
    uniqueIndex('uq_produtos_codigo').on(t.codigo).where(sql`${t.deletedAt} IS NULL`),
    index('idx_produtos_status').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('idx_produtos_atributos_gin').using('gin', t.atributosJson),
  ],
);
