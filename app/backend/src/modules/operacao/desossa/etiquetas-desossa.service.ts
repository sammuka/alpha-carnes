import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import { montarPaginado, type Paginado } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  caminhoes,
  cargaItens,
  clientes,
  etiquetasImpressoes,
  itensComerciais,
  pecas,
  pedidosVenda,
  recebimentos,
  subitens,
  transformacoes,
} from '../../../database/schema';
import { STATUS_CAMINHAO_FECHADO } from '../pesagem/carga-fechada';

export const listarEtiquetasDesossaSchema = z.object({
  operacaoId: z.string().uuid(),
  transformacaoId: z.string().uuid().optional(),
  estado: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListarEtiquetasDesossaDto = z.infer<typeof listarEtiquetasDesossaSchema>;

export type EtiquetaDesossaListada = {
  id: string;
  codigo: string | null;
  parteCodigo: string | null;
  produtoCodigo: string;
  produtoNome: string;
  peso: string | null;
  origemPeso: 'balanca' | 'manual' | string | null;
  destino: 'pedido' | 'estoque' | string;
  clientePedido: string | null;
  pecaMaeCodigo: string | null;
  estado: string;
  transformacaoId: string;
  subitemId: string;
  createdAt: string;
  invalidadaEm: string | null;
  bloqueada: boolean;
  pendenteImpressao: boolean;
};

@Injectable()
export class EtiquetasDesossaService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(
    filtros: ListarEtiquetasDesossaDto,
  ): Promise<Paginado<EtiquetaDesossaListada>> {
    const statusFechado = STATUS_CAMINHAO_FECHADO.map((s) => `'${s}'`).join(',');
    const condicoes = [
      eq(recebimentos.operacaoId, filtros.operacaoId),
      isNotNull(etiquetasImpressoes.subitemId),
    ];
    if (filtros.transformacaoId) {
      condicoes.push(eq(transformacoes.id, filtros.transformacaoId));
    }
    if (filtros.estado) {
      condicoes.push(eq(etiquetasImpressoes.estado, filtros.estado));
    }

    const linhas = await this.db
      .select({
        id: etiquetasImpressoes.id,
        codigo: sql<string | null>`${etiquetasImpressoes.payload}->>'qr'`,
        estado: etiquetasImpressoes.estado,
        peso: subitens.peso,
        modoCapturaPeso: subitens.modoCapturaPeso,
        produtoCodigo: itensComerciais.codigo,
        produtoNome: itensComerciais.descricao,
        parteCodigo: subitens.etiquetaAtual,
        pecaMaeCodigo: pecas.etiquetaAtual,
        transformacaoId: transformacoes.id,
        subitemId: subitens.id,
        pedidoVendaId: subitens.pedidoVendaId,
        clienteNome: clientes.nomeFantasia,
        pedidoCodigo: pedidosVenda.id,
        createdAt: etiquetasImpressoes.createdAt,
        invalidadaEm: etiquetasImpressoes.invalidadaEm,
        statusImpressao: etiquetasImpressoes.statusImpressao,
        // Emenda 4 — bloqueada por SUBITEM em carga fechada (não peca_id da mãe).
        bloqueada: sql<boolean>`(
          EXISTS (
            SELECT 1
              FROM ${cargaItens} ci
              JOIN ${caminhoes} c ON c.id = ci.caminhao_id
             WHERE ci.subitem_id = ${subitens.id}
               AND ci.deleted_at IS NULL
               AND ci.status_carga_item <> 'removido'
               AND c.status_caminhao IN (${sql.raw(statusFechado)})
          )
        )`,
      })
      .from(etiquetasImpressoes)
      .innerJoin(subitens, eq(subitens.id, etiquetasImpressoes.subitemId))
      .innerJoin(transformacoes, eq(transformacoes.id, subitens.transformacaoId))
      .innerJoin(pecas, eq(pecas.id, transformacoes.pecaOrigemId))
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .innerJoin(itensComerciais, eq(itensComerciais.id, subitens.itemComercialId))
      .leftJoin(pedidosVenda, eq(pedidosVenda.id, subitens.pedidoVendaId))
      .leftJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .where(and(...condicoes, isNull(subitens.deletedAt)))
      .orderBy(desc(etiquetasImpressoes.createdAt));

    const itens: EtiquetaDesossaListada[] = linhas.map((l) => {
      const origemPeso =
        l.modoCapturaPeso === 'automatico'
          ? 'balanca'
          : l.modoCapturaPeso === 'manual_assistido'
            ? 'manual'
            : l.modoCapturaPeso;
      const clientePedido =
        l.pedidoVendaId && l.clienteNome
          ? `${l.clienteNome} / ${l.pedidoCodigo}`
          : l.pedidoVendaId
            ? String(l.pedidoCodigo)
            : null;
      return {
        id: l.id,
        codigo: l.codigo,
        parteCodigo: l.parteCodigo,
        produtoCodigo: l.produtoCodigo,
        produtoNome: l.produtoNome,
        peso: l.peso,
        origemPeso,
        destino: l.pedidoVendaId ? 'pedido' : 'estoque',
        clientePedido,
        pecaMaeCodigo: l.pecaMaeCodigo,
        estado: l.estado,
        transformacaoId: l.transformacaoId,
        subitemId: l.subitemId,
        createdAt: new Date(l.createdAt as Date).toISOString(),
        invalidadaEm: l.invalidadaEm
          ? new Date(l.invalidadaEm as Date).toISOString()
          : null,
        bloqueada: Boolean(l.bloqueada),
        pendenteImpressao: l.statusImpressao === 'pendente',
      };
    });

    const inicio = (filtros.page - 1) * filtros.pageSize;
    return montarPaginado(itens.slice(inicio, inicio + filtros.pageSize), itens.length, {
      page: filtros.page,
      pageSize: filtros.pageSize,
    });
  }
}
