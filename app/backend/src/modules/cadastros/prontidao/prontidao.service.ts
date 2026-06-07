import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  clientes,
  fornecedores,
  itensComerciais,
  itensCompra,
  regrasDesdobramentoComercial,
} from '../../../database/schema';

export interface ProntidaoResultado {
  pronto: true;
  contagens: Record<string, number>;
}

/**
 * DP-01 — Prontidão de cadastros mínimos.
 *
 * O sistema só pode avançar para compra/pedido (F3) quando existir pelo menos um
 * registro ATIVO (deleted_at IS NULL, status='ativo') de cada entidade obrigatória:
 * cliente, fornecedor, item de compra, item comercial e regra de desdobramento.
 *
 * `verificarProntidaoCadastros()` FALHA de forma explícita (ConflictException listando
 * o que falta) quando algo está ausente — nunca retorna silenciosamente (RA-05).
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
    const [qtdClientes, qtdFornecedores, qtdItensCompra, qtdItensComerciais, qtdRegras] = await Promise.all([
      this.contar(and(isNull(clientes.deletedAt), eq(clientes.status, 'ativo')), clientes),
      this.contar(and(isNull(fornecedores.deletedAt), eq(fornecedores.status, 'ativo')), fornecedores),
      this.contar(and(isNull(itensCompra.deletedAt), eq(itensCompra.status, 'ativo')), itensCompra),
      this.contar(and(isNull(itensComerciais.deletedAt), eq(itensComerciais.status, 'ativo')), itensComerciais),
      this.contar(
        and(isNull(regrasDesdobramentoComercial.deletedAt), eq(regrasDesdobramentoComercial.status, 'ativo')),
        regrasDesdobramentoComercial,
      ),
    ]);

    const contagens: Record<string, number> = {
      clientes: qtdClientes,
      fornecedores: qtdFornecedores,
      itensCompra: qtdItensCompra,
      itensComerciais: qtdItensComerciais,
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
    tabela: typeof clientes | typeof fornecedores | typeof itensCompra | typeof itensComerciais | typeof regrasDesdobramentoComercial,
  ): Promise<number> {
    const row = await this.db.select({ total: sql<number>`count(*)::int` }).from(tabela).where(where);
    return row[0]?.total ?? 0;
  }
}
