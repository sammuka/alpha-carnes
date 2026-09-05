import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  caminhoes,
  caminhoesPedidos,
  clientes,
  operacoes,
  pecas,
  pedidosVenda,
  pedidosVendaItens,
  produtos,
  recebimentos,
  regrasTransformacao,
  regrasTransformacaoSaidas,
  representantes,
} from '../../../database/schema';
import { FaltasService } from './faltas.service';
import type { PainelQuery } from './dto/painel.dto';
import {
  montarPainelDesossa,
  type FaltaPainelInput,
  type PainelRegraInput,
} from './painel.calc';

@Injectable()
export class PainelDesossaService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly faltas: FaltasService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /** Próxima carga do item comercial — protótipo cols Rota/Carga, Representante, Alvo. */
  private async contextoCargaPorproduto(
    produtoIds: string[],
  ): Promise<
    Map<string, { rota: string | null; representante: string | null; horarioAlvo: string | null }>
  > {
    const mapa = new Map<
      string,
      { rota: string | null; representante: string | null; horarioAlvo: string | null }
    >();
    if (produtoIds.length === 0) return mapa;

    const linhas = await this.db
      .select({
        produtoId: pedidosVendaItens.produtoId,
        rotaCaminhao: caminhoes.rota,
        rotaPrevista: pedidosVenda.rotaPrevista,
        horaAbertura: caminhoes.horaAberturaCarga,
        representanteNome: representantes.nome,
      })
      .from(pedidosVendaItens)
      .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
      .innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .leftJoin(representantes, eq(representantes.id, clientes.representanteId))
      .leftJoin(
        caminhoesPedidos,
        and(eq(caminhoesPedidos.pedidoVendaId, pedidosVenda.id), isNull(caminhoesPedidos.deletedAt)),
      )
      .leftJoin(
        caminhoes,
        and(eq(caminhoes.id, caminhoesPedidos.caminhaoId), isNull(caminhoes.deletedAt)),
      )
      .where(
        and(
          isNull(pedidosVenda.deletedAt),
          isNull(pedidosVendaItens.deletedAt),
          inArray(pedidosVendaItens.produtoId, produtoIds),
          inArray(pedidosVenda.status, [
            'em_elaboracao_reserva_ativa',
            'aguardando_confirmacao_overbooking',
            'finalizado',
            'parcialmente_atendido',
          ]),
        ),
      )
      .orderBy(asc(caminhoes.horaAberturaCarga));

    for (const l of linhas) {
      if (mapa.has(l.produtoId)) continue;
      const hora = l.horaAbertura
        ? new Date(l.horaAbertura as Date).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          })
        : null;
      const rotaBase = l.rotaCaminhao ?? l.rotaPrevista;
      const rota =
        rotaBase && hora
          ? `Carga ${rotaBase} ${hora}`
          : rotaBase
            ? `Carga ${rotaBase}`
            : null;
      mapa.set(l.produtoId, {
        rota,
        representante: l.representanteNome,
        horarioAlvo: hora,
      });
    }
    return mapa;
  }

  async obter(q: PainelQuery) {
    const listaFaltas = await this.faltas.listarFaltas();
    const produtosRows =
      listaFaltas.length === 0
        ? []
        : await this.db
            .select({ id: produtos.id, legado: produtos.id })
            .from(produtos)
            .where(
              inArray(
                produtos.id,
                listaFaltas.map((f) => f.produto.id),
              ),
            );
    const produtoParaItem = new Map(produtosRows.map((r) => [r.id, r.legado]));
    const produtoIds = [
      ...new Set(produtosRows.map((r) => r.legado).filter((x): x is string => !!x)),
    ];
    const contextos = await this.contextoCargaPorproduto(produtoIds);

    const faltasPainel: FaltaPainelInput[] = listaFaltas.map((f) => {
      const itemId = produtoParaItem.get(f.produto.id) ?? null;
      const ctx = itemId ? contextos.get(itemId) : undefined;
      return {
        ...f,
        rota: ctx?.rota ?? null,
        representante: ctx?.representante ?? null,
        horarioAlvo: ctx?.horarioAlvo ?? null,
      };
    });

    const [tzRow] = await this.db
      .select({ n: sql<string>`count(*)::text` })
      .from(pecas)
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .where(
        and(
          isNull(pecas.deletedAt),
          inArray(pecas.statusPeca, ['para_corte', 'em_transformacao']),
          q.operacaoId ? eq(recebimentos.operacaoId, q.operacaoId) : sql`true`,
        ),
      );
    const tzsNaDesossa = Number.parseInt(tzRow?.n ?? '0', 10) || 0;

    const regrasDb = await this.db
      .select()
      .from(regrasTransformacao)
      .where(and(eq(regrasTransformacao.status, 'ativo'), isNull(regrasTransformacao.deletedAt)));
    const regras: PainelRegraInput[] = [];
    for (const r of regrasDb) {
      const saidas = await this.db
        .select({ codigo: produtos.codigo, qtd: regrasTransformacaoSaidas.quantidadeFixa })
        .from(regrasTransformacaoSaidas)
        .innerJoin(produtos, eq(produtos.id, regrasTransformacaoSaidas.produtoId))
        .where(eq(regrasTransformacaoSaidas.regraId, r.id));
      regras.push({
        id: r.id,
        codigo: r.codigo,
        nome: r.nome,
        provisorio: r.provisorio,
        prioridade: r.prioridade,
        saidasLabel: saidas.map((s) => `${s.qtd}× ${s.codigo}`).join(' + '),
        saidasCodigos: saidas.map((s) => s.codigo).filter((c): c is string => !!c),
      });
    }

    let operacaoId = q.operacaoId ?? null;
    if (!operacaoId) {
      const [op] = await this.db
        .select({ id: operacoes.id })
        .from(operacoes)
        .where(
          and(
            isNull(operacoes.deletedAt),
            inArray(operacoes.status, ['aberta', 'em_andamento']),
          ),
        )
        .orderBy(desc(operacoes.data))
        .limit(1);
      operacaoId = op?.id ?? null;
    }
    if (!operacaoId) {
      throw new NotFoundException({
        codigo: 'OPERACAO_NAO_ENCONTRADA',
        mensagem: 'Nenhuma operação aberta/em_andamento para o painel da desossa',
      });
    }

    return montarPainelDesossa({
      faltas: faltasPainel,
      regras,
      modoTv: q.modoTv === true,
      geradoEm: new Date().toISOString(),
      tzsNaDesossa,
      operacaoId,
    });
  }
}
