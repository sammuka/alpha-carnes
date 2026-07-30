import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { itensComerciais, produtos } from './schema';
import { primeiroOuFalha } from '../common/crud/paginacao';

type Db = NodePgDatabase<typeof schema>;

/** Catálogo MVP extraído do protótipo validado (TabelaPrecos.tsx:29-41). Provisório — P11. */
const CATALOGO_MVP = [
  { codigo: 'TZ',     nome: 'Traseiro Bovino',       unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel' },
  { codigo: 'DT',     nome: 'Dianteiro Bovino',      unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel' },
  { codigo: 'PA',     nome: 'Ponta de Agulha',       unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel' },
  { codigo: 'BPORCO', nome: 'Banda de Porco',        unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel' },
  { codigo: 'CB',     nome: 'Coxão-bola',            unidadePreco: 'kg',      tipo: 'derivado_desossa' },
  { codigo: 'JAC',    nome: 'Jacaré',                unidadePreco: 'kg',      tipo: 'derivado_desossa' },
  { codigo: 'CBA',    nome: 'Coxão-bola c/ alcatra', unidadePreco: 'kg',      tipo: 'derivado_desossa' },
  { codigo: 'FC',     nome: 'Filé curto',            unidadePreco: 'kg',      tipo: 'derivado_desossa' },
  { codigo: 'CXMIU',  nome: 'Caixa de Miúdos',       unidadePreco: 'unidade', tipo: 'entrada_unidade' },
  { codigo: 'CXRABO', nome: 'Caixa de Rabo',         unidadePreco: 'unidade', tipo: 'entrada_unidade' },
  { codigo: 'CXFIG',  nome: 'Caixa de Fígado',       unidadePreco: 'unidade', tipo: 'entrada_unidade' },
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
        unidadeComercial: linha.unidadePreco,
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
    await db.insert(produtos)
      .values({
        codigo: linha.codigo,
        nome: linha.nome,
        tipoOperacional: linha.tipo,
        unidadePedido: linha.unidadePreco,
        unidadePreco: linha.unidadePreco,
        exigePeso: linha.unidadePreco === 'kg',
        passaDesossa: linha.tipo === 'derivado_desossa',
        legadoItemComercialId: itemId,
        atributosJson: { provisorio: true, pendencia: 'P11', origem: 'prototipo_v1.1' },
      })
      .onConflictDoNothing({
        target: produtos.codigo,
        where: isNull(produtos.deletedAt),
      });
  }
}
