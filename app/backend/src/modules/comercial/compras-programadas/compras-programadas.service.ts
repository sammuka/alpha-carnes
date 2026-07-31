import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, getTableColumns, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  auditoria,
  comprasProgramadas,
  comprasProgramadasItens,
  operacoes,
  usuarios,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  calcularRange,
  montarPaginado,
  primeiroOuFalha,
  type ListarQuery,
  type Paginado,
} from '../../../common/crud/paginacao';
import {
  compararQtd,
  somarListaQtd,
} from '../../../common/crud/decimal';
import { EVENTOS } from '../../../realtime/events/eventos';
import { OperacoesService } from '../../operacoes/operacoes.service';
import {
  DisponibilidadeService,
  type DisponibilidadeGerada,
  type ItemImpacto,
} from '../disponibilidade/disponibilidade.service';
import type {
  AtualizarItemCompraDto,
  CreateCompraProgramadaDto,
  UpdateCompraProgramadaDto,
} from './dto/compra-programada.dto';

type Tx = NodePgDatabase<typeof schema>;
type CompraProgramadaDb = typeof comprasProgramadas.$inferSelect;
type CompraProgramadaItem = typeof comprasProgramadasItens.$inferSelect;
type CompraProgramada = CompraProgramadaDb & { dataOperacao: string };
type CompraComItens = CompraProgramada & { itens: CompraProgramadaItem[] };
type ConfirmacaoCompraProgramada = { compra: CompraComItens; jaConfirmada: boolean };

const COMPRA_COM_DATA = {
  ...getTableColumns(comprasProgramadas),
  dataOperacao: operacoes.data,
};

export interface ImpactoCompra {
  compraId: string;
  operacaoId: string;
  status: string;
  itens: ItemImpacto[];
  deficitTotal: string;
  exigeConfirmacao: boolean;
  resumo: string;
}

const STATUS_EDITAVEL = ['rascunho', 'em_negociacao'];

@Injectable()
export class ComprasProgramadasService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly disponibilidadeService: DisponibilidadeService,
    private readonly operacoes: OperacoesService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<CompraProgramada & { dataOperacao: string }>> {
    const { limit, offset } = calcularRange(query);
    const where = query.incluirRemovidos ? undefined : isNull(comprasProgramadas.deletedAt);

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select(COMPRA_COM_DATA)
        .from(comprasProgramadas)
        .innerJoin(operacoes, eq(comprasProgramadas.operacaoId, operacoes.id))
        .where(where)
        .orderBy(desc(comprasProgramadas.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(comprasProgramadas).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<CompraComItens> {
    const compra = await this.db
      .select(COMPRA_COM_DATA)
      .from(comprasProgramadas)
      .innerJoin(operacoes, eq(comprasProgramadas.operacaoId, operacoes.id))
      .where(and(eq(comprasProgramadas.id, id), isNull(comprasProgramadas.deletedAt)))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!compra) throw new NotFoundException('Compra programada não encontrada');
    const itens = await this.db
      .select()
      .from(comprasProgramadasItens)
      .where(and(eq(comprasProgramadasItens.compraProgramadaId, id), isNull(comprasProgramadasItens.deletedAt)));
    return { ...compra, itens };
  }

  async criar(dto: CreateCompraProgramadaDto, usuarioId: string): Promise<CompraComItens> {
    const compraId = await this.db.transaction(async (tx) => {
      const { operacao } = await this.operacoes.garantirOperacao(tx, dto.dataOperacao, usuarioId);

      const compraExistenteNoDia = await tx
        .select({ id: comprasProgramadas.id })
        .from(comprasProgramadas)
        .where(
          and(
            eq(comprasProgramadas.operacaoId, operacao.id),
            isNull(comprasProgramadas.deletedAt),
            ne(comprasProgramadas.status, 'cancelada'),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      if (compraExistenteNoDia) {
        throw new ConflictException('Já existe compra programada ativa para esta data');
      }

      const criada = primeiroOuFalha(
        await tx
          .insert(comprasProgramadas)
          .values({
            operacaoId: operacao.id,
            fornecedorId: dto.fornecedorId,
            numeroInterno: dto.numeroInterno,
            referenciaExterna: dto.referenciaExterna,
            previsaoEntrega: dto.previsaoEntrega ? new Date(dto.previsaoEntrega) : undefined,
            observacoes: dto.observacoes,
            status: 'rascunho',
            usuarioCriacaoId: usuarioId,
          })
          .returning(),
      );

      const itens = await tx
        .insert(comprasProgramadasItens)
        .values(
          dto.itens.map((item) => ({
            compraProgramadaId: criada.id,
            itemCompraId: item.itemCompraId,
            quantidadeComprada: String(item.quantidadeComprada),
            observacoes: item.observacoes,
          })),
        )
        .returning();

      await this.auditoria.registrar(tx, {
        tabela: 'compras_programadas',
        registroId: criada.id,
        operacao: 'INSERT',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: { ...criada, itens },
      });

      return criada.id;
    });
    return this.detalhar(compraId);
  }

  async atualizar(id: string, dto: UpdateCompraProgramadaDto, usuarioId: string): Promise<CompraComItens> {
    const compraId = await this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtiva(id, tx);
      if (!anterior) throw new NotFoundException('Compra programada não encontrada');
      this.assertEditavel(anterior.status);

      const atualizada = primeiroOuFalha(
        await tx
          .update(comprasProgramadas)
          .set({
            fornecedorId: dto.fornecedorId ?? anterior.fornecedorId,
            numeroInterno: dto.numeroInterno ?? anterior.numeroInterno,
            referenciaExterna: dto.referenciaExterna ?? anterior.referenciaExterna,
            previsaoEntrega: dto.previsaoEntrega ? new Date(dto.previsaoEntrega) : anterior.previsaoEntrega,
            observacoes: dto.observacoes ?? anterior.observacoes,
            status: dto.status ?? anterior.status,
          })
          .where(eq(comprasProgramadas.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'compras_programadas',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: atualizada,
      });
      return atualizada.id;
    });
    return this.detalhar(compraId);
  }

  async atualizarItem(
    compraId: string,
    itemId: string,
    dto: AtualizarItemCompraDto,
    usuarioId: string,
  ): Promise<{ item: CompraProgramadaItem; impacto: ImpactoCompra }> {
    const resultado = await this.db.transaction(async (tx) => {
      const compra = await this.buscarAtivaSobLock(tx, compraId);
      if (compra.status === 'cancelada') {
        throw new ConflictException('Compra cancelada não pode ser alterada');
      }

      const [item] = await tx.select().from(comprasProgramadasItens)
        .where(and(
          eq(comprasProgramadasItens.id, itemId),
          eq(comprasProgramadasItens.compraProgramadaId, compraId),
          isNull(comprasProgramadasItens.deletedAt),
        ))
        .for('update');
      if (!item) throw new NotFoundException('Item da compra não encontrado');

      const confirmada = compra.status === 'confirmada';
      if (confirmada) {
        const projetado = await this.disponibilidadeService.projetarImpacto(
          tx, compraId, new Map([[item.itemCompraId, dto.quantidadeComprada]]),
        );
        const impacto = this.montarImpacto(compra, projetado);
        if (impacto.exigeConfirmacao && !dto.confirmarDeficit) {
          throw new ConflictException({
            codigo: 'IMPACTO_CONFIRMACAO_NECESSARIA',
            mensagem: 'A alteração projeta déficit; confirme para prosseguir.',
            impacto,
          });
        }
      }

      const [atualizado] = await tx.update(comprasProgramadasItens)
        .set({
          quantidadeComprada: dto.quantidadeComprada,
          observacoes: dto.observacoes ?? item.observacoes,
          updatedAt: new Date(),
        })
        .where(eq(comprasProgramadasItens.id, itemId))
        .returning();
      if (!atualizado) throw new Error('Falha ao atualizar item da compra');

      await this.auditoria.registrar(tx, {
        tabela: 'compras_programadas_itens',
        registroId: itemId,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: item,
        dadosNovos: atualizado,
      });

      if (confirmada) await this.disponibilidadeService.recalcularParaCompra(tx, compra, usuarioId);

      const itens = await this.disponibilidadeService.projetarImpacto(tx, compraId, new Map());
      return { compra, item: atualizado, impacto: this.montarImpacto(compra, itens) };
    });

    if (resultado.compra.status === 'confirmada') {
      const [linhaOperacao] = await this.db
        .select({ data: operacoes.data })
        .from(operacoes)
        .where(eq(operacoes.id, resultado.compra.operacaoId));
      if (!linhaOperacao) throw new NotFoundException('Operação da compra não encontrada');
      const dataOperacao = linhaOperacao.data;
      this.eventEmitter.emit(EVENTOS.COMPRA_ALTERADA_IMPACTO, {
        compraId: resultado.compra.id,
        operacaoId: resultado.compra.operacaoId,
        dataOperacao,
        deficitTotal: resultado.impacto.deficitTotal,
        itens: resultado.impacto.itens.map((i) => ({
          itemComercialId: i.itemComercialId,
          delta: i.delta,
          deficitProjetado: i.deficitProjetado,
        })),
      });
    }
    return { item: resultado.item, impacto: resultado.impacto };
  }

  /** Fotografia (ou simulação) do impacto na disponibilidade — não persiste nada. */
  async impacto(compraId: string, simulacao: Map<string, string>): Promise<ImpactoCompra> {
    const compra = await this.buscarAtiva(compraId);
    if (!compra) throw new NotFoundException('Compra programada não encontrada');
    const itens = await this.disponibilidadeService.projetarImpacto(this.db, compraId, simulacao);
    return this.montarImpacto(compra, itens);
  }

  private montarImpacto(compra: CompraProgramadaDb, itens: ItemImpacto[]): ImpactoCompra {
    const deficitTotal = somarListaQtd(itens.map((i) => i.deficitProjetado));
    const trechos = itens
      .filter((i) => compararQtd(i.delta, '0.000') !== 0)
      .map((i) => {
        const sinal = compararQtd(i.delta, '0.000') > 0 ? '+' : '-';
        const deficit = compararQtd(i.deficitProjetado, '0.000') > 0
          ? `; déficit projetado: ${i.deficitProjetado} ${i.codigo}`
          : '';
        return `${sinal}${i.delta.replace('-', '')} ${i.codigo} virtuais${deficit}`;
      });
    return {
      compraId: compra.id,
      operacaoId: compra.operacaoId,
      status: compra.status,
      itens,
      deficitTotal,
      exigeConfirmacao: compararQtd(deficitTotal, '0.000') > 0,
      resumo: trechos.length ? `${trechos.join('; ')}.` : 'Nenhuma alteração de quantidade.',
    };
  }

  /** Histórico derivado da auditoria (D5.9) — sem tabela paralela. */
  async historico(compraId: string): Promise<Array<{
    id: string; dataHora: string; usuarioNome: string | null; tabela: string;
    operacao: string; dadosAnteriores: unknown; dadosNovos: unknown;
  }>> {
    const compra = await this.buscarAtiva(compraId);
    if (!compra) throw new NotFoundException('Compra programada não encontrada');
    const itens = await this.db.select({ id: comprasProgramadasItens.id })
      .from(comprasProgramadasItens)
      .where(eq(comprasProgramadasItens.compraProgramadaId, compraId));
    const ids = [compraId, ...itens.map((i) => i.id)];

    const linhas = await this.db.select({
      id: auditoria.id,
      tabela: auditoria.tabela,
      operacao: auditoria.operacao,
      dadosAnteriores: auditoria.dadosAnteriores,
      dadosNovos: auditoria.dadosNovos,
      createdAt: auditoria.createdAt,
      usuarioNome: usuarios.nome,
    })
      .from(auditoria)
      .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(and(
        inArray(auditoria.tabela, ['compras_programadas', 'compras_programadas_itens']),
        inArray(auditoria.registroId, ids),
      ))
      .orderBy(desc(auditoria.createdAt))
      .limit(50);

    return linhas.map((l) => ({
      id: l.id,
      dataHora: l.createdAt.toISOString(),
      usuarioNome: l.usuarioNome,
      tabela: l.tabela,
      operacao: l.operacao,
      dadosAnteriores: l.dadosAnteriores,
      dadosNovos: l.dadosNovos,
    }));
  }

  /**
   * Confirma a compra (gera a disponibilidade virtual do dia) numa única
   * transação. Idempotente: o UPDATE condicional por status (S5) garante que
   * chamadas concorrentes/repetidas não regeram saldo nem auditam duplicado.
   * Eventos publicados SOMENTE após o commit (ADR-004).
   */
  async confirmar(id: string, usuarioId: string): Promise<ConfirmacaoCompraProgramada> {
    const resultado = await this.db.transaction(async (tx) => {
      const atual = await this.buscarAtiva(id, tx);
      if (!atual) throw new NotFoundException('Compra programada não encontrada');
      if (atual.status === 'cancelada') {
        throw new ConflictException('Compra cancelada não pode ser confirmada');
      }

      // S5: UPDATE condicional por status — só confirma se ainda não confirmada.
      const confirmada = await tx
        .update(comprasProgramadas)
        .set({ status: 'confirmada', dataConfirmacao: sql`now()`, usuarioConfirmacaoId: usuarioId })
        .where(and(eq(comprasProgramadas.id, id), ne(comprasProgramadas.status, 'confirmada')))
        .returning()
        .then((r) => r[0] ?? null);

      if (!confirmada) {
        // Já confirmada (por esta ou outra chamada concorrente) → no-op idempotente.
        return { jaConfirmada: true, disponibilidades: [] as DisponibilidadeGerada[] };
      }

      const disponibilidades = await this.disponibilidadeService.gerarParaCompra(tx, confirmada);

      await this.auditoria.registrar(tx, {
        tabela: 'compras_programadas',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: atual,
        dadosNovos: confirmada,
      });

      return { jaConfirmada: false, disponibilidades };
    });

    const compra = await this.detalhar(id);

    // PÓS-COMMIT: eventos de tempo real (não emite em no-op idempotente).
    if (!resultado.jaConfirmada) {
      this.eventEmitter.emit(EVENTOS.COMPRA_CONFIRMADA, {
        compraId: compra.id,
        dataOperacao: compra.dataOperacao,
      });
      this.eventEmitter.emit(EVENTOS.DISPONIBILIDADE_GERADA, {
        compraId: compra.id,
        dataOperacao: compra.dataOperacao,
        itens: resultado.disponibilidades.map((d) => ({
          disponibilidadeId: d.id,
          itemComercialId: d.itemComercialId,
          quantidadeTotalGerada: d.quantidadeTotalGerada,
        })),
      });
    }

    return { compra, jaConfirmada: resultado.jaConfirmada };
  }

  async cancelar(id: string, usuarioId: string): Promise<CompraComItens> {
    const compraId = await this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtiva(id, tx);
      if (!anterior) throw new NotFoundException('Compra programada não encontrada');
      if (anterior.status === 'confirmada') {
        throw new ConflictException('Compra confirmada não pode ser cancelada');
      }

      const cancelada = primeiroOuFalha(
        await tx
          .update(comprasProgramadas)
          .set({ status: 'cancelada' })
          .where(eq(comprasProgramadas.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'compras_programadas',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: cancelada,
      });
      return cancelada.id;
    });
    return this.detalhar(compraId);
  }

  private assertEditavel(status: string): void {
    if (!STATUS_EDITAVEL.includes(status)) {
      throw new ConflictException('Compra confirmada ou cancelada é imutável');
    }
  }

  private async buscarAtiva(id: string, tx?: Tx): Promise<CompraProgramadaDb | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(comprasProgramadas)
      .where(and(eq(comprasProgramadas.id, id), isNull(comprasProgramadas.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async buscarAtivaSobLock(tx: Tx, id: string): Promise<CompraProgramadaDb> {
    const [compra] = await tx
      .select()
      .from(comprasProgramadas)
      .where(and(eq(comprasProgramadas.id, id), isNull(comprasProgramadas.deletedAt)))
      .for('update');
    if (!compra) throw new NotFoundException('Compra programada não encontrada');
    return compra;
  }
}
