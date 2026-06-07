import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';

type Db = NodePgDatabase<typeof schema>;

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

/** Cria um conjunto mínimo de cadastros para exercitar F3. */
export async function seedComercialBase(
  app: INestApplication,
  opts: { fator?: number } = {},
): Promise<{
  fornecedorId: string;
  itemCompraId: string;
  itemComercialId: string;
  clienteId: string;
  fator: number;
}> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const fator = opts.fator ?? 1;

  const [fornecedor] = await db
    .insert(schema.fornecedores)
    .values({ codigo: uid('FORN'), razaoSocial: 'Fornecedor F3', documentoFiscal: uid('DOC') })
    .returning();
  const [itemCompra] = await db
    .insert(schema.itensCompra)
    .values({ codigo: uid('ICOMP'), descricao: 'Boi', unidadeCompra: 'cabeca' })
    .returning();
  const [itemComercial] = await db
    .insert(schema.itensComerciais)
    .values({ codigo: uid('ICOM'), descricao: 'Dianteiro', unidadeComercial: 'parte' })
    .returning();
  const [cliente] = await db
    .insert(schema.clientes)
    .values({ codigo: uid('CLI'), razaoSocial: 'Cliente F3', documentoFiscal: uid('DOCC') })
    .returning();

  if (!fornecedor || !itemCompra || !itemComercial || !cliente) {
    throw new Error('Falha ao criar cadastros base de F3');
  }

  await db.insert(schema.regrasDesdobramentoComercial).values({
    itemCompraId: itemCompra.id,
    itemComercialId: itemComercial.id,
    fatorQuantidade: String(fator),
    status: 'ativo',
    vigenciaInicio: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });

  return {
    fornecedorId: fornecedor.id,
    itemCompraId: itemCompra.id,
    itemComercialId: itemComercial.id,
    clienteId: cliente.id,
    fator,
  };
}

/** Lê a disponibilidade gerada para um item comercial (estado atual de saldo). */
export async function lerDisponibilidade(
  app: INestApplication,
  itemComercialId: string,
): Promise<{
  id: string;
  quantidadeTotalGerada: string;
  quantidadeReservada: string;
  quantidadeDisponivel: string;
  status: string;
} | null> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const rows = await db
    .select()
    .from(schema.disponibilidadesVirtuais)
    .where(eq(schema.disponibilidadesVirtuais.itemComercialId, itemComercialId));
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    quantidadeTotalGerada: row.quantidadeTotalGerada,
    quantidadeReservada: row.quantidadeReservada,
    quantidadeDisponivel: row.quantidadeDisponivel,
    status: row.status,
  };
}
