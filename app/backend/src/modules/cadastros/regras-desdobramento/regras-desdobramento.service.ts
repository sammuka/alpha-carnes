import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { itensComerciais, itensCompra, regrasDesdobramentoComercial } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { calcularRange, montarPaginado, primeiroOuFalha, type ListarQuery, type Paginado } from '../../../common/crud/paginacao';
import type { CreateRegraDesdobramentoDto, UpdateRegraDesdobramentoDto } from './dto/regra-desdobramento.dto';

type Regra = typeof regrasDesdobramentoComercial.$inferSelect;

/** Estado efetivo de uma regra após aplicar um update parcial, usado nas validações. */
interface EstadoRegra {
  itemCompraId: string;
  itemComercialId: string;
  status: string;
  vigenciaInicio: Date;
  vigenciaFim: Date | null;
}

@Injectable()
export class RegrasDesdobramentoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<Regra>> {
    const { limit, offset } = calcularRange(query);
    const where = query.incluirRemovidos ? undefined : isNull(regrasDesdobramentoComercial.deletedAt);

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select()
        .from(regrasDesdobramentoComercial)
        .where(where)
        .orderBy(desc(regrasDesdobramentoComercial.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(regrasDesdobramentoComercial).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<Regra> {
    const regra = await this.buscarAtivo(id);
    if (!regra) throw new NotFoundException('Regra de desdobramento não encontrada');
    return regra;
  }

  async criar(dto: CreateRegraDesdobramentoDto, usuarioId: string): Promise<Regra> {
    return this.db.transaction(async (tx) => {
      const estado: EstadoRegra = {
        itemCompraId: dto.itemCompraId,
        itemComercialId: dto.itemComercialId,
        status: dto.status,
        vigenciaInicio: dto.vigenciaInicio,
        vigenciaFim: dto.vigenciaFim ?? null,
      };

      await this.assertItensAtivos(tx, estado.itemCompraId, estado.itemComercialId);
      if (estado.status === 'ativo') {
        await this.assertSemSobreposicaoAtiva(tx, estado, null);
      }

      const criada = primeiroOuFalha(
        await tx
          .insert(regrasDesdobramentoComercial)
          .values({
            itemCompraId: estado.itemCompraId,
            itemComercialId: estado.itemComercialId,
            fatorQuantidade: dto.fatorQuantidade.toString(),
            status: estado.status,
            vigenciaInicio: estado.vigenciaInicio,
            vigenciaFim: estado.vigenciaFim,
            observacoes: dto.observacoes,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'regras_desdobramento_comercial',
        registroId: criada.id,
        operacao: 'INSERT',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: criada,
      });
      return criada;
    });
  }

  async atualizar(id: string, dto: UpdateRegraDesdobramentoDto, usuarioId: string): Promise<Regra> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Regra de desdobramento não encontrada');

      const estado: EstadoRegra = {
        itemCompraId: dto.itemCompraId ?? anterior.itemCompraId,
        itemComercialId: dto.itemComercialId ?? anterior.itemComercialId,
        status: dto.status ?? anterior.status,
        vigenciaInicio: dto.vigenciaInicio ?? anterior.vigenciaInicio,
        vigenciaFim: dto.vigenciaFim === undefined ? anterior.vigenciaFim : dto.vigenciaFim,
      };

      await this.assertItensAtivos(tx, estado.itemCompraId, estado.itemComercialId);
      if (estado.status === 'ativo') {
        await this.assertSemSobreposicaoAtiva(tx, estado, id);
      }

      const atualizada = primeiroOuFalha(
        await tx
          .update(regrasDesdobramentoComercial)
          .set({
            itemCompraId: estado.itemCompraId,
            itemComercialId: estado.itemComercialId,
            fatorQuantidade:
              dto.fatorQuantidade !== undefined ? dto.fatorQuantidade.toString() : anterior.fatorQuantidade,
            status: estado.status,
            vigenciaInicio: estado.vigenciaInicio,
            vigenciaFim: estado.vigenciaFim,
            observacoes: dto.observacoes ?? anterior.observacoes,
          })
          .where(eq(regrasDesdobramentoComercial.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'regras_desdobramento_comercial',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: atualizada,
      });
      return atualizada;
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Regra de desdobramento não encontrada');

      const removida = primeiroOuFalha(
        await tx
          .update(regrasDesdobramentoComercial)
          .set({ deletedAt: new Date() })
          .where(eq(regrasDesdobramentoComercial.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'regras_desdobramento_comercial',
        registroId: id,
        operacao: 'DELETE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: removida,
      });
      return { id, deletedAt: removida.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<Regra> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(regrasDesdobramentoComercial)
        .where(eq(regrasDesdobramentoComercial.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Regra de desdobramento não encontrada');
      if (!anterior.deletedAt) throw new ConflictException('Regra de desdobramento não está removida');

      const estado: EstadoRegra = {
        itemCompraId: anterior.itemCompraId,
        itemComercialId: anterior.itemComercialId,
        status: anterior.status,
        vigenciaInicio: anterior.vigenciaInicio,
        vigenciaFim: anterior.vigenciaFim,
      };
      // Ao restaurar uma regra ativa, garante que não reativa uma sobreposição.
      if (estado.status === 'ativo') {
        await this.assertSemSobreposicaoAtiva(tx, estado, id);
      }

      const restaurada = primeiroOuFalha(
        await tx
          .update(regrasDesdobramentoComercial)
          .set({ deletedAt: null })
          .where(eq(regrasDesdobramentoComercial.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'regras_desdobramento_comercial',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: restaurada,
      });
      return restaurada;
    });
  }

  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Regra | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(regrasDesdobramentoComercial)
      .where(and(eq(regrasDesdobramentoComercial.id, id), isNull(regrasDesdobramentoComercial.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  /** Itens referenciados devem existir e estar ativos (deleted_at IS NULL, status='ativo'). */
  private async assertItensAtivos(
    tx: NodePgDatabase<typeof schema>,
    itemCompraId: string,
    itemComercialId: string,
  ): Promise<void> {
    const compra = await tx
      .select({ id: itensCompra.id })
      .from(itensCompra)
      .where(and(eq(itensCompra.id, itemCompraId), isNull(itensCompra.deletedAt), eq(itensCompra.status, 'ativo')))
      .then((r) => r[0] ?? null);
    if (!compra) throw new BadRequestException('Item de compra inexistente ou inativo');

    const comercial = await tx
      .select({ id: itensComerciais.id })
      .from(itensComerciais)
      .where(
        and(
          eq(itensComerciais.id, itemComercialId),
          isNull(itensComerciais.deletedAt),
          eq(itensComerciais.status, 'ativo'),
        ),
      )
      .then((r) => r[0] ?? null);
    if (!comercial) throw new BadRequestException('Item comercial inexistente ou inativo');
  }

  /**
   * Não permite duas regras ATIVAS para o mesmo par (itemCompraId, itemComercialId) com
   * vigências que se sobrepõem. Intervalos [inicio, fim) com fim NULL = aberto (+infinito).
   * Sobreposição: novo.inicio < existente.fim E existente.inicio < novo.fim (tratando NULL como aberto).
   */
  private async assertSemSobreposicaoAtiva(
    tx: NodePgDatabase<typeof schema>,
    estado: EstadoRegra,
    idAtual: string | null,
  ): Promise<void> {
    const inicio = estado.vigenciaInicio;
    const fim = estado.vigenciaFim;

    const condicoes = [
      isNull(regrasDesdobramentoComercial.deletedAt),
      eq(regrasDesdobramentoComercial.status, 'ativo'),
      eq(regrasDesdobramentoComercial.itemCompraId, estado.itemCompraId),
      eq(regrasDesdobramentoComercial.itemComercialId, estado.itemComercialId),
      // existente.inicio < novo.fim  (se novo.fim NULL → sempre verdadeiro)
      fim ? sql`${regrasDesdobramentoComercial.vigenciaInicio} < ${fim}` : undefined,
      // novo.inicio < existente.fim  (se existente.fim NULL → sempre verdadeiro)
      or(
        isNull(regrasDesdobramentoComercial.vigenciaFim),
        sql`${regrasDesdobramentoComercial.vigenciaFim} > ${inicio}`,
      ),
    ];
    if (idAtual) condicoes.push(ne(regrasDesdobramentoComercial.id, idAtual));

    const sobreposta = await tx
      .select({ id: regrasDesdobramentoComercial.id })
      .from(regrasDesdobramentoComercial)
      .where(and(...condicoes.filter(Boolean)))
      .then((r) => r[0] ?? null);

    if (sobreposta) {
      throw new ConflictException(
        'Já existe regra de desdobramento ativa para este par de itens com vigência sobreposta',
      );
    }
  }
}
