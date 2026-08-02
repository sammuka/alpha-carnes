import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { ajustesEstoque, associacoesPecaHistorico, entradasItens, pecas, subitens } from '../../../database/schema';
import type { HistoricoParams } from './dto/estoque.dto';

export interface EventoHistorico {
  descricao: string;
  dataHora: string;
}

const ROTULO_ACAO: Record<string, string> = {
  confirmar: 'Destinada ao pedido',
  destinar_estoque: 'Destinada ao pedido',
  sobra: 'Enviada ao estoque',
  estorno: 'Estornada',
  redirecionar: 'Redirecionada para outro pedido',
  analise: 'Enviada para análise',
  corte: 'Enviada para corte',
  divergencia: 'Divergência registrada',
  troca_saida: 'Retirada por troca de peça',
  troca_entrada: 'Inserida por troca de peça',
};

@Injectable()
export class HistoricoEstoqueService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async obter(params: HistoricoParams): Promise<EventoHistorico[]> {
    if (params.tipo === 'peca') return this.obterDePeca(params.id);
    if (params.tipo === 'subitem') return this.obterDeSubitem(params.id);
    return this.obterDeEntrada(params.id);
  }

  private async obterDePeca(pecaId: string): Promise<EventoHistorico[]> {
    const peca = await this.db
      .select({ createdAt: pecas.createdAt })
      .from(pecas)
      .where(and(eq(pecas.id, pecaId), isNull(pecas.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!peca) throw new NotFoundException('Peça não encontrada');

    const historico = await this.db
      .select({ acao: associacoesPecaHistorico.acao, createdAt: associacoesPecaHistorico.createdAt })
      .from(associacoesPecaHistorico)
      .where(eq(associacoesPecaHistorico.pecaId, pecaId))
      .orderBy(asc(associacoesPecaHistorico.createdAt));

    const ajustes = await this.db
      .select({ status: ajustesEstoque.status, decididoEm: ajustesEstoque.decididoEm, createdAt: ajustesEstoque.createdAt })
      .from(ajustesEstoque)
      .where(eq(ajustesEstoque.pecaId, pecaId));

    const eventos: EventoHistorico[] = [
      { descricao: 'Recebida e destinada ao estoque', dataHora: peca.createdAt.toISOString() },
      ...historico.map((h) => ({ descricao: ROTULO_ACAO[h.acao] ?? h.acao, dataHora: h.createdAt.toISOString() })),
      ...this.eventosDeAjuste(ajustes),
    ];
    return eventos.sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  }

  private async obterDeSubitem(subitemId: string): Promise<EventoHistorico[]> {
    const subitem = await this.db
      .select({ createdAt: subitens.createdAt })
      .from(subitens)
      .where(and(eq(subitens.id, subitemId), isNull(subitens.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!subitem) throw new NotFoundException('Subitem não encontrado');

    const historico = await this.db
      .select({ acao: associacoesPecaHistorico.acao, createdAt: associacoesPecaHistorico.createdAt })
      .from(associacoesPecaHistorico)
      .where(eq(associacoesPecaHistorico.subitemId, subitemId))
      .orderBy(asc(associacoesPecaHistorico.createdAt));

    const ajustes = await this.db
      .select({ status: ajustesEstoque.status, decididoEm: ajustesEstoque.decididoEm, createdAt: ajustesEstoque.createdAt })
      .from(ajustesEstoque)
      .where(eq(ajustesEstoque.subitemId, subitemId));

    const eventos: EventoHistorico[] = [
      { descricao: 'Gerada na desossa e enviada ao estoque', dataHora: subitem.createdAt.toISOString() },
      ...historico.map((h) => ({ descricao: ROTULO_ACAO[h.acao] ?? h.acao, dataHora: h.createdAt.toISOString() })),
      ...this.eventosDeAjuste(ajustes),
    ];
    return eventos.sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  }

  private async obterDeEntrada(entradaId: string): Promise<EventoHistorico[]> {
    const entrada = await this.db
      .select({ createdAt: entradasItens.createdAt, destino: entradasItens.destino, pedidoId: entradasItens.pedidoId })
      .from(entradasItens)
      .where(and(eq(entradasItens.id, entradaId), isNull(entradasItens.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!entrada) throw new NotFoundException('Entrada não encontrada');

    const ajustes = await this.db
      .select({ status: ajustesEstoque.status, decididoEm: ajustesEstoque.decididoEm, createdAt: ajustesEstoque.createdAt })
      .from(ajustesEstoque)
      .where(eq(ajustesEstoque.entradaId, entradaId));

    const eventos: EventoHistorico[] = [
      { descricao: 'Entrada registrada (Entrada de Itens)', dataHora: entrada.createdAt.toISOString() },
      ...this.eventosDeAjuste(ajustes),
    ];
    if (entrada.pedidoId) {
      eventos.push({ descricao: 'Destinada ao pedido', dataHora: entrada.createdAt.toISOString() });
    }
    return eventos.sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  }

  private eventosDeAjuste(
    ajustes: Array<{ status: string; decididoEm: Date | null; createdAt: Date }>,
  ): EventoHistorico[] {
    return ajustes.map((a) => ({
      descricao: a.status === 'aplicado' ? 'Ajuste de estoque aplicado' : a.status === 'rejeitado' ? 'Ajuste de estoque rejeitado' : 'Ajuste de estoque aguardando aprovação',
      dataHora: (a.decididoEm ?? a.createdAt).toISOString(),
    }));
  }
}
