import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { DRIZZLE } from '../../../database/database.module';
import {
  centrosCusto,
  contaVersoes,
  contasContabeis,
  usuarios,
} from '../../../database/schema';
import * as schema from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import type { CriarCentroDto, CriarContaDto, ListarPlanoQuery } from './dto/plano.dto';
import { RegraContabilException } from './regra-contabil.exception';

type Banco = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0];

const NATUREZA_ROTULO: Record<string, string> = {
  ATIVO: 'Ativo',
  PASSIVO: 'Passivo',
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
  CUSTO: 'Custos',
};

const SITUACAO_ROTULO: Record<string, string> = {
  DRAFT: 'Rascunho',
  REVIEW: 'Aguardando revisão',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  SUSPENDED: 'Suspenso',
};

const CLASSIFICACAO_ROTULO: Record<string, string> = {
  sintetica: 'sintética',
  analitica: 'analítica',
};

const PAGINA = 20;

export interface ContaApresentada {
  codigo: string;
  nome: string;
  classificacao: string;
  classificacaoRotulo: string;
  natureza: string;
  naturezaRotulo: string;
  grupo: string;
  contaPaiCodigo: string | null;
  centroCodigo: string;
  centroNome: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  situacao: string;
  situacaoRotulo: string;
  numero: number;
  responsavelNome: string;
  criadoEm: string;
  alteradoEm: string;
}

@Injectable()
export class PlanoContasService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: Banco },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db(): Banco {
    return this.drizzle.db;
  }

  async criar(dto: CriarContaDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'contabilidade:conta:' + dto.codigo}))`);
      const duplicada = await tx.select({ id: contasContabeis.id }).from(contasContabeis)
        .where(and(eq(contasContabeis.codigo, dto.codigo), isNull(contasContabeis.deletedAt))).limit(1);
      if (duplicada.length > 0) throw new ConflictException('Já existe conta com este código');
      const centro = await this.centroAtivo(tx, dto.centroCodigo);
      const paiId = await this.paiValido(tx, dto.classificacao, dto.contaPaiCodigo);
      const [conta] = await tx.insert(contasContabeis).values({ codigo: dto.codigo }).returning();
      const [versao] = await tx.insert(contaVersoes).values({
        contaId: conta.id,
        numero: 1,
        nome: dto.nome,
        classificacao: dto.classificacao,
        natureza: dto.natureza,
        grupo: dto.grupo,
        contaPaiId: paiId,
        centroCustoId: centro.id,
        vigenciaInicio: dto.vigenciaInicio,
        vigenciaFim: dto.vigenciaFim,
        situacao: 'DRAFT',
        justificativa: dto.justificativa,
        responsavelId: usuarioId,
      }).returning();
      await this.auditoria.registrar(tx, {
        tabela: 'conta_versoes',
        registroId: versao.id,
        operacao: 'INSERT',
        modulo: 'contabilidade.plano',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: versao,
        justificativa: dto.justificativa,
      });
    });
    this.eventEmitter.emit(EVENTOS.PLANO_CONTA_CRIADA, { codigo: dto.codigo, acao: 'criar', situacao: 'DRAFT' });
    return this.obter(dto.codigo);
  }

  async criarCentro(dto: CriarCentroDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      const duplicado = await tx.select({ id: centrosCusto.id }).from(centrosCusto)
        .where(and(eq(centrosCusto.codigo, dto.codigo), isNull(centrosCusto.deletedAt))).limit(1);
      if (duplicado.length > 0) throw new ConflictException('Já existe centro de custo com este código');
      const [centro] = await tx.insert(centrosCusto).values({ codigo: dto.codigo, nome: dto.nome }).returning();
      await this.auditoria.registrar(tx, {
        tabela: 'centros_custo',
        registroId: centro.id,
        operacao: 'INSERT',
        modulo: 'contabilidade.plano',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: centro,
        justificativa: dto.justificativa,
      });
    });
    this.eventEmitter.emit(EVENTOS.CENTRO_CUSTO_CRIADO, { codigo: dto.codigo, acao: 'criar', situacao: 'APPROVED' });
  }

  async listar(query: ListarPlanoQuery): Promise<{ itens: ContaApresentada[]; total: number }> {
    const { linhas, total } = await this.consultar(query, true);
    return { itens: linhas.map((linha) => this.apresentar(linha)), total };
  }

  async obter(codigo: string): Promise<ContaApresentada> {
    const { linhas } = await this.consultar(
      { pagina: 1, q: '', situacao: '', ordenar: 'contaContabil', direcao: 'asc' },
      false,
      codigo,
    );
    const linha = linhas[0];
    if (!linha) throw new NotFoundException('Conta não encontrada');
    return this.apresentar(linha);
  }

  apresentar(linha: LinhaPlano): ContaApresentada {
    return {
      codigo: linha.codigo,
      nome: linha.nome,
      classificacao: linha.classificacao,
      classificacaoRotulo: CLASSIFICACAO_ROTULO[linha.classificacao] ?? linha.classificacao,
      natureza: linha.natureza,
      naturezaRotulo: NATUREZA_ROTULO[linha.natureza] ?? linha.natureza,
      grupo: linha.grupo,
      contaPaiCodigo: linha.contaPaiCodigo,
      centroCodigo: linha.centroCodigo,
      centroNome: linha.centroNome,
      vigenciaInicio: linha.vigenciaInicio,
      vigenciaFim: linha.vigenciaFim,
      situacao: linha.situacao,
      situacaoRotulo: SITUACAO_ROTULO[linha.situacao] ?? linha.situacao,
      numero: linha.numero,
      responsavelNome: linha.responsavelNome,
      criadoEm: instante(linha.criadoEm),
      alteradoEm: instante(linha.alteradoEm),
    };
  }

  private async centroAtivo(tx: Tx, codigo: string) {
    const [centro] = await tx.select().from(centrosCusto)
      .where(and(eq(centrosCusto.codigo, codigo), isNull(centrosCusto.deletedAt))).limit(1);
    if (!centro) throw new RegraContabilException('Centro de custo não encontrado');
    return centro;
  }

  private async paiValido(tx: Tx, classificacao: 'sintetica' | 'analitica', contaPaiCodigo: string | null) {
    if (!contaPaiCodigo) {
      if (classificacao === 'analitica') throw new RegraContabilException('Conta pai não encontrada');
      return null;
    }
    const [pai] = await tx.select().from(contasContabeis)
      .where(and(eq(contasContabeis.codigo, contaPaiCodigo), isNull(contasContabeis.deletedAt))).limit(1);
    if (!pai) throw new RegraContabilException('Conta pai não encontrada');
    const [vigente] = await tx.select().from(contaVersoes).where(and(
      eq(contaVersoes.contaId, pai.id),
      eq(contaVersoes.situacao, 'APPROVED'),
      isNull(contaVersoes.deletedAt),
    )).orderBy(desc(contaVersoes.numero)).limit(1);
    if (!vigente) throw new RegraContabilException('Conta pai não está ativa');
    if (vigente.classificacao === 'analitica') {
      throw new RegraContabilException('Conta pai analítica não é nível hierárquico válido');
    }
    return pai.id;
  }

  private async consultar(query: ListarPlanoQuery, paginar: boolean, codigoExato?: string) {
    const ultima = this.db
      .select({
        contaId: contaVersoes.contaId,
        numero: sql<number>`max(${contaVersoes.numero})`.as('numero_max'),
      })
      .from(contaVersoes)
      .where(isNull(contaVersoes.deletedAt))
      .groupBy(contaVersoes.contaId)
      .as('ultima');
    const contaPai = alias(contasContabeis, 'conta_pai');
    const filtros = [
      isNull(contasContabeis.deletedAt),
      eq(contaVersoes.numero, ultima.numero),
    ];
    if (query.situacao) filtros.push(eq(contaVersoes.situacao, query.situacao));
    if (codigoExato) filtros.push(eq(contasContabeis.codigo, codigoExato));
    if (query.q) {
      const termo = `%${query.q}%`;
      const busca = or(
        ilike(contaVersoes.nome, termo),
        ilike(contasContabeis.codigo, termo),
        ilike(contaVersoes.grupo, termo),
        ilike(centrosCusto.nome, termo),
      );
      if (busca) filtros.push(busca);
    }
    const onde = and(...filtros);
    const coluna = colunaOrdem(query.ordenar);
    const ordem = query.direcao === 'desc' ? desc(coluna) : asc(coluna);
    const base = this.db
      .select({
        codigo: contasContabeis.codigo,
        nome: contaVersoes.nome,
        classificacao: contaVersoes.classificacao,
        natureza: contaVersoes.natureza,
        grupo: contaVersoes.grupo,
        contaPaiCodigo: contaPai.codigo,
        centroCodigo: centrosCusto.codigo,
        centroNome: centrosCusto.nome,
        vigenciaInicio: contaVersoes.vigenciaInicio,
        vigenciaFim: contaVersoes.vigenciaFim,
        situacao: contaVersoes.situacao,
        numero: contaVersoes.numero,
        responsavelNome: usuarios.nome,
        criadoEm: contaVersoes.createdAt,
        alteradoEm: contaVersoes.updatedAt,
      })
      .from(contaVersoes)
      .innerJoin(ultima, eq(contaVersoes.contaId, ultima.contaId))
      .innerJoin(contasContabeis, eq(contasContabeis.id, contaVersoes.contaId))
      .innerJoin(centrosCusto, eq(centrosCusto.id, contaVersoes.centroCustoId))
      .innerJoin(usuarios, eq(usuarios.id, contaVersoes.responsavelId))
      .leftJoin(contaPai, eq(contaPai.id, contaVersoes.contaPaiId))
      .where(onde)
      .orderBy(ordem);
    const linhas = paginar
      ? await base.limit(PAGINA).offset((query.pagina - 1) * PAGINA)
      : await base;
    const [contagem] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(contaVersoes)
      .innerJoin(ultima, eq(contaVersoes.contaId, ultima.contaId))
      .innerJoin(contasContabeis, eq(contasContabeis.id, contaVersoes.contaId))
      .innerJoin(centrosCusto, eq(centrosCusto.id, contaVersoes.centroCustoId))
      .innerJoin(usuarios, eq(usuarios.id, contaVersoes.responsavelId))
      .leftJoin(contaPai, eq(contaPai.id, contaVersoes.contaPaiId))
      .where(onde);
    return { linhas, total: Number(contagem?.total ?? 0) };
  }
}

interface LinhaPlano {
  codigo: string;
  nome: string;
  classificacao: string;
  natureza: string;
  grupo: string;
  contaPaiCodigo: string | null;
  centroCodigo: string;
  centroNome: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  situacao: string;
  numero: number;
  responsavelNome: string;
  criadoEm: Date | string;
  alteradoEm: Date | string;
}

function colunaOrdem(ordenar: ListarPlanoQuery['ordenar']) {
  if (ordenar === 'naturezaConta') return contaVersoes.natureza;
  if (ordenar === 'centroCusto') return centrosCusto.nome;
  if (ordenar === 'vigenciaInicio') return contaVersoes.vigenciaInicio;
  if (ordenar === 'vigenciaFim') return contaVersoes.vigenciaFim;
  return contaVersoes.nome;
}

function instante(valor: Date | string): string {
  return valor instanceof Date ? valor.toISOString() : valor;
}
