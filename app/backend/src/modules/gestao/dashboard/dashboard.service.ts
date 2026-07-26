import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, isNull, lt, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { formatarQtd } from '../../../common/crud/decimal';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  auditoria,
  clientes,
  itensComerciais,
  pedidosVenda,
  pedidosVendaItens,
  pecas,
  usuarios,
} from '../../../database/schema';
import { OperacoesService } from '../../operacoes/operacoes.service';

export interface PedidoEmAndamento {
  pedidoId: string;
  clienteNome: string;
  produtoResumo: string;
  pesoTotalKg: string | null;
  status: string;
  dataOperacao: string;
}

export interface AtividadeRecente {
  id: string;
  usuarioNome: string;
  descricao: string;
  createdAt: string;
}

export interface KpiDashboard {
  chave: string;
  valor: string;
  detalhe: string;
}

export interface AlertaOperacional {
  chave: 'overbooking_aberto' | 'divergencia_recebimento' | 'tz_aguardando_desossa' | 'seguro_pendente';
  titulo: string;
  descricao: string;
  severidade: 'critico' | 'atencao' | 'informativo';
  ocorridoEm: string;
}

export interface DashboardOperacao {
  operacao: { id: string; data: string; rotulo: string; status: string; extraordinaria: boolean };
  kpis: KpiDashboard[];
  pedidosEmAndamento: PedidoEmAndamento[];
  alertas: AlertaOperacional[];
  atividadesRecentes: AtividadeRecente[];
}

const DETALHES_KPI: Record<string, string> = {
  compras_programadas: 'operações do dia',
  disponibilidade_total: 'saldo consolidado',
  reservas_em_elaboracao: 'pedidos com reserva ativa',
  pedidos_finalizados: 'prontos para expedição',
  overbookings_abertos: 'aguardando decisão',
  recebimentos_aguardados: 'em andamento',
  divergencias_abertas: 'encaminhadas ao administrativo',
  pecas_em_desossa: 'aguardando encaminhamento',
  relatorios_sif_pendentes: 'dados incompletos',
  faturamentos_pendentes: 'NFS-e pendente',
};

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly operacoes: OperacoesService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async resumo(operacaoId?: string): Promise<DashboardOperacao> {
    const operacao = operacaoId
      ? await this.operacoes.detalhar(operacaoId)
      : await this.operacoes.resolverCorrente().catch((err) => {
        if (err instanceof NotFoundException) {
          throw new NotFoundException('OPERACAO_INEXISTENTE');
        }
        throw err;
      });

    const linha = await this.db.execute<Record<string, string>>(sql`
      SELECT
        (SELECT count(*)::int FROM compras_programadas cp
          WHERE cp.operacao_id = ${operacao.id} AND cp.deleted_at IS NULL
            AND cp.status <> 'cancelada')::text AS compras_programadas,
        (SELECT coalesce(sum(dv.quantidade_disponivel), 0)::text FROM disponibilidades_virtuais dv
           JOIN compras_programadas cp2 ON cp2.id = dv.compra_programada_id
          WHERE cp2.operacao_id = ${operacao.id} AND cp2.deleted_at IS NULL) AS disponibilidade_total,
        (SELECT count(DISTINCT pv.id)::int FROM pedidos_venda pv
           JOIN pedidos_venda_itens pvi ON pvi.pedido_venda_id = pv.id AND pvi.deleted_at IS NULL
           JOIN reservas_disponibilidade rd ON rd.pedido_venda_item_id = pvi.id AND rd.status = 'ativa'
          WHERE pv.operacao_id = ${operacao.id} AND pv.deleted_at IS NULL
            AND pv.status IN ('rascunho','em_elaboracao_reserva_ativa'))::text AS reservas_em_elaboracao,
        (SELECT count(*)::int FROM pedidos_venda pv
          WHERE pv.operacao_id = ${operacao.id} AND pv.deleted_at IS NULL
            AND pv.status = 'finalizado')::text AS pedidos_finalizados,
        (SELECT count(*)::int FROM pendencias_overbooking po
          WHERE po.operacao_id = ${operacao.id} AND po.deleted_at IS NULL
            AND po.status IN ('aberta','em_analise'))::text AS overbookings_abertos,
        (SELECT count(*)::int FROM recebimentos r
          WHERE r.operacao_id = ${operacao.id} AND r.deleted_at IS NULL
            AND r.status IN ('pesagem_em_andamento','aguardando_conclusao_pesagem',
                             'aguardando_conferencia_final'))::text AS recebimentos_aguardados,
        (SELECT count(*)::int FROM divergencias_recebimento d
           JOIN recebimentos rd2 ON rd2.id = d.recebimento_id
          WHERE rd2.operacao_id = ${operacao.id}
            AND d.status <> 'resolvida')::text AS divergencias_abertas,
        (SELECT count(*)::int FROM pecas p
           JOIN recebimentos rp ON rp.id = p.recebimento_id
          WHERE rp.operacao_id = ${operacao.id} AND p.deleted_at IS NULL
            AND p.status_peca IN ('para_corte','em_transformacao'))::text AS pecas_em_desossa,
        (SELECT count(*)::int FROM relatorios_sif rs
          WHERE rs.operacao_id = ${operacao.id} AND rs.deleted_at IS NULL
            AND rs.status = 'pendente_dados')::text AS relatorios_sif_pendentes,
        (SELECT count(*)::int FROM notas_fiscais nf
           JOIN caminhoes cam ON cam.id = nf.caminhao_id
          WHERE cam.operacao_id = ${operacao.id} AND nf.deleted_at IS NULL
            AND nf.status_nfse IN ('pendente','erro_emissao'))::text AS faturamentos_pendentes
    `).then((r) => r.rows[0]);
    if (!linha) throw new Error('Falha ao apurar os KPIs da operação');

    const ordemKpis = [
      'compras_programadas', 'disponibilidade_total', 'reservas_em_elaboracao',
      'pedidos_finalizados', 'overbookings_abertos', 'recebimentos_aguardados',
      'divergencias_abertas', 'pecas_em_desossa', 'relatorios_sif_pendentes',
      'faturamentos_pendentes',
    ] as const;

    const kpis: KpiDashboard[] = ordemKpis.map((chave) => ({
      chave,
      valor: linha[chave] ?? '0',
      detalhe: DETALHES_KPI[chave] ?? '',
    }));

    const [pedidosEmAndamento, alertas, atividadesRecentes] = await Promise.all([
      this.listarPedidosEmAndamento(operacao.id, operacao.data),
      this.montarAlertas(operacao.id),
      this.listarAtividadesRecentes(operacao.data),
    ]);

    return {
      operacao: {
        id: operacao.id,
        data: operacao.data,
        rotulo: operacao.rotulo,
        status: operacao.status,
        extraordinaria: operacao.extraordinaria,
      },
      kpis,
      pedidosEmAndamento,
      alertas,
      atividadesRecentes,
    };
  }

  private async montarAlertas(operacaoId: string): Promise<AlertaOperacional[]> {
    const linha = await this.db.execute<{
      overbooking: number; overbooking_deficit: string; overbooking_em: string | null;
      divergencias: number; divergencia_lote: string | null; divergencia_em: string | null;
      tz_aguardando: number; tz_em: string | null;
      seguro_pendente: number; seguro_placa: string | null; seguro_em: string | null;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM pendencias_overbooking po
          WHERE po.operacao_id = ${operacaoId} AND po.deleted_at IS NULL
            AND po.status IN ('aberta','em_analise')) AS overbooking,
        (SELECT coalesce(sum(po.quantidade_deficit), 0)::text FROM pendencias_overbooking po
          WHERE po.operacao_id = ${operacaoId} AND po.deleted_at IS NULL
            AND po.status IN ('aberta','em_analise')) AS overbooking_deficit,
        (SELECT max(po.created_at)::text FROM pendencias_overbooking po
          WHERE po.operacao_id = ${operacaoId} AND po.deleted_at IS NULL
            AND po.status IN ('aberta','em_analise')) AS overbooking_em,
        (SELECT count(*)::int FROM divergencias_recebimento d
           JOIN recebimentos r ON r.id = d.recebimento_id
          WHERE r.operacao_id = ${operacaoId} AND d.status <> 'resolvida') AS divergencias,
        (SELECT coalesce(r.romaneio, r.nota_fiscal_fornecedor) FROM divergencias_recebimento d
           JOIN recebimentos r ON r.id = d.recebimento_id
          WHERE r.operacao_id = ${operacaoId} AND d.status <> 'resolvida'
          ORDER BY d.created_at DESC LIMIT 1) AS divergencia_lote,
        (SELECT max(d.created_at)::text FROM divergencias_recebimento d
           JOIN recebimentos r ON r.id = d.recebimento_id
          WHERE r.operacao_id = ${operacaoId} AND d.status <> 'resolvida') AS divergencia_em,
        (SELECT count(*)::int FROM pecas p
           JOIN recebimentos r ON r.id = p.recebimento_id
          WHERE r.operacao_id = ${operacaoId} AND p.deleted_at IS NULL
            AND p.status_peca = 'para_corte') AS tz_aguardando,
        (SELECT max(p.updated_at)::text FROM pecas p
           JOIN recebimentos r ON r.id = p.recebimento_id
          WHERE r.operacao_id = ${operacaoId} AND p.deleted_at IS NULL
            AND p.status_peca = 'para_corte') AS tz_em,
        (SELECT count(*)::int FROM caminhoes c
          WHERE c.operacao_id = ${operacaoId} AND c.deleted_at IS NULL
            AND c.status_caminhao = 'faturado') AS seguro_pendente,
        (SELECT c.placa FROM caminhoes c
          WHERE c.operacao_id = ${operacaoId} AND c.deleted_at IS NULL
            AND c.status_caminhao = 'faturado'
          ORDER BY c.updated_at DESC LIMIT 1) AS seguro_placa,
        (SELECT max(c.updated_at)::text FROM caminhoes c
          WHERE c.operacao_id = ${operacaoId} AND c.deleted_at IS NULL
            AND c.status_caminhao = 'faturado') AS seguro_em
    `).then((r) => r.rows[0]);
    if (!linha) throw new Error('Falha ao apurar os alertas da operação');

    const alertas: AlertaOperacional[] = [];

    if (linha.overbooking > 0 && linha.overbooking_em) {
      alertas.push({
        chave: 'overbooking_aberto',
        titulo: 'Overbooking em aberto',
        descricao: `${linha.overbooking} pendência(s) com déficit de `
          + `${formatarQtd(linha.overbooking_deficit)} aguardando decisão.`,
        severidade: 'critico',
        ocorridoEm: linha.overbooking_em,
      });
    }

    if (linha.divergencias > 0 && linha.divergencia_em) {
      const lote = linha.divergencia_lote ? `Lote ${linha.divergencia_lote} — ` : '';
      alertas.push({
        chave: 'divergencia_recebimento',
        titulo: 'Divergência de recebimento',
        descricao: `${lote}${linha.divergencias} divergência(s) encaminhada(s) ao administrativo.`,
        severidade: 'atencao',
        ocorridoEm: linha.divergencia_em,
      });
    }

    if (linha.tz_aguardando > 0 && linha.tz_em) {
      alertas.push({
        chave: 'tz_aguardando_desossa',
        titulo: 'TZ aguardando desossa',
        descricao: `${linha.tz_aguardando} peça(s) disponível(is) aguardando encaminhamento à desossa.`,
        severidade: 'informativo',
        ocorridoEm: linha.tz_em,
      });
    }

    if (linha.seguro_pendente > 0 && linha.seguro_placa && linha.seguro_em) {
      alertas.push({
        chave: 'seguro_pendente',
        titulo: 'Seguro pendente',
        descricao: `Caminhão ${linha.seguro_placa} faturado aguardando averbação manual de seguro `
          + 'para liberação de saída.',
        severidade: 'informativo',
        ocorridoEm: linha.seguro_em,
      });
    }

    return alertas;
  }

  private async listarPedidosEmAndamento(operacaoId: string, dataOperacao: string): Promise<PedidoEmAndamento[]> {
    const pedidos = await this.db
      .select({
        pedidoId: pedidosVenda.id,
        status: pedidosVenda.status,
        clienteNome: clientes.nomeFantasia,
        clienteRazao: clientes.razaoSocial,
      })
      .from(pedidosVenda)
      .innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .where(
        and(
          eq(pedidosVenda.operacaoId, operacaoId),
          isNull(pedidosVenda.deletedAt),
          ne(pedidosVenda.status, 'cancelado'),
        ),
      )
      .orderBy(desc(pedidosVenda.createdAt))
      .limit(20);

    const resultado: PedidoEmAndamento[] = [];
    for (const p of pedidos) {
      const itens = await this.db
        .select({
          codigo: itensComerciais.codigo,
          quantidade: pedidosVendaItens.quantidadePedida,
        })
        .from(pedidosVendaItens)
        .innerJoin(itensComerciais, eq(itensComerciais.id, pedidosVendaItens.itemComercialId))
        .where(and(
          eq(pedidosVendaItens.pedidoVendaId, p.pedidoId),
          isNull(pedidosVendaItens.deletedAt),
        ));

      const produtoResumo =
        itens.length === 0
          ? '—'
          : itens.length === 1
            ? `${itens[0]!.codigo} (${itens[0]!.quantidade})`
            : `${itens[0]!.codigo} +${itens.length - 1}`;

      const pesoRow = await this.db
        .select({ total: sql<string>`coalesce(sum(${pecas.pesoOriginal}), 0)::text` })
        .from(pecas)
        .where(and(eq(pecas.pedidoVendaId, p.pedidoId), isNull(pecas.deletedAt)));

      resultado.push({
        pedidoId: p.pedidoId,
        clienteNome: p.clienteNome ?? p.clienteRazao ?? '—',
        produtoResumo,
        pesoTotalKg: pesoRow[0]?.total && Number(pesoRow[0].total) > 0 ? pesoRow[0].total : null,
        status: p.status,
        dataOperacao,
      });
    }
    return resultado;
  }

  private async listarAtividadesRecentes(dataOperacao: string): Promise<AtividadeRecente[]> {
    const inicio = new Date(`${dataOperacao}T00:00:00.000Z`);
    const fim = new Date(inicio);
    fim.setUTCDate(fim.getUTCDate() + 1);

    const linhas = await this.db
      .select({
        id: auditoria.id,
        tabela: auditoria.tabela,
        operacao: auditoria.operacao,
        modulo: auditoria.modulo,
        usuarioNome: usuarios.nome,
        createdAt: auditoria.createdAt,
      })
      .from(auditoria)
      .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(
        and(
          gte(auditoria.createdAt, inicio),
          lt(auditoria.createdAt, fim),
          sql`${auditoria.modulo} IN ('operacao', 'comercial', 'pesagem', 'gestao')`,
        ),
      )
      .orderBy(desc(auditoria.createdAt))
      .limit(15);

    return linhas.map((l) => ({
      id: l.id,
      usuarioNome: l.usuarioNome ?? 'Sistema',
      descricao: this.humanizarAuditoria(l.tabela, l.operacao, l.modulo),
      createdAt: l.createdAt.toISOString(),
    }));
  }

  private humanizarAuditoria(tabela: string, operacao: string, modulo: string | null): string {
    const acao =
      operacao === 'INSERT' ? 'criou' : operacao === 'UPDATE' ? 'alterou' : operacao === 'DELETE' ? 'removeu' : operacao.toLowerCase();
    return `${acao} registro em ${tabela}${modulo ? ` (${modulo})` : ''}`;
  }
}
