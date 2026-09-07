import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, notInArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  fornecedores,
  produtos,
  pecas,
  recebimentos,
  transformacoes,
} from '../../../database/schema';
import type {
  PecaElegivelDesossa,
  PecasElegiveisQuery,
} from './dto/pecas-elegiveis.dto';

@Injectable()
export class PecasElegiveisService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(q: PecasElegiveisQuery): Promise<PecaElegivelDesossa[]> {
    const linhas = await this.db
      .select({
        pecaId: pecas.id,
        etiquetaAtual: pecas.etiquetaAtual,
        statusPeca: pecas.statusPeca,
        pesoOriginal: pecas.pesoOriginal,
        produtoId: pecas.produtoBaseId,
        produtoCodigo: produtos.codigo,
        recebimentoId: pecas.recebimentoId,
        transformacaoId: transformacoes.id,
        lote: recebimentos.romaneio,
        origem: fornecedores.razaoSocial,
        entrada: pecas.createdAt,
        capturaMeta: pecas.capturaMeta,
      })
      .from(pecas)
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .innerJoin(fornecedores, eq(fornecedores.id, recebimentos.fornecedorId))
      .leftJoin(produtos, eq(produtos.id, pecas.produtoBaseId))
      .leftJoin(
        transformacoes,
        and(
          eq(transformacoes.pecaOrigemId, pecas.id),
          isNull(transformacoes.deletedAt),
          notInArray(transformacoes.statusTransformacao, ['concluida', 'cancelada']),
        ),
      )
      .where(
        and(
          eq(recebimentos.operacaoId, q.operacaoId),
          inArray(pecas.statusPeca, ['para_corte', 'em_transformacao']),
          isNull(pecas.deletedAt),
        ),
      )
      .orderBy(asc(pecas.createdAt));

    return linhas.map((l) => {
      const meta = (l.capturaMeta ?? {}) as Record<string, unknown>;
      const flags: string[] = [];
      if (meta.maisPesada === true) flags.push('Mais pesada');
      if (meta.maisGorda === true) flags.push('Mais gorda');
      if (meta.melhorAcabamento === true) flags.push('Melhor acabamento');
      const situacao: PecaElegivelDesossa['situacao'] =
        meta.prioritario === true
          ? 'Prioritário'
          : l.statusPeca === 'em_transformacao'
            ? 'Disponível para desossa'
            : 'Aguardando chegada à desossa';
      return {
        pecaId: l.pecaId,
        etiquetaAtual: l.etiquetaAtual,
        statusPeca: l.statusPeca,
        pesoOriginal: l.pesoOriginal,
        produtoId: l.produtoId,
        produtoCodigo: l.produtoCodigo,
        recebimentoId: l.recebimentoId,
        transformacaoId: l.transformacaoId,
        lote: l.lote,
        origem: l.origem,
        entrada: l.entrada ? new Date(l.entrada as Date).toISOString() : null,
        caracteristicas: flags.length > 0 ? flags.join(', ') : '—',
        situacao,
        obs: typeof meta.obs === 'string' ? meta.obs : null,
      };
    });
  }
}
