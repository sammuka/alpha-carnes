import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { montarPaginado, primeiroOuFalha, type ListarQuery } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  ajustesEstoque,
  aprovacoesOperacionais,
  entradasItens,
  produtos,
  operacoes,
  parametros,
  pecas,
  subitens,
} from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import { AprovacoesService } from '../../gestao/aprovacoes/aprovacoes.service';
import type { CriarAjusteDto, RejeitarAjusteDto } from './dto/estoque.dto';

type Tx = NodePgDatabase<typeof schema>;
type Ajuste = typeof ajustesEstoque.$inferSelect;

@Injectable()
export class AjustesEstoqueService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly aprovacoes: AprovacoesService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async criar(dto: CriarAjusteDto, userId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const { quantidadeAnterior, produtoCodigo } = await this.capturarAlvo(tx, dto.tipo, dto.id);
      const limiar = await this.lerLimiar(tx);

      const acimaDoLimiar = Math.abs(dto.quantidadeDelta) > limiar;
      let status: 'aplicado' | 'aguardando_aprovacao' = 'aplicado';
      let aprovacaoOperacionalId: string | null = null;

      if (acimaDoLimiar) {
        status = 'aguardando_aprovacao';
        const operacaoId = await this.operacaoAtualId(tx);
        const aprovacao = await this.aprovacoes.abrirNaTx(
          tx,
          {
            operacaoId,
            tipo: 'ajuste_estoque_relevante',
            origem: `Ajuste de estoque ${produtoCodigo}`,
            descricao: dto.descricao ?? `Ajuste de ${dto.quantidadeDelta} em ${produtoCodigo} (${dto.motivo})`,
            impacto: `Delta ${dto.quantidadeDelta} sobre quantidade anterior ${quantidadeAnterior}`,
            referenciaTabela: 'ajustes_estoque',
          },
          userId,
        );
        aprovacaoOperacionalId = aprovacao.id;
      }

      const ajuste = primeiroOuFalha(
        await tx
          .insert(ajustesEstoque)
          .values({
            tipoAlvo: dto.tipo,
            pecaId: dto.tipo === 'peca' ? dto.id : null,
            subitemId: dto.tipo === 'subitem' ? dto.id : null,
            entradaId: dto.tipo === 'entrada' ? dto.id : null,
            produtoCodigo,
            quantidadeDelta: dto.quantidadeDelta,
            quantidadeAnterior,
            motivo: dto.motivo,
            descricao: dto.descricao ?? null,
            status,
            criadoPor: userId,
            aprovacaoOperacionalId,
          })
          .returning(),
      );

      if (status === 'aplicado') {
        await this.aplicarNaTx(tx, ajuste);
      }

      await this.auditoria.registrar(tx, {
        tabela: 'ajustes_estoque', registroId: ajuste.id, operacao: 'INSERT', modulo: 'operacao',
        usuarioId: userId, dadosAnteriores: {}, dadosNovos: ajuste,
      });

      return { ajuste, dataOperacao: await this.dataOperacaoAtual(tx) };
    });

    this.eventEmitter.emit(EVENTOS.AJUSTE_ESTOQUE_CRIADO, {
      ajusteId: resultado.ajuste.id,
      dataOperacao: resultado.dataOperacao,
    });

    return resultado.ajuste;
  }

  async listar(query: ListarQuery & { status?: string }) {
    const filtros = [isNull(ajustesEstoque.deletedAt)];
    if (query.status) filtros.push(eq(ajustesEstoque.status, query.status));
    const where = and(...filtros);

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select({
          id: ajustesEstoque.id,
          // Código do item físico (peça/subitem: etiqueta vigente; entrada: id) — distinto do produtoCodigo
          // (código do produto/item comercial), mesmo padrão de fallback de estoque-consulta.service.ts.
          itemCodigo: sql<string>`CASE
            WHEN ${ajustesEstoque.tipoAlvo} = 'peca' THEN COALESCE((SELECT etiqueta_atual FROM pecas WHERE id = ${ajustesEstoque.pecaId}), UPPER(LEFT(${ajustesEstoque.pecaId}::text, 8)))
            WHEN ${ajustesEstoque.tipoAlvo} = 'subitem' THEN COALESCE((SELECT etiqueta_atual FROM subitens WHERE id = ${ajustesEstoque.subitemId}), UPPER(LEFT(${ajustesEstoque.subitemId}::text, 8)))
            ELSE UPPER(LEFT(${ajustesEstoque.entradaId}::text, 8))
          END`,
          produtoCodigo: ajustesEstoque.produtoCodigo,
          quantidadeDelta: ajustesEstoque.quantidadeDelta,
          quantidadeAnterior: ajustesEstoque.quantidadeAnterior,
          motivo: ajustesEstoque.motivo,
          status: ajustesEstoque.status,
          criadoPor: ajustesEstoque.criadoPor,
          responsavelNome: sql<string>`(SELECT nome FROM usuarios WHERE id = ${ajustesEstoque.criadoPor})`,
          createdAt: ajustesEstoque.createdAt,
        })
        .from(ajustesEstoque)
        .where(where)
        .orderBy(desc(ajustesEstoque.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db.select({ total: sql<number>`count(*)::int` }).from(ajustesEstoque).where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0, { page: query.page, pageSize: query.pageSize });
  }

  async aprovar(id: string, userId: string) {
    return this.decidir(id, userId, 'aprovada', null);
  }

  async rejeitar(id: string, dto: RejeitarAjusteDto, userId: string) {
    return this.decidir(id, userId, 'rejeitada', dto.motivo);
  }

  private async decidir(id: string, userId: string, decisao: 'aprovada' | 'rejeitada', motivo: string | null) {
    const resultado = await this.db.transaction(async (tx) => {
      const ajuste = await tx
        .select()
        .from(ajustesEstoque)
        .where(and(eq(ajustesEstoque.id, id), isNull(ajustesEstoque.deletedAt)))
        .for('update')
        .then((r) => r[0] ?? null);
      if (!ajuste) throw new NotFoundException('Ajuste não encontrado');
      if (ajuste.status !== 'aguardando_aprovacao') {
        throw new ConflictException({ codigo: 'AJUSTE_NAO_PENDENTE', mensagem: 'Ajuste não está pendente de decisão' });
      }
      if (ajuste.criadoPor === userId) {
        throw new ForbiddenException({ codigo: 'SEGREGACAO_CRIADOR_APROVADOR', mensagem: 'Quem cria o ajuste não pode decidi-lo' });
      }

      if (decisao === 'aprovada') {
        await this.aplicarNaTx(tx, ajuste);
      }

      const novoStatus = decisao === 'aprovada' ? 'aplicado' : 'rejeitado';
      const decidido = primeiroOuFalha(
        await tx
          .update(ajustesEstoque)
          .set({
            status: novoStatus,
            decididoPor: userId,
            decididoEm: new Date(),
            decisaoMotivo: motivo,
            updatedAt: new Date(),
          })
          .where(eq(ajustesEstoque.id, id))
          .returning(),
      );

      if (ajuste.aprovacaoOperacionalId) {
        await tx
          .update(aprovacoesOperacionais)
          .set({
            status: decisao,
            decisaoMotivo: motivo ?? `Ajuste de estoque ${decisao}`,
            decididoPorId: userId,
            decididoEm: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(aprovacoesOperacionais.id, ajuste.aprovacaoOperacionalId));
      }

      await this.auditoria.registrar(tx, {
        tabela: 'ajustes_estoque', registroId: id, operacao: 'UPDATE', modulo: 'operacao',
        usuarioId: userId, dadosAnteriores: ajuste, dadosNovos: decidido,
      });

      return { ajuste: decidido, dataOperacao: await this.dataOperacaoAtual(tx) };
    });

    this.eventEmitter.emit(EVENTOS.AJUSTE_ESTOQUE_DECIDIDO, {
      ajusteId: resultado.ajuste.id,
      decisao: resultado.ajuste.status as 'aplicado' | 'rejeitado',
      dataOperacao: resultado.dataOperacao,
    });

    return resultado.ajuste;
  }

  // ── D8.10 — aplicação física ────────────────────────────────────────────

  private async aplicarNaTx(tx: Tx, ajuste: Ajuste): Promise<void> {
    if (ajuste.tipoAlvo === 'entrada') {
      const r = await tx.execute(sql`
        UPDATE entradas_itens SET quantidade = quantidade + ${ajuste.quantidadeDelta}, updated_at = now()
        WHERE id = ${ajuste.entradaId} AND deleted_at IS NULL
          AND quantidade + ${ajuste.quantidadeDelta} >= quantidade_destinada
          AND quantidade + ${ajuste.quantidadeDelta} >= 0
        RETURNING id`);
      if (r.rows.length === 0) {
        throw new ConflictException({ codigo: 'SALDO_INSUFICIENTE', mensagem: 'Ajuste deixaria o saldo abaixo do já destinado' });
      }
      return;
    }

    if (ajuste.quantidadeDelta !== -1) {
      throw new ConflictException({ codigo: 'AJUSTE_INVALIDO_PARA_PECA', mensagem: 'Peça/subitem é unitário; ajuste físico só -1 sobre item disponível' });
    }

    if (ajuste.tipoAlvo === 'peca') {
      const r = await tx
        .update(pecas)
        .set({ deletedAt: new Date() })
        .where(and(eq(pecas.id, ajuste.pecaId!), eq(pecas.statusPeca, 'em_sobra'), isNull(pecas.deletedAt)))
        .returning({ id: pecas.id });
      if (r.length === 0) {
        throw new ConflictException({ codigo: 'AJUSTE_INVALIDO_PARA_PECA', mensagem: 'Peça não está disponível para ajuste' });
      }
    } else {
      const r = await tx
        .update(subitens)
        .set({ deletedAt: new Date() })
        .where(and(eq(subitens.id, ajuste.subitemId!), eq(subitens.statusSubitem, 'em_sobra'), isNull(subitens.deletedAt)))
        .returning({ id: subitens.id });
      if (r.length === 0) {
        throw new ConflictException({ codigo: 'AJUSTE_INVALIDO_PARA_PECA', mensagem: 'Subitem não está disponível para ajuste' });
      }
    }
  }

  // ── internos ────────────────────────────────────────────────────────────

  private async capturarAlvo(tx: Tx, tipo: 'peca' | 'subitem' | 'entrada', id: string): Promise<{ quantidadeAnterior: number; produtoCodigo: string }> {
    if (tipo === 'peca') {
      const peca = await tx
        .select({ produtoId: pecas.produtoBaseId })
        .from(pecas)
        .where(and(eq(pecas.id, id), isNull(pecas.deletedAt)))
        .for('update')
        .then((r) => r[0] ?? null);
      if (!peca) throw new NotFoundException('Peça não encontrada');
      const codigo = await this.codigoDoproduto(tx, peca.produtoId);
      return { quantidadeAnterior: 1, produtoCodigo: codigo };
    }
    if (tipo === 'subitem') {
      const sub = await tx
        .select({ produtoId: subitens.produtoId })
        .from(subitens)
        .where(and(eq(subitens.id, id), isNull(subitens.deletedAt)))
        .for('update')
        .then((r) => r[0] ?? null);
      if (!sub) throw new NotFoundException('Subitem não encontrado');
      const codigo = await this.codigoDoproduto(tx, sub.produtoId);
      return { quantidadeAnterior: 1, produtoCodigo: codigo };
    }
    const entrada = await tx
      .select({ quantidade: entradasItens.quantidade, quantidadeDestinada: entradasItens.quantidadeDestinada, produtoId: entradasItens.produtoId })
      .from(entradasItens)
      .where(and(eq(entradasItens.id, id), isNull(entradasItens.deletedAt)))
      .for('update')
      .then((r) => r[0] ?? null);
    if (!entrada) throw new NotFoundException('Entrada não encontrada');
    const codigo = await tx
      .select({ codigo: sql<string>`(SELECT codigo FROM produtos WHERE id = ${entrada.produtoId})` })
      .from(entradasItens)
      .limit(1)
      .then((r) => r[0]?.codigo ?? '—');
    return { quantidadeAnterior: entrada.quantidade - entrada.quantidadeDestinada, produtoCodigo: codigo };
  }

  private async codigoDoproduto(tx: Tx, produtoId: string): Promise<string> {
    const r = await tx
      .select({ codigo: produtos.codigo })
      .from(produtos)
      .where(eq(produtos.id, produtoId))
      .then((rows) => rows[0] ?? null);
    return r?.codigo ?? '—';
  }

  private async lerLimiar(tx: Tx): Promise<number> {
    const linha = await tx
      .select({ valorJson: parametros.valorJson })
      .from(parametros)
      .where(eq(parametros.chave, 'estoque.limiar_aprovacao_ajuste'))
      .then((r) => r[0] ?? null);
    const valor = (linha?.valorJson as { valor?: unknown } | null)?.valor;
    return typeof valor === 'number' ? valor : 5;
  }

  private async operacaoAtualId(tx: Tx): Promise<string> {
    const op = await tx
      .select({ id: operacoes.id })
      .from(operacoes)
      .where(and(isNull(operacoes.deletedAt), inArray(operacoes.status, ['aberta', 'em_andamento'])))
      .orderBy(desc(operacoes.data))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (op) return op.id;
    const maisRecente = await tx
      .select({ id: operacoes.id })
      .from(operacoes)
      .where(isNull(operacoes.deletedAt))
      .orderBy(desc(operacoes.data))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!maisRecente) throw new NotFoundException('Nenhuma operação cadastrada para vincular o ajuste');
    return maisRecente.id;
  }

  private async dataOperacaoAtual(tx: Tx): Promise<string> {
    const r = await tx
      .select({ data: operacoes.data })
      .from(operacoes)
      .where(isNull(operacoes.deletedAt))
      .orderBy(desc(operacoes.data))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    return r?.data ?? '';
  }
}
