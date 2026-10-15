import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { montarPaginado } from '../../../../common/crud/paginacao';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { beneficiosFiscais } from '../../../../database/schema';
import { EVENTOS } from '../../../../realtime/events/eventos';
import { conflito, ehViolacaoUnica } from '../empresas/fiscal-comum';
import type { BeneficioFiscalDto } from './dto/beneficio-fiscal.dto';
import type { ListarCatalogoQuery } from './dto/comum.dto';

type Db = NodePgDatabase<typeof schema>;

const MODULO = 'fiscal.regras';

@Injectable()
export class BeneficiosFiscaisService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async listar(query: ListarCatalogoQuery) {
    const filtro = query.search?.trim();
    const termo = filtro ? `%${filtro.replace(/[%_]/g, '')}%` : undefined;
    const where = and(
      isNull(beneficiosFiscais.deletedAt),
      termo
        ? sql`(${beneficiosFiscais.codigo} ILIKE ${termo} OR ${beneficiosFiscais.descricao} ILIKE ${termo})`
        : undefined,
    );
    const totalLinha = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(beneficiosFiscais)
      .where(where);
    const data = await this.db
      .select({
        id: beneficiosFiscais.id,
        codigo: beneficiosFiscais.codigo,
        descricao: beneficiosFiscais.descricao,
      })
      .from(beneficiosFiscais)
      .where(where)
      .orderBy(beneficiosFiscais.codigo)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return montarPaginado(data, totalLinha[0]?.total ?? 0, query);
  }

  async criar(dto: BeneficioFiscalDto, usuarioId: string) {
    try {
      const linha = await this.db.transaction(async (tx) => {
        const [gravada] = await tx.insert(beneficiosFiscais).values({
          codigo: dto.codigo,
          descricao: dto.descricao,
          criadoPorId: usuarioId,
          atualizadoPorId: usuarioId,
        }).returning();
        if (!gravada) throw new Error('Falha ao gravar benefício fiscal');
        await this.auditoria.registrar(tx, {
          tabela: 'beneficios_fiscais',
          registroId: gravada.id,
          operacao: 'INSERT',
          modulo: MODULO,
          usuarioId,
          dadosNovos: gravada,
          justificativa: dto.justificativa,
        });
        return gravada;
      });
      this.eventos.emit(EVENTOS.REGRA_TRIBUTARIA_ALTERADA, {
        regraId: linha.id,
        enquadramentoId: linha.id,
        codigo: linha.codigo,
        numeroVersao: linha.versao,
        acao: 'beneficio_criado',
        situacao: 'ATIVA',
      });
      return { id: linha.id, codigo: linha.codigo, descricao: linha.descricao, versao: linha.versao };
    } catch (err) {
      if (ehViolacaoUnica(err, 'uq_beneficios_codigo')) {
        conflito('CODIGO_JA_CADASTRADO', 'Código já cadastrado.');
      }
      throw err;
    }
  }
}
