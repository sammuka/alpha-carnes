import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { caminhoes, cargaItens, notasFiscais, segurosCarga, parametros } from '../../../database/schema';

export interface RequisitoChecklist {
  chave: 'cargaConferida' | 'notasAutorizadas' | 'seguroConfirmado' | 'caminhaoMotorista';
  rotulo: string;
  ok: boolean;
  detalhe: string;
}

const STATUS_CARGA_CONFERIDA = ['fechado', 'liberado_faturamento', 'faturado', 'liberado_saida', 'expedido'];

@Injectable()
export class LiberacaoChecklistService {
  constructor(@Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> }) {}
  private get db() { return this.drizzle.db; }

  /** D10.6 — checklist calculado sem tabela própria. */
  async calcular(caminhaoId: string): Promise<{ requisitos: RequisitoChecklist[]; liberavel: boolean }> {
    const caminhao = await this.db.select().from(caminhoes)
      .where(and(eq(caminhoes.id, caminhaoId), isNull(caminhoes.deletedAt))).then((r) => r[0] ?? null);
    if (!caminhao) throw new NotFoundException('Caminhão não encontrado');

    // (1) cargaConferida
    const cargaConferida = STATUS_CARGA_CONFERIDA.includes(caminhao.statusCaminhao);

    // (2) notasAutorizadas — pedidos da carga vs notas emitidas
    const itensCarga = await this.db.select({ pedidoVendaId: cargaItens.pedidoVendaId }).from(cargaItens)
      .where(and(eq(cargaItens.caminhaoId, caminhaoId), ne(cargaItens.statusCargaItem, 'removido'), isNull(cargaItens.deletedAt)));
    const pedidoIds = [...new Set(itensCarga.map((i) => i.pedidoVendaId))];
    const notas = pedidoIds.length
      ? await this.db.select().from(notasFiscais).where(and(inArray(notasFiscais.pedidoVendaId, pedidoIds), isNull(notasFiscais.deletedAt)))
      : [];
    const notasAutorizadas = notas.filter((n) => n.statusNfse === 'emitida').length;
    const notasTotal = pedidoIds.length;

    // (3) seguroConfirmado — dispensável por parâmetro faturamento.seguro_obrigatorio
    const seguroObrigatorioParam = await this.db.select().from(parametros)
      .where(eq(parametros.chave, 'faturamento.seguro_obrigatorio')).then((r) => r[0] ?? null);
    const seguroObrigatorio = (seguroObrigatorioParam?.valorJson as { valor?: unknown })?.valor !== false;
    const seguro = await this.db.select().from(segurosCarga)
      .where(and(eq(segurosCarga.caminhaoId, caminhaoId), isNull(segurosCarga.deletedAt))).then((r) => r[0] ?? null);
    const seguroOk = !seguroObrigatorio || seguro?.status === 'confirmado';

    // (4) caminhaoMotorista
    const caminhaoMotoristaOk = Boolean(caminhao.placa?.trim()) && Boolean(caminhao.motorista?.trim());

    const requisitos: RequisitoChecklist[] = [
      { chave: 'cargaConferida', rotulo: 'Carga conferida', ok: cargaConferida, detalhe: cargaConferida ? 'Conferência concluída' : 'Não conferida' },
      { chave: 'notasAutorizadas', rotulo: 'NF-e(s) autorizadas', ok: notasTotal > 0 && notasAutorizadas === notasTotal, detalhe: `${notasAutorizadas} de ${notasTotal}` },
      { chave: 'seguroConfirmado', rotulo: 'Seguro confirmado', ok: seguroOk, detalhe: !seguroObrigatorio ? 'dispensado por parâmetro' : (seguro?.status ?? 'pendente') },
      { chave: 'caminhaoMotorista', rotulo: 'Caminhão/motorista preenchidos', ok: caminhaoMotoristaOk, detalhe: caminhaoMotoristaOk ? 'Completos' : 'Incompletos' },
    ];

    return { requisitos, liberavel: requisitos.every((r) => r.ok) };
  }
}
