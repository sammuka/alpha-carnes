import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { operacoes } from '../../../database/schema';
import type { TipoRelatorioSif } from './catalogo-sif';

@Injectable()
export class SifCalculoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async pendencias(operacaoId: string, tipo: TipoRelatorioSif): Promise<string[]> {
    switch (tipo) {
      case 'mapa_recebimento': {
        const linha = await this.db.execute<{ pecas_sem_destino: number; nfs_sem_chave: number }>(sql`
          SELECT
            (SELECT count(*)::int FROM pecas p
               JOIN recebimentos r ON r.id = p.recebimento_id
              WHERE r.operacao_id = ${operacaoId} AND p.deleted_at IS NULL
                AND p.status_peca = 'pesada' AND p.pedido_venda_id IS NULL) AS pecas_sem_destino,
            (SELECT count(*)::int FROM notas_fiscais_fornecedor nf
               JOIN recebimentos r ON r.id = nf.recebimento_id
              WHERE r.operacao_id = ${operacaoId} AND nf.deleted_at IS NULL
                AND (nf.chave IS NULL OR length(btrim(nf.chave)) = 0)) AS nfs_sem_chave
        `).then((r) => r.rows[0]);
        const pendencias: string[] = [];
        if ((linha?.pecas_sem_destino ?? 0) > 0) {
          pendencias.push(`${linha!.pecas_sem_destino} pesagem(ns) sem origem informada`);
        }
        if ((linha?.nfs_sem_chave ?? 0) > 0) {
          pendencias.push(`${linha!.nfs_sem_chave} NF-e sem chave completa cadastrada`);
        }
        return pendencias;
      }
      case 'producao_desossa': {
        const total = await this.contar(sql`
          SELECT count(*)::int AS total FROM transformacoes t
             JOIN pecas p ON p.id = t.peca_origem_id
             JOIN recebimentos r ON r.id = p.recebimento_id
           WHERE r.operacao_id = ${operacaoId} AND t.deleted_at IS NULL
             AND t.status_transformacao NOT IN ('concluida','cancelada')`);
        return total > 0 ? [`${total} transformação(ões) em aberto na desossa`] : [];
      }
      case 'controle_expedicao': {
        const total = await this.contar(sql`
          SELECT count(*)::int AS total FROM caminhoes c
           WHERE c.operacao_id = ${operacaoId} AND c.deleted_at IS NULL
             AND c.status_caminhao IN ('planejado','aguardando_carga','em_carga','em_conferencia')`);
        return total > 0 ? [`${total} caminhão(ões) com carga não fechada`] : [];
      }
      case 'perdas_destinacao': {
        const total = await this.contar(sql`
          SELECT count(*)::int AS total FROM divergencias_recebimento d
             JOIN recebimentos r ON r.id = d.recebimento_id
           WHERE r.operacao_id = ${operacaoId} AND d.status <> 'resolvida'`);
        return total > 0 ? [`${total} divergência(s) de recebimento em aberto`] : [];
      }
    }
  }

  private async contar(consulta: SQL): Promise<number> {
    const linha = await this.db.execute<{ total: number }>(consulta).then((r) => r.rows[0]);
    return linha?.total ?? 0;
  }

  async conteudo(operacaoId: string, tipo: TipoRelatorioSif): Promise<Record<string, unknown>> {
    const operacao = await this.db.select().from(operacoes)
      .where(eq(operacoes.id, operacaoId)).then((r) => r[0]);
    if (!operacao) throw new NotFoundException('Operação não encontrada');

    const numeros = await this.db.execute<Record<string, string>>(sql`
      SELECT
        (SELECT count(*)::int FROM recebimentos r
          WHERE r.operacao_id = ${operacaoId} AND r.deleted_at IS NULL)::text AS recebimentos,
        (SELECT coalesce(sum(p.peso_original), 0)::text FROM pecas p
           JOIN recebimentos r ON r.id = p.recebimento_id
          WHERE r.operacao_id = ${operacaoId} AND p.deleted_at IS NULL) AS peso_recebido,
        (SELECT count(*)::int FROM transformacoes t
           JOIN pecas p2 ON p2.id = t.peca_origem_id
           JOIN recebimentos r2 ON r2.id = p2.recebimento_id
          WHERE r2.operacao_id = ${operacaoId} AND t.deleted_at IS NULL
            AND t.status_transformacao = 'concluida')::text AS transformacoes_concluidas,
        (SELECT count(*)::int FROM caminhoes c
          WHERE c.operacao_id = ${operacaoId} AND c.deleted_at IS NULL
            AND c.status_caminhao IN ('fechado','liberado_faturamento','faturado','liberado_saida','expedido'))::text AS caminhoes_fechados,
        (SELECT count(*)::int FROM divergencias_recebimento d
           JOIN recebimentos r ON r.id = d.recebimento_id
          WHERE r.operacao_id = ${operacaoId})::text AS divergencias
    `).then((r) => r.rows[0] ?? {});

    return {
      versaoLayout: 'provisorio-p8',
      operacao: { id: operacao.id, data: operacao.data, rotulo: operacao.rotulo },
      tipo,
      apuradoEm: new Date().toISOString(),
      numeros,
    };
  }
}
