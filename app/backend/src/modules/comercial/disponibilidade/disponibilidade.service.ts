import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { disponibilidadesVirtuais } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import type { ListarDisponibilidadeQuery } from './dto/disponibilidade.dto';

type DisponibilidadeVirtual = typeof disponibilidadesVirtuais.$inferSelect;
type CompraProgramada = typeof schema.comprasProgramadas.$inferSelect;
type Tx = NodePgDatabase<typeof schema>;

export interface DisponibilidadeGerada {
  id: string;
  itemComercialId: string;
  quantidadeTotalGerada: string;
}

@Injectable()
export class DisponibilidadeService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /**
   * Gera a disponibilidade virtual de uma compra confirmada, DENTRO da transação
   * de confirmação. Para cada item comercial: total = Σ (fator × quantidade_comprada)
   * das regras de desdobramento ativas e vigentes na data da operação.
   *
   * Cálculo feito em SQL com NUMERIC nativo (sem drift de float — S4).
   * Idempotente: ON CONFLICT DO NOTHING na unique (compra, item) — confirmar 2×
   * (caminho que chega aqui só uma vez por S5) nunca duplica saldo.
   */
  async gerarParaCompra(tx: Tx, compra: CompraProgramada): Promise<DisponibilidadeGerada[]> {
    const inseridas = await tx.execute<{
      id: string;
      item_comercial_id: string;
      quantidade_total_gerada: string;
    }>(sql`
      INSERT INTO disponibilidades_virtuais
        (compra_programada_id, data_operacao, item_comercial_id,
         quantidade_total_gerada, quantidade_reservada, quantidade_disponivel, status)
      SELECT
        ${compra.id},
        ${compra.dataOperacao}::date,
        r.item_comercial_id,
        SUM(r.fator_quantidade * cpi.quantidade_comprada),
        0,
        SUM(r.fator_quantidade * cpi.quantidade_comprada),
        'gerada'
      FROM compras_programadas_itens cpi
      JOIN regras_desdobramento_comercial r
        ON r.item_compra_id = cpi.item_compra_id
       AND r.deleted_at IS NULL
       AND r.status = 'ativo'
       AND r.vigencia_inicio <= now()
       AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= now())
      WHERE cpi.compra_programada_id = ${compra.id}
        AND cpi.deleted_at IS NULL
      GROUP BY r.item_comercial_id
      ON CONFLICT (compra_programada_id, item_comercial_id) DO NOTHING
      RETURNING id, item_comercial_id, quantidade_total_gerada
    `);

    const linhas = inseridas.rows.map((r) => ({
      id: r.id,
      itemComercialId: r.item_comercial_id,
      quantidadeTotalGerada: r.quantidade_total_gerada,
    }));

    for (const linha of linhas) {
      await this.auditoria.registrar(tx, {
        tabela: 'disponibilidades_virtuais',
        registroId: linha.id,
        operacao: 'INSERT',
        modulo: 'comercial',
        usuarioId: compra.usuarioConfirmacaoId,
        dadosAnteriores: {},
        dadosNovos: linha,
      });
    }

    return linhas;
  }

  async listar(query: ListarDisponibilidadeQuery): Promise<DisponibilidadeVirtual[]> {
    const filtros = [];
    if (query.dataOperacao) filtros.push(eq(disponibilidadesVirtuais.dataOperacao, query.dataOperacao));
    if (query.compraProgramadaId) {
      filtros.push(eq(disponibilidadesVirtuais.compraProgramadaId, query.compraProgramadaId));
    }
    const where = filtros.length ? and(...filtros) : undefined;

    return this.db.select().from(disponibilidadesVirtuais).where(where).orderBy(disponibilidadesVirtuais.itemComercialId);
  }
}
