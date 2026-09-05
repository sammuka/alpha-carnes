import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { produtos } from './schema';

type Db = NodePgDatabase<typeof schema>;

/** Quantidade comercial/pedido é peça; kg fica só em `unidadePreco` (cobrança, v1.1 §6.7). */
const UNIDADE_PECA = 'unidade' as const;

/** Catálogo MVP extraído do protótipo validado (TabelaPrecos.tsx:29-41) + BOI (AD-15). Provisório — P11. */
const CATALOGO_MVP = [
  { codigo: 'BOI',    nome: 'BOI CASADO',            unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'compra_base',           origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: false, ativoCompra: true },
  { codigo: 'TZ',     nome: 'Traseiro Bovino',       unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel',  origemTransformacao: true,  saidaTransformacao: false, passaDesossa: true,  ativoVenda: true,  ativoCompra: true },
  { codigo: 'DT',     nome: 'Dianteiro Bovino',      unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel',  origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: true },
  { codigo: 'PA',     nome: 'Ponta de Agulha',       unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel',  origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: true },
  { codigo: 'BPORCO', nome: 'Banda de Porco',        unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'peca_inteira_pesavel',  origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: true },
  { codigo: 'CB',     nome: 'Coxão-bola',            unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',      origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true,  ativoVenda: true,  ativoCompra: false },
  { codigo: 'JAC',    nome: 'Jacaré',                unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',      origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true,  ativoVenda: true,  ativoCompra: false },
  { codigo: 'CBA',    nome: 'Coxão-bola c/ alcatra', unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',      origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true,  ativoVenda: true,  ativoCompra: false },
  { codigo: 'FC',     nome: 'Filé curto',            unidadePedido: UNIDADE_PECA, unidadePreco: 'kg',      tipo: 'derivado_desossa',      origemTransformacao: false, saidaTransformacao: true,  passaDesossa: true,  ativoVenda: true,  ativoCompra: false },
  { codigo: 'CXMIU',  nome: 'Caixa de Miúdos',       unidadePedido: UNIDADE_PECA, unidadePreco: 'unidade', tipo: 'entrada_unidade',       origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: false },
  { codigo: 'CXRABO', nome: 'Caixa de Rabo',         unidadePedido: UNIDADE_PECA, unidadePreco: 'unidade', tipo: 'entrada_unidade',       origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: false },
  { codigo: 'CXFIG',  nome: 'Caixa de Fígado',       unidadePedido: UNIDADE_PECA, unidadePreco: 'unidade', tipo: 'entrada_unidade',       origemTransformacao: false, saidaTransformacao: false, passaDesossa: false, ativoVenda: true,  ativoCompra: false },
] as const;

export async function seedCatalogoMvp(db: Db): Promise<void> {
  for (const linha of CATALOGO_MVP) {
    const atributosJson =
      linha.codigo === 'BOI'
        ? { origemUnificacao: 'AD-15', legado: 'itens_compra', provisorio: true, pendencia: 'P11' }
        : { provisorio: true, pendencia: 'P11', origem: 'prototipo_v1.1' };

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
        ativoVenda: linha.ativoVenda,
        ativoCompra: linha.ativoCompra,
        atributosJson,
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
        ativoVenda: linha.ativoVenda,
        ativoCompra: linha.ativoCompra,
        atributosJson,
        updatedAt: new Date(),
      })
      .where(and(eq(produtos.codigo, linha.codigo), isNull(produtos.deletedAt)));
  }
}
