import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { comprasProgramadas, comprasProgramadasItens } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  calcularRange,
  montarPaginado,
  primeiroOuFalha,
  type ListarQuery,
  type Paginado,
} from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { DisponibilidadeService, type DisponibilidadeGerada } from '../disponibilidade/disponibilidade.service';
import type {
  CreateCompraProgramadaDto,
  UpdateCompraItemDto,
  UpdateCompraProgramadaDto,
} from './dto/compra-programada.dto';

type CompraProgramada = typeof comprasProgramadas.$inferSelect;
type CompraProgramadaItem = typeof comprasProgramadasItens.$inferSelect;
type CompraComItens = CompraProgramada & { itens: CompraProgramadaItem[] };

const STATUS_EDITAVEL = ['rascunho', 'em_negociacao'];

@Injectable()
export class ComprasProgramadasService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly disponibilidadeService: DisponibilidadeService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<CompraProgramada>> {
    const { limit, offset } = calcularRange(query);
    const where = query.incluirRemovidos ? undefined : isNull(comprasProgramadas.deletedAt);

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select()
        .from(comprasProgramadas)
        .where(where)
        .orderBy(desc(comprasProgramadas.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(comprasProgramadas).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<CompraComItens> {
    const compra = await this.buscarAtiva(id);
    if (!compra) throw new NotFoundException('Compra programada não encontrada');
    const itens = await this.db
      .select()
      .from(comprasProgramadasItens)
      .where(and(eq(comprasProgramadasItens.compraProgramadaId, id), isNull(comprasProgramadasItens.deletedAt)));
    return { ...compra, itens };
  }

  async criar(dto: CreateCompraProgramadaDto, usuarioId: string): Promise<CompraComItens> {
    return this.db.transaction(async (tx) => {
      const compraExistenteNoDia = await tx
        .select({ id: comprasProgramadas.id })
        .from(comprasProgramadas)
        .where(
          and(
            eq(comprasProgramadas.dataOperacao, dto.dataOperacao),
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
            dataOperacao: dto.dataOperacao,
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

      return { ...criada, itens };
    });
  }

  async atualizar(id: string, dto: UpdateCompraProgramadaDto, usuarioId: string): Promise<CompraProgramada> {
    return this.db.transaction(async (tx) => {
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
      return atualizada;
    });
  }

  async atualizarItem(
    compraId: string,
    itemId: string,
    dto: UpdateCompraItemDto,
    usuarioId: string,
  ): Promise<CompraProgramadaItem> {
    return this.db.transaction(async (tx) => {
      const compra = await this.buscarAtiva(compraId, tx);
      if (!compra) throw new NotFoundException('Compra programada não encontrada');
      // Imutabilidade: compra confirmada (ou cancelada) não permite editar item.
      this.assertEditavel(compra.status);

      const anterior = await tx
        .select()
        .from(comprasProgramadasItens)
        .where(
          and(
            eq(comprasProgramadasItens.id, itemId),
            eq(comprasProgramadasItens.compraProgramadaId, compraId),
            isNull(comprasProgramadasItens.deletedAt),
          ),
        )
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Item da compra não encontrado');

      const atualizado = primeiroOuFalha(
        await tx
          .update(comprasProgramadasItens)
          .set({
            quantidadeComprada:
              dto.quantidadeComprada !== undefined ? String(dto.quantidadeComprada) : anterior.quantidadeComprada,
            observacoes: dto.observacoes ?? anterior.observacoes,
          })
          .where(eq(comprasProgramadasItens.id, itemId))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'compras_programadas_itens',
        registroId: itemId,
        operacao: 'UPDATE',
        modulo: 'comercial',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  /**
   * Confirma a compra (gera a disponibilidade virtual do dia) numa única
   * transação. Idempotente: o UPDATE condicional por status (S5) garante que
   * chamadas concorrentes/repetidas não regeram saldo nem auditam duplicado.
   * Eventos publicados SOMENTE após o commit (ADR-004).
   */
  async confirmar(id: string, usuarioId: string): Promise<{ compra: CompraProgramada; jaConfirmada: boolean }> {
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
        return { compra: atual, jaConfirmada: true, disponibilidades: [] as DisponibilidadeGerada[] };
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

      return { compra: confirmada, jaConfirmada: false, disponibilidades };
    });

    // PÓS-COMMIT: eventos de tempo real (não emite em no-op idempotente).
    if (!resultado.jaConfirmada) {
      this.eventEmitter.emit(EVENTOS.COMPRA_CONFIRMADA, {
        compraId: resultado.compra.id,
        dataOperacao: resultado.compra.dataOperacao,
      });
      this.eventEmitter.emit(EVENTOS.DISPONIBILIDADE_GERADA, {
        compraId: resultado.compra.id,
        dataOperacao: resultado.compra.dataOperacao,
        itens: resultado.disponibilidades.map((d) => ({
          disponibilidadeId: d.id,
          itemComercialId: d.itemComercialId,
          quantidadeTotalGerada: d.quantidadeTotalGerada,
        })),
      });
    }

    return { compra: resultado.compra, jaConfirmada: resultado.jaConfirmada };
  }

  async cancelar(id: string, usuarioId: string): Promise<CompraProgramada> {
    return this.db.transaction(async (tx) => {
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
      return cancelada;
    });
  }

  private assertEditavel(status: string): void {
    if (!STATUS_EDITAVEL.includes(status)) {
      throw new ConflictException('Compra confirmada ou cancelada é imutável');
    }
  }

  private async buscarAtiva(id: string, tx?: NodePgDatabase<typeof schema>): Promise<CompraProgramada | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(comprasProgramadas)
      .where(and(eq(comprasProgramadas.id, id), isNull(comprasProgramadas.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
