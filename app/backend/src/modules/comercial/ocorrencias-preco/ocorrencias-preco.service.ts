import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { alias } from 'drizzle-orm/pg-core';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { calcularRange, montarPaginado } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  clientes,
  ocorrenciasAjustePreco,
  ocorrenciasAjustePrecoItens,
  operacoes,
  pedidosVenda,
  produtos,
  representantes,
  usuarios,
} from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import type {
  ListarOcorrenciasPrecoQuery,
  OcorrenciaPrecoDetalhe,
  OcorrenciaPrecoItem,
  OcorrenciaPrecoLista,
  RelatorioQuery,
  RelatorioAjustePrecoEnvelope,
  RelatorioAjustePrecoItem,
  RelatorioAjustePrecoPedido,
} from './dto/ocorrencia-preco.dto';

const usuarioFinalizacao = alias(usuarios, 'usuario_finalizacao');
const usuarioCiente = alias(usuarios, 'usuario_ciente');
const usuarioAjuste = alias(usuarios, 'usuario_ajuste');

@Injectable()
export class OcorrenciasPrecoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarOcorrenciasPrecoQuery) {
    const filtros = [
      eq(pedidosVenda.operacaoId, query.operacaoId),
      query.status ? eq(ocorrenciasAjustePreco.status, query.status) : undefined,
      query.clienteId ? eq(ocorrenciasAjustePreco.clienteId, query.clienteId) : undefined,
      query.dataInicio
        ? sql`${ocorrenciasAjustePreco.dataHoraOcorrencia}::date >= ${query.dataInicio}::date`
        : undefined,
      query.dataFim
        ? sql`${ocorrenciasAjustePreco.dataHoraOcorrencia}::date <= ${query.dataFim}::date`
        : undefined,
    ].filter(Boolean);

    const where = and(...filtros);
    const { limit, offset } = calcularRange(query);

    const [linhas, totalRow] = await Promise.all([
      this.db.select({
        id: ocorrenciasAjustePreco.id,
        pedidoVendaId: ocorrenciasAjustePreco.pedidoVendaId,
        clienteNomeFantasia: clientes.nomeFantasia,
        status: ocorrenciasAjustePreco.status,
        dataHoraOcorrencia: ocorrenciasAjustePreco.dataHoraOcorrencia,
        usuarioFinalizacaoNome: usuarioFinalizacao.nome,
        quantidadeItensAjustados: ocorrenciasAjustePreco.quantidadeItensAjustados,
        diferencaTotal: ocorrenciasAjustePreco.diferencaTotal,
      })
        .from(ocorrenciasAjustePreco)
        .innerJoin(pedidosVenda, eq(ocorrenciasAjustePreco.pedidoVendaId, pedidosVenda.id))
        .innerJoin(clientes, eq(ocorrenciasAjustePreco.clienteId, clientes.id))
        .leftJoin(usuarioFinalizacao, eq(usuarioFinalizacao.id, ocorrenciasAjustePreco.usuarioFinalizacaoId))
        .where(where)
        .orderBy(desc(ocorrenciasAjustePreco.dataHoraOcorrencia))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` })
        .from(ocorrenciasAjustePreco)
        .innerJoin(pedidosVenda, eq(ocorrenciasAjustePreco.pedidoVendaId, pedidosVenda.id))
        .where(where),
    ]);

    const data: OcorrenciaPrecoLista[] = linhas.map((l) => ({
      id: l.id,
      pedidoNumero: l.pedidoVendaId,
      clienteNomeFantasia: l.clienteNomeFantasia,
      status: l.status as 'aberta' | 'ciente',
      dataHora: l.dataHoraOcorrencia.toISOString(),
      usuarioFinalizacaoNome: l.usuarioFinalizacaoNome,
      quantidadeItensAjustados: l.quantidadeItensAjustados,
      diferencaTotal: String(l.diferencaTotal),
    }));

    return montarPaginado(data, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<OcorrenciaPrecoDetalhe> {
    const [cabecalho] = await this.db.select({
      id: ocorrenciasAjustePreco.id,
      pedidoVendaId: ocorrenciasAjustePreco.pedidoVendaId,
      clienteNomeFantasia: clientes.nomeFantasia,
      status: ocorrenciasAjustePreco.status,
      dataHoraOcorrencia: ocorrenciasAjustePreco.dataHoraOcorrencia,
      usuarioFinalizacaoNome: usuarioFinalizacao.nome,
      quantidadeItensAjustados: ocorrenciasAjustePreco.quantidadeItensAjustados,
      diferencaTotal: ocorrenciasAjustePreco.diferencaTotal,
      usuarioCienteNome: usuarioCiente.nome,
      dataHoraCiente: ocorrenciasAjustePreco.dataHoraCiente,
    })
      .from(ocorrenciasAjustePreco)
      .innerJoin(clientes, eq(ocorrenciasAjustePreco.clienteId, clientes.id))
      .leftJoin(usuarioFinalizacao, eq(usuarioFinalizacao.id, ocorrenciasAjustePreco.usuarioFinalizacaoId))
      .leftJoin(usuarioCiente, eq(usuarioCiente.id, ocorrenciasAjustePreco.usuarioCienteId))
      .where(eq(ocorrenciasAjustePreco.id, id));

    if (!cabecalho) throw new NotFoundException('Ocorrência não encontrada');

    const itensRows = await this.db.select({
      produtoCodigo: produtos.codigo,
      produtoNome: produtos.nome,
      precoTabelaOriginal: ocorrenciasAjustePrecoItens.precoTabelaOriginal,
      precoAplicado: ocorrenciasAjustePrecoItens.precoAplicado,
      diferencaAbsoluta: ocorrenciasAjustePrecoItens.diferencaAbsoluta,
      diferencaPercentual: ocorrenciasAjustePrecoItens.diferencaPercentual,
      usuarioAjusteNome: usuarioAjuste.nome,
    })
      .from(ocorrenciasAjustePrecoItens)
      .innerJoin(produtos, eq(ocorrenciasAjustePrecoItens.produtoId, produtos.id))
      .leftJoin(usuarioAjuste, eq(usuarioAjuste.id, ocorrenciasAjustePrecoItens.usuarioAjusteId))
      .where(eq(ocorrenciasAjustePrecoItens.ocorrenciaId, id));

    const itens: OcorrenciaPrecoItem[] = itensRows.map((i) => ({
      produtoCodigo: i.produtoCodigo,
      produtoNome: i.produtoNome,
      precoTabelaOriginal: i.precoTabelaOriginal != null ? String(i.precoTabelaOriginal) : null,
      precoAplicado: String(i.precoAplicado),
      diferencaAbsoluta: String(i.diferencaAbsoluta),
      diferencaPercentual: i.diferencaPercentual != null ? String(i.diferencaPercentual) : null,
      usuarioAjusteNome: i.usuarioAjusteNome,
    }));

    return {
      id: cabecalho.id,
      pedidoNumero: cabecalho.pedidoVendaId,
      clienteNomeFantasia: cabecalho.clienteNomeFantasia,
      status: cabecalho.status as 'aberta' | 'ciente',
      dataHora: cabecalho.dataHoraOcorrencia.toISOString(),
      usuarioFinalizacaoNome: cabecalho.usuarioFinalizacaoNome,
      quantidadeItensAjustados: cabecalho.quantidadeItensAjustados,
      diferencaTotal: String(cabecalho.diferencaTotal),
      itens,
      usuarioCienteNome: cabecalho.usuarioCienteNome,
      dataHoraCiente: cabecalho.dataHoraCiente?.toISOString() ?? null,
    };
  }

  async marcarCiente(id: string, usuarioId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const [anterior] = await tx.select().from(ocorrenciasAjustePreco)
        .where(eq(ocorrenciasAjustePreco.id, id));
      if (!anterior) throw new NotFoundException('Ocorrência não encontrada');
      if (anterior.status === 'ciente') {
        throw new ConflictException({ code: 'OCORRENCIA_JA_CIENTE' });
      }

      const [atualizada] = await tx.update(ocorrenciasAjustePreco)
        .set({
          status: 'ciente',
          usuarioCienteId: usuarioId,
          dataHoraCiente: sql`now()`,
        })
        .where(eq(ocorrenciasAjustePreco.id, id))
        .returning();
      if (!atualizada) throw new Error('Falha ao marcar ocorrência como ciente');

      await this.auditoria.registrar(tx, {
        tabela: 'ocorrencias_ajuste_preco',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: atualizada,
      });

      const [operacaoRow] = await tx.select({ data: operacoes.data })
        .from(pedidosVenda)
        .innerJoin(operacoes, eq(pedidosVenda.operacaoId, operacoes.id))
        .where(eq(pedidosVenda.id, atualizada.pedidoVendaId));

      return {
        ocorrencia: atualizada,
        dataOperacao: operacaoRow?.data ?? '',
      };
    });

    this.eventEmitter.emit(EVENTOS.OCORRENCIA_AJUSTE_PRECO_CIENTE, {
      ocorrenciaId: resultado.ocorrencia.id,
      pedidoVendaId: resultado.ocorrencia.pedidoVendaId,
      clienteId: resultado.ocorrencia.clienteId,
      dataOperacao: resultado.dataOperacao,
    });

    return this.detalhar(id);
  }

  async relatorio(query: RelatorioQuery): Promise<RelatorioAjustePrecoEnvelope> {
    const faixaCongeladaSql = sql`(
      SELECT pvi.faixa_preco
      FROM pedidos_venda_itens pvi
      WHERE pvi.pedido_venda_id = ${ocorrenciasAjustePreco.pedidoVendaId}
        AND pvi.deleted_at IS NULL
      ORDER BY pvi.created_at ASC, pvi.id ASC
      LIMIT 1
    )`;

    const filtros = [
      sql`${operacoes.data} >= ${query.dataInicio}::date`,
      sql`${operacoes.data} <= ${query.dataFim}::date`,
      query.clienteId ? eq(ocorrenciasAjustePreco.clienteId, query.clienteId) : undefined,
      query.representanteId ? eq(clientes.representanteId, query.representanteId) : undefined,
      query.faixaPreco ? sql`${faixaCongeladaSql} = ${query.faixaPreco}` : undefined,
      query.produtoId
        ? sql`EXISTS (
            SELECT 1 FROM ocorrencias_ajuste_preco_itens oapi
            WHERE oapi.ocorrencia_id = ${ocorrenciasAjustePreco.id}
              AND oapi.produto_id = ${query.produtoId}
          )`
        : undefined,
    ].filter(Boolean);

    const where = and(...filtros);
    const { limit, offset } = calcularRange(query);

    const [pagina, totalRow] = await Promise.all([
      this.db.select({
        ocorrenciaId: ocorrenciasAjustePreco.id,
        pedidoVendaId: ocorrenciasAjustePreco.pedidoVendaId,
        clienteNomeFantasia: clientes.nomeFantasia,
        representanteNome: representantes.nome,
        dataPedido: operacoes.data,
        faixaPreco: sql<'A' | 'B' | 'C' | 'D'>`${faixaCongeladaSql}`.as('faixa_preco'),
        quantidadeItensAjustados: ocorrenciasAjustePreco.quantidadeItensAjustados,
        valorTotalAjustado: ocorrenciasAjustePreco.diferencaTotal,
      })
        .from(ocorrenciasAjustePreco)
        .innerJoin(pedidosVenda, eq(ocorrenciasAjustePreco.pedidoVendaId, pedidosVenda.id))
        .innerJoin(operacoes, eq(pedidosVenda.operacaoId, operacoes.id))
        .innerJoin(clientes, eq(ocorrenciasAjustePreco.clienteId, clientes.id))
        .leftJoin(representantes, eq(clientes.representanteId, representantes.id))
        .where(where)
        .orderBy(desc(operacoes.data), desc(ocorrenciasAjustePreco.dataHoraOcorrencia))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` })
        .from(ocorrenciasAjustePreco)
        .innerJoin(pedidosVenda, eq(ocorrenciasAjustePreco.pedidoVendaId, pedidosVenda.id))
        .innerJoin(operacoes, eq(pedidosVenda.operacaoId, operacoes.id))
        .innerJoin(clientes, eq(ocorrenciasAjustePreco.clienteId, clientes.id))
        .where(where),
    ]);

    const ocorrenciaIds = pagina.map((p) => p.ocorrenciaId);
    const itensPorOcorrencia = new Map<string, RelatorioAjustePrecoItem[]>();

    if (ocorrenciaIds.length > 0) {
      const itensRows = await this.db.select({
        ocorrenciaId: ocorrenciasAjustePrecoItens.ocorrenciaId,
        produtoCodigo: produtos.codigo,
        produtoNome: produtos.nome,
        precoTabelaOriginal: ocorrenciasAjustePrecoItens.precoTabelaOriginal,
        precoAplicado: ocorrenciasAjustePrecoItens.precoAplicado,
        diferencaAbsoluta: ocorrenciasAjustePrecoItens.diferencaAbsoluta,
        diferencaPercentual: ocorrenciasAjustePrecoItens.diferencaPercentual,
        usuarioAjusteNome: usuarioAjuste.nome,
      })
        .from(ocorrenciasAjustePrecoItens)
        .innerJoin(produtos, eq(ocorrenciasAjustePrecoItens.produtoId, produtos.id))
        .leftJoin(usuarioAjuste, eq(usuarioAjuste.id, ocorrenciasAjustePrecoItens.usuarioAjusteId))
        .where(inArray(ocorrenciasAjustePrecoItens.ocorrenciaId, ocorrenciaIds));

      for (const row of itensRows) {
        const item: RelatorioAjustePrecoItem = {
          produtoCodigo: row.produtoCodigo,
          produtoNome: row.produtoNome,
          precoTabelaOriginal: row.precoTabelaOriginal != null ? String(row.precoTabelaOriginal) : null,
          precoAplicado: String(row.precoAplicado),
          diferencaAbsoluta: String(row.diferencaAbsoluta),
          diferencaPercentual: row.diferencaPercentual != null ? String(row.diferencaPercentual) : null,
          usuarioAjusteNome: row.usuarioAjusteNome,
        };
        const lista = itensPorOcorrencia.get(row.ocorrenciaId) ?? [];
        lista.push(item);
        itensPorOcorrencia.set(row.ocorrenciaId, lista);
      }
    }

    const data: RelatorioAjustePrecoPedido[] = pagina.map((p) => ({
      pedidoVendaId: p.pedidoVendaId,
      pedidoNumero: p.pedidoVendaId,
      clienteNomeFantasia: p.clienteNomeFantasia,
      representanteNome: p.representanteNome,
      dataPedido: p.dataPedido,
      faixaPreco: p.faixaPreco,
      quantidadeItensAjustados: p.quantidadeItensAjustados,
      valorTotalAjustado: String(p.valorTotalAjustado),
      itens: itensPorOcorrencia.get(p.ocorrenciaId) ?? [],
    }));

    return montarPaginado(data, totalRow[0]?.total ?? 0, query);
  }
}
