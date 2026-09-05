import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  clientes,
  fornecedores,
  produtos,
  regrasDesdobramentoComercial,
} from '../../../database/schema';

export interface ProntidaoResultado {
  pronto: true;
  contagens: Record<string, number>;
}

/**
 * DP-01 — Prontidão de cadastros mínimos (AD-15: catálogo único em produtos).
 */
@Injectable()
export class ProntidaoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async verificarProntidaoCadastros(): Promise<ProntidaoResultado> {
    const [qtdClientes, qtdFornecedores, qtdProdutosVenda, qtdRegras] = await Promise.all([
      this.contar(and(isNull(clientes.deletedAt), eq(clientes.status, 'ativo')), clientes),
      this.contar(and(isNull(fornecedores.deletedAt), eq(fornecedores.status, 'ativo')), fornecedores),
      this.contar(
        and(isNull(produtos.deletedAt), eq(produtos.status, 'ativo'), eq(produtos.ativoVenda, true)),
        produtos,
      ),
      this.contar(
        and(isNull(regrasDesdobramentoComercial.deletedAt), eq(regrasDesdobramentoComercial.status, 'ativo')),
        regrasDesdobramentoComercial,
      ),
    ]);

    const contagens: Record<string, number> = {
      clientes: qtdClientes,
      fornecedores: qtdFornecedores,
      produtosVenda: qtdProdutosVenda,
      regrasDesdobramento: qtdRegras,
    };

    const faltantes = Object.entries(contagens)
      .filter(([, qtd]) => qtd === 0)
      .map(([nome]) => nome);

    if (faltantes.length > 0) {
      throw new ConflictException(
        `Cadastros mínimos ausentes para avançar (DP-01): ${faltantes.join(', ')}. ` +
          'Cadastre ao menos um registro ativo de cada entidade obrigatória.',
      );
    }

    return { pronto: true, contagens };
  }

  private async contar(
    where: ReturnType<typeof and>,
    tabela: typeof clientes | typeof fornecedores | typeof produtos | typeof regrasDesdobramentoComercial,
  ): Promise<number> {
    const row = await this.db.select({ total: sql<number>`count(*)::int` }).from(tabela).where(where);
    return row[0]?.total ?? 0;
  }
}
