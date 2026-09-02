import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { itensComerciais, produtos } from './schema';
import { primeiroOuFalha } from '../common/crud/paginacao';

type Db = NodePgDatabase<typeof schema>;

/** Quantidade comercial/pedido é peça; kg fica só em `unidadePreco` (cobrança, v1.1 §6.7). */
const UNIDADE_PECA = 'unidade' as const;

/** Catálogo MVP extraído do protótipo validado (TabelaPrecos.tsx:29-41). Provisório — P11. */
const CATALOGO_MVP = [
  { codigo: 'TZ',     nome: 'Traseiro Bovino',       unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel', origemTransformacao: true,  saidaTransformacao: false, passaDesossa: true },
  { codigo: 'DT',     nome: 'Dianteiro Bovino',      unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel', origemTransformacao: false, saidaTransformacao: false, passaDesossa: false },
  { codigo: 'PA',     nome: 'Ponta de Agulha',       unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel', origemTransformacao: false, saidaTransformacao: false, passaDesossa: false },
  { codigo: 'BPORCO', nome: 'Banda de Porco',        unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel', origemTransformacao: false, saidaTransformacao: false, passaDesossa: false },
  { codigo: 'CB',     nome: 'Coxão-bola',            unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',     origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true },
  { codigo: 'JAC',    nome: 'Jacaré',                unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',     origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true },
  { codigo: 'CBA',    nome: 'Coxão-bola c/ alcatra', unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',     origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true },
  { codigo: 'FC',     nome: 'Filé curto',            unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',     origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true },
  { codigo: 'CXMIU',  nome: 'Caixa de Miúdos',       unidadePedido: UNIDADE_PECA, unidadePreco: 'unidade', tipo: 'entrada_unidade',      origemTransformacao: false, saidaTransformacao: false, passaDesossa: false },
  { codigo: 'CXRABO', nome: 'Caixa de Rabo',         unidadePedido: UNIDADE_PECA, unidadePreco: 'unidade', tipo: 'entrada_unidade',      origemTransformacao: false, saidaTransformacao: false, passaDesossa: false },
  { codigo: 'CXFIG',  nome: 'Caixa de Fígado',       unidadePedido: UNIDADE_PECA, unidadePreco: 'unidade', tipo: 'entrada_unidade',      origemTransformacao: false, saidaTransformacao: false, passaDesossa: false },
] as const;

export async function seedCatalogoMvp(db: Db): Promise<void> {
  for (const linha of CATALOGO_MVP) {
    // uq_itens_comerciais_codigo e uq_produtos_codigo são índices PARCIAIS
    // (WHERE deleted_at IS NULL): o ON CONFLICT precisa repetir o predicado,
    // senão o Postgres não encontra o índice de arbitragem.
    const [item] = await db.insert(itensComerciais)
      .values({
        codigo: linha.codigo,
        descricao: linha.nome,
        unidadeComercial: linha.unidadePedido,
      })
      .onConflictDoNothing({
        target: itensComerciais.codigo,
        where: isNull(itensComerciais.deletedAt),
      })
      .returning();
    const itemId = item?.id ?? primeiroOuFalha(
      await db.select({ id: itensComerciais.id }).from(itensComerciais)
        .where(and(
          eq(itensComerciais.codigo, linha.codigo),
          isNull(itensComerciais.deletedAt),
        )),
      `item comercial ${linha.codigo} não encontrado após o seed`,
    ).id;

    await db.update(itensComerciais)
      .set({
        descricao: linha.nome,
        unidadeComercial: linha.unidadePedido,
        updatedAt: new Date(),
      })
      .where(and(eq(itensComerciais.id, itemId), isNull(itensComerciais.deletedAt)));

    await db.insert(produtos)
      .values({
        codigo: linha.codigo,
        nome: linha.nome,
        tipoOperacional: linha.tipo,
        unidadePedido: linha.unidadePedido,
        unidadePreco: linha.unidadePreco,
        exigePeso: linha.unidadePreco === 'kg',
        passaDesossa: linha.passaDesossa,
        origemTransformacao: linha.origemTransformacao,
        saidaTransformacao: linha.saidaTransformacao,
        legadoItemComercialId: itemId,
        atributosJson: { provisorio: true, pendencia: 'P11', origem: 'prototipo_v1.1' },
      })
      .onConflictDoNothing({
        target: produtos.codigo,
        where: isNull(produtos.deletedAt),
      });

    await db.update(produtos)
      .set({
        nome: linha.nome,
        tipoOperacional: linha.tipo,
        unidadePedido: linha.unidadePedido,
        unidadePreco: linha.unidadePreco,
        exigePeso: linha.unidadePreco === 'kg',
        passaDesossa: linha.passaDesossa,
        origemTransformacao: linha.origemTransformacao,
        saidaTransformacao: linha.saidaTransformacao,
        legadoItemComercialId: itemId,
        updatedAt: new Date(),
      })
      .where(and(eq(produtos.codigo, linha.codigo), isNull(produtos.deletedAt)));
  }
}
