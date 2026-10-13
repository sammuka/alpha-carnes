import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { montarPaginado } from '../../../../common/crud/paginacao';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { empresas, estabelecimentos } from '../../../../database/schema';
import { EVENTOS } from '../../../../realtime/events/eventos';
import type { CreateEmpresaDto, ListarEmpresasQuery, UpdateEmpresaDto } from './dto/empresa.dto';
import type { RemoverDto } from './dto/comum.dto';
import {
  conflito,
  ehViolacaoUnica,
  MODULO_AUDITORIA,
  type Tx,
} from './fiscal-comum';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class EmpresasService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async listar(query: ListarEmpresasQuery) {
    const filtro = query.search?.trim();
    const where = and(
      isNull(empresas.deletedAt),
      filtro
        ? sql`(${empresas.razaoSocial} ILIKE ${'%' + filtro.replace(/[%_]/g, '') + '%'} OR ${empresas.cnpjRaiz} ILIKE ${'%' + filtro.replace(/[%_]/g, '') + '%'})`
        : undefined,
    );
    const totalLinha = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(empresas)
      .where(where);
    const total = totalLinha[0]?.total ?? 0;
    const data = await this.db
      .select({
        id: empresas.id,
        razaoSocial: empresas.razaoSocial,
        cnpjRaiz: empresas.cnpjRaiz,
        versao: empresas.versao,
      })
      .from(empresas)
      .where(where)
      .orderBy(empresas.razaoSocial)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return montarPaginado(data, total, query);
  }

  async criar(dto: CreateEmpresaDto, usuarioId: string) {
    try {
      const criada = await this.db.transaction(async (tx) => {
        const [linha] = await tx
          .insert(empresas)
          .values({
            razaoSocial: dto.razaoSocial,
            cnpjRaiz: dto.cnpjRaiz,
            criadoPorId: usuarioId,
            atualizadoPorId: usuarioId,
          })
          .returning();
        if (!linha) throw new Error('Falha ao gravar empresa');
        await this.auditoria.registrar(tx, {
          tabela: 'empresas',
          registroId: linha.id,
          operacao: 'INSERT',
          modulo: MODULO_AUDITORIA,
          usuarioId,
          dadosNovos: linha,
          justificativa: dto.justificativa,
        });
        return linha;
      });
      this.eventos.emit(EVENTOS.EMPRESA_FISCAL_ALTERADA, {
        empresaId: criada.id,
        acao: 'criado',
      });
      return this.publico(criada);
    } catch (err) {
      if (ehViolacaoUnica(err, 'uq_empresas_cnpj_raiz')) {
        conflito('CNPJ_RAIZ_DUPLICADO', 'Já existe empresa com esta raiz de CNPJ.');
      }
      throw err;
    }
  }

  async atualizar(id: string, dto: UpdateEmpresaDto, usuarioId: string) {
    const atualizada = await this.db.transaction(async (tx) => {
      const anterior = await this.obter(tx, id);
      if (anterior.versao !== dto.versao) {
        conflito('CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.');
      }
      const [linha] = await tx
        .update(empresas)
        .set({
          razaoSocial: dto.razaoSocial,
          versao: sql`${empresas.versao} + 1`,
          atualizadoPorId: usuarioId,
          updatedAt: new Date(),
        })
        .where(and(eq(empresas.id, id), eq(empresas.versao, dto.versao), isNull(empresas.deletedAt)))
        .returning();
      if (!linha) {
        conflito('CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.');
      }
      await this.auditoria.registrar(tx, {
        tabela: 'empresas',
        registroId: id,
        operacao: 'UPDATE',
        modulo: MODULO_AUDITORIA,
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: linha,
        justificativa: dto.justificativa,
      });
      return linha;
    });
    this.eventos.emit(EVENTOS.EMPRESA_FISCAL_ALTERADA, {
      empresaId: atualizada.id,
      acao: 'atualizado',
    });
    return this.publico(atualizada);
  }

  async remover(id: string, dto: RemoverDto, usuarioId: string) {
    const removida = await this.db.transaction(async (tx) => {
      const anterior = await this.obter(tx, id);
      const [vinculo] = await tx
        .select({ id: estabelecimentos.id })
        .from(estabelecimentos)
        .where(and(eq(estabelecimentos.empresaId, id), isNull(estabelecimentos.deletedAt)))
        .limit(1);
      if (vinculo) {
        conflito('EMPRESA_COM_ESTABELECIMENTOS', 'Remova os estabelecimentos antes de remover a empresa.');
      }
      const agora = new Date();
      const [linha] = await tx
        .update(empresas)
        .set({
          deletedAt: agora,
          versao: sql`${empresas.versao} + 1`,
          atualizadoPorId: usuarioId,
          updatedAt: agora,
        })
        .where(and(eq(empresas.id, id), isNull(empresas.deletedAt)))
        .returning();
      if (!linha) throw new Error('Falha ao remover empresa');
      await this.auditoria.registrar(tx, {
        tabela: 'empresas',
        registroId: id,
        operacao: 'DELETE',
        modulo: MODULO_AUDITORIA,
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: linha,
        justificativa: dto.justificativa,
      });
      return linha;
    });
    this.eventos.emit(EVENTOS.EMPRESA_FISCAL_ALTERADA, {
      empresaId: removida.id,
      acao: 'removido',
    });
    return { id: removida.id };
  }

  /** D15 (proposta): empresa não removida com ao menos um estabelecimento aprovado. */
  async empresaAtiva(db: Db | Tx, empresaId: string): Promise<boolean> {
    const [linha] = await db
      .select({ id: empresas.id })
      .from(empresas)
      .innerJoin(estabelecimentos, eq(estabelecimentos.empresaId, empresas.id))
      .where(and(
        eq(empresas.id, empresaId),
        isNull(empresas.deletedAt),
        isNull(estabelecimentos.deletedAt),
        eq(estabelecimentos.situacao, 'APPROVED'),
      ))
      .limit(1);
    return Boolean(linha);
  }

  async listarEmpresasAtivasIds(db: Db | Tx): Promise<string[]> {
    const linhas = await db
      .selectDistinct({ id: empresas.id })
      .from(empresas)
      .innerJoin(estabelecimentos, eq(estabelecimentos.empresaId, empresas.id))
      .where(and(
        isNull(empresas.deletedAt),
        isNull(estabelecimentos.deletedAt),
        eq(estabelecimentos.situacao, 'APPROVED'),
      ));
    return linhas.map((linha) => linha.id);
  }

  private async obter(tx: Tx, id: string) {
    const [linha] = await tx
      .select()
      .from(empresas)
      .where(and(eq(empresas.id, id), isNull(empresas.deletedAt)));
    if (!linha) throw new NotFoundException('Empresa não encontrada');
    return linha;
  }

  private publico(linha: typeof empresas.$inferSelect) {
    return {
      id: linha.id,
      razaoSocial: linha.razaoSocial,
      cnpjRaiz: linha.cnpjRaiz,
      versao: linha.versao,
    };
  }
}
