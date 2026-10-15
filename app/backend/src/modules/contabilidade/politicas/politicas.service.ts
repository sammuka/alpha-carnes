import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import {
  centrosCusto,
  contasContabeis,
  contaVersoes,
  politicasContabilizacao,
  politicaVersoes,
  usuarios,
} from '../../../database/schema';
import * as schema from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import { PlanoContasService } from '../plano/plano.service';
import type {
  ConfigurarPoliticaDto,
  EditarPoliticaDto,
  ListarPoliticasQuery,
} from './dto/politicas.dto';
import { ConflitoPoliticaException, RegraPoliticaException } from './regra-politica.exception';

type Banco = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0];

const PAGINA = 20;

const TIPO_ROTULO: Record<string, string> = {
  LIQUIDACAO: 'Liquidação',
  REGISTRO: 'Registro de cobrança',
  CANCELAMENTO: 'Cancelamento',
  ESTORNO: 'Estorno',
  TARIFA: 'Tarifa',
};

const SITUACAO_ROTULO: Record<string, string> = {
  DRAFT: 'Rascunho',
  REVIEW: 'Aguardando revisão',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  SUSPENDED: 'Suspenso',
};

const HOJE = sql`(now() at time zone 'America/Sao_Paulo')::date`;

const nomeDebito = sql<string>`(
  select v.nome from conta_versoes v
  where v.conta_id = ${politicaVersoes.contaDebitoId} and v.deleted_at is null
  order by v.numero desc limit 1
)`;
const nomeCredito = sql<string>`(
  select v.nome from conta_versoes v
  where v.conta_id = ${politicaVersoes.contaCreditoId} and v.deleted_at is null
  order by v.numero desc limit 1
)`;
const codigoDebito = sql<string>`(
  select c.codigo from contas_contabeis c where c.id = ${politicaVersoes.contaDebitoId}
)`;
const codigoCredito = sql<string>`(
  select c.codigo from contas_contabeis c where c.id = ${politicaVersoes.contaCreditoId}
)`;
const rotuloTipo = sql<string>`case ${politicasContabilizacao.tipoEvento}
  when 'LIQUIDACAO' then 'Liquidação'
  when 'REGISTRO' then 'Registro de cobrança'
  when 'CANCELAMENTO' then 'Cancelamento'
  when 'ESTORNO' then 'Estorno'
  when 'TARIFA' then 'Tarifa'
  else ''
end`;
const simulacaoValor = sql<string | null>`(
  select s.valor from politica_simulacoes s
  where s.politica_id = ${politicasContabilizacao.id}
    and s.versao_numero = ${politicaVersoes.numero}
    and s.deleted_at is null
  order by s.created_at desc limit 1
)`;
const simulacaoDebito = sql<string | null>`(
  select s.debito from politica_simulacoes s
  where s.politica_id = ${politicasContabilizacao.id}
    and s.versao_numero = ${politicaVersoes.numero}
    and s.deleted_at is null
  order by s.created_at desc limit 1
)`;
const simulacaoCredito = sql<string | null>`(
  select s.credito from politica_simulacoes s
  where s.politica_id = ${politicasContabilizacao.id}
    and s.versao_numero = ${politicaVersoes.numero}
    and s.deleted_at is null
  order by s.created_at desc limit 1
)`;

export interface PoliticaApresentada {
  codigo: string;
  tipoEvento: string;
  tipoEventoRotulo: string;
  competencia: string;
  competenciaRotulo: string;
  contaDebitoCodigo: string;
  contaDebitoNome: string;
  contaCreditoCodigo: string;
  contaCreditoNome: string;
  centroCodigo: string;
  centroNome: string;
  vigenciaInicio: string;
  situacao: string;
  situacaoRotulo: string;
  numero: number;
  responsavelNome: string;
  aprovadorNome: string | null;
  criadoEm: string;
  alteradoEm: string;
  simulacaoValor: string | null;
  simulacaoDebito: string | null;
  simulacaoCredito: string | null;
}

interface LinhaPolitica {
  codigo: string;
  tipoEvento: string;
  competencia: string;
  contaDebitoCodigo: string;
  contaDebitoNome: string;
  contaCreditoCodigo: string;
  contaCreditoNome: string;
  centroCodigo: string;
  centroNome: string;
  vigenciaInicio: string;
  situacao: string;
  numero: number;
  responsavelNome: string;
  aprovadorNome: string | null;
  criadoEm: Date | string;
  alteradoEm: Date | string;
  simulacaoValor: string | null;
  simulacaoDebito: string | null;
  simulacaoCredito: string | null;
}

function codigoDe(tipo: string, competenciaMes: string) {
  return `${tipo}-${competenciaMes}`;
}

function mesDe(competencia: string) {
  return competencia.slice(0, 7);
}

function competenciaRotulo(competencia: string) {
  const [ano, mes] = mesDe(competencia).split('-').map(Number);
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(ano, (mes ?? 1) - 1, 1)));
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

function instante(valor: Date | string): string {
  return valor instanceof Date ? valor.toISOString() : valor;
}

@Injectable()
export class PoliticasContabilizacaoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: Banco },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly plano: PlanoContasService,
  ) {}

  private get db(): Banco {
    return this.drizzle.db;
  }

  async configurar(dto: ConfigurarPoliticaDto, usuarioId: string) {
    const codigo = codigoDe(dto.tipoEvento, dto.competencia);
    if (!dto.justificativa.trim()) {
      throw new RegraPoliticaException('Informe justificativa para auditoria.', codigo);
    }
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'contabilidade:politica:' + codigo}))`);
      const duplicada = await tx.select({ codigo: politicasContabilizacao.codigo }).from(politicasContabilizacao)
        .where(and(eq(politicasContabilizacao.codigo, codigo), isNull(politicasContabilizacao.deletedAt))).limit(1);
      if (duplicada.length > 0) throw new ConflitoPoliticaException('evento duplicado', duplicada[0].codigo);
      const debito = await this.contaAnaliticaVigente(tx, dto.contaDebitoCodigo, codigo);
      const credito = await this.contaAnaliticaVigente(tx, dto.contaCreditoCodigo, codigo);
      const centro = await this.centroExistente(tx, dto.centroCodigo, codigo);
      const politica = primeiroOuFalha(await tx.insert(politicasContabilizacao).values({
        codigo,
        tipoEvento: dto.tipoEvento,
        competencia: `${dto.competencia}-01`,
      }).returning());
      const versao = primeiroOuFalha(await tx.insert(politicaVersoes).values({
        politicaId: politica.id,
        numero: 1,
        contaDebitoId: debito.id,
        contaCreditoId: credito.id,
        centroCustoId: centro.id,
        vigenciaInicio: dto.vigenciaInicio,
        situacao: 'DRAFT',
        justificativa: dto.justificativa,
        responsavelId: usuarioId,
      }).returning());
      await this.auditoria.registrar(tx, {
        tabela: 'politica_versoes',
        registroId: versao.id,
        operacao: 'INSERT',
        modulo: 'contabilidade.politicas',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: { codigo, tipoEvento: dto.tipoEvento, competencia: dto.competencia, numero: 1 },
        justificativa: dto.justificativa,
      });
    });
    this.eventEmitter.emit(EVENTOS.POLITICA_CONFIGURADA, { codigo, acao: 'configurar', situacao: 'DRAFT' });
    return this.obter(codigo);
  }

  async editar(codigo: string, dto: EditarPoliticaDto, usuarioId: string) {
    if (!dto.justificativa.trim()) {
      throw new RegraPoliticaException('Informe justificativa para auditoria.', codigo);
    }
    await this.db.transaction(async (tx) => {
      const { politica, versao } = await this.travar(tx, codigo, dto.numero);
      if (
        (dto.tipoEvento !== undefined && dto.tipoEvento !== politica.tipoEvento)
        || (dto.competencia !== undefined && dto.competencia !== mesDe(String(politica.competencia)))
      ) {
        throw new RegraPoliticaException('origem imutável', codigo);
      }
      if (versao.situacao !== 'DRAFT') {
        throw new ConflitoPoliticaException('conflito concorrente', codigo);
      }
      const debito = await this.contaAnaliticaVigente(tx, dto.contaDebitoCodigo, codigo);
      const credito = await this.contaAnaliticaVigente(tx, dto.contaCreditoCodigo, codigo);
      const centro = await this.centroExistente(tx, dto.centroCodigo, codigo);
      const nova = primeiroOuFalha(await tx.update(politicaVersoes).set({
        contaDebitoId: debito.id,
        contaCreditoId: credito.id,
        centroCustoId: centro.id,
        vigenciaInicio: dto.vigenciaInicio,
        justificativa: dto.justificativa,
      }).where(eq(politicaVersoes.id, versao.id)).returning());
      await this.auditoria.registrar(tx, {
        tabela: 'politica_versoes',
        registroId: nova.id,
        operacao: 'UPDATE',
        modulo: 'contabilidade.politicas',
        usuarioId,
        dadosAnteriores: { numero: versao.numero, situacao: versao.situacao },
        dadosNovos: { codigo, numero: nova.numero, situacao: nova.situacao },
        justificativa: dto.justificativa,
      });
    });
    return this.obter(codigo);
  }

  async listar(query: ListarPoliticasQuery): Promise<{ itens: PoliticaApresentada[]; total: number }> {
    const filtro = this.filtro(query);
    const coluna = this.colunaOrdem(query.ordenar);
    const ordem = query.direcao === 'desc' ? desc(coluna) : asc(coluna);
    const linhas = await this.consulta().where(filtro).orderBy(ordem).limit(PAGINA).offset((query.pagina - 1) * PAGINA);
    const [contagem] = await this.db.select({ total: sql<number>`count(*)::int` })
      .from(politicasContabilizacao)
      .innerJoin(politicaVersoes, and(
        eq(politicaVersoes.politicaId, politicasContabilizacao.id),
        isNull(politicaVersoes.deletedAt),
        sql`${politicaVersoes.numero} = (
          select max(v2.numero) from politica_versoes v2
          where v2.politica_id = ${politicasContabilizacao.id} and v2.deleted_at is null
        )`,
      ))
      .innerJoin(centrosCusto, eq(centrosCusto.id, politicaVersoes.centroCustoId))
      .where(filtro);
    return { itens: linhas.map((linha) => this.apresentar(linha)), total: Number(contagem?.total ?? 0) };
  }

  async obter(codigo: string): Promise<PoliticaApresentada> {
    const [linha] = await this.consulta().where(and(
      eq(politicasContabilizacao.codigo, codigo),
      isNull(politicasContabilizacao.deletedAt),
    )).limit(1);
    if (!linha) throw new NotFoundException('Política não encontrada');
    return this.apresentar(linha);
  }

  apresentar(linha: LinhaPolitica): PoliticaApresentada {
    return {
      codigo: linha.codigo,
      tipoEvento: linha.tipoEvento,
      tipoEventoRotulo: TIPO_ROTULO[linha.tipoEvento] ?? linha.tipoEvento,
      competencia: mesDe(String(linha.competencia)),
      competenciaRotulo: competenciaRotulo(String(linha.competencia)),
      contaDebitoCodigo: linha.contaDebitoCodigo,
      contaDebitoNome: linha.contaDebitoNome,
      contaCreditoCodigo: linha.contaCreditoCodigo,
      contaCreditoNome: linha.contaCreditoNome,
      centroCodigo: linha.centroCodigo,
      centroNome: linha.centroNome,
      vigenciaInicio: String(linha.vigenciaInicio),
      situacao: linha.situacao,
      situacaoRotulo: SITUACAO_ROTULO[linha.situacao] ?? linha.situacao,
      numero: linha.numero,
      responsavelNome: linha.responsavelNome,
      aprovadorNome: linha.aprovadorNome,
      criadoEm: instante(linha.criadoEm),
      alteradoEm: instante(linha.alteradoEm),
      simulacaoValor: linha.simulacaoValor,
      simulacaoDebito: linha.simulacaoDebito,
      simulacaoCredito: linha.simulacaoCredito,
    };
  }

  async listarOpcoes() {
    const [contas, centros] = await Promise.all([
      this.plano.listarContasAnaliticasVigentes(),
      this.plano.listarCentrosAtivos(),
    ]);
    return { contas, centros };
  }

  private consulta() {
    const aprovador = alias(usuarios, 'aprovador_politica');
    return this.db.select({
      codigo: politicasContabilizacao.codigo,
      tipoEvento: politicasContabilizacao.tipoEvento,
      competencia: politicasContabilizacao.competencia,
      contaDebitoCodigo: codigoDebito,
      contaDebitoNome: nomeDebito,
      contaCreditoCodigo: codigoCredito,
      contaCreditoNome: nomeCredito,
      centroCodigo: centrosCusto.codigo,
      centroNome: centrosCusto.nome,
      vigenciaInicio: politicaVersoes.vigenciaInicio,
      situacao: politicaVersoes.situacao,
      numero: politicaVersoes.numero,
      responsavelNome: usuarios.nome,
      aprovadorNome: aprovador.nome,
      criadoEm: politicaVersoes.createdAt,
      alteradoEm: politicaVersoes.updatedAt,
      simulacaoValor,
      simulacaoDebito,
      simulacaoCredito,
    }).from(politicasContabilizacao)
      .innerJoin(politicaVersoes, and(
        eq(politicaVersoes.politicaId, politicasContabilizacao.id),
        isNull(politicaVersoes.deletedAt),
        sql`${politicaVersoes.numero} = (
          select max(v2.numero) from politica_versoes v2
          where v2.politica_id = ${politicasContabilizacao.id} and v2.deleted_at is null
        )`,
      ))
      .innerJoin(centrosCusto, eq(centrosCusto.id, politicaVersoes.centroCustoId))
      .innerJoin(usuarios, eq(usuarios.id, politicaVersoes.responsavelId))
      .leftJoin(aprovador, eq(aprovador.id, politicaVersoes.aprovadorId))
      .where(isNull(politicasContabilizacao.deletedAt));
  }

  private filtro(query: ListarPoliticasQuery) {
    const termos = [isNull(politicasContabilizacao.deletedAt)];
    if (query.situacao) termos.push(eq(politicaVersoes.situacao, query.situacao));
    if (query.competencia) termos.push(eq(politicasContabilizacao.competencia, `${query.competencia}-01`));
    if (query.q) {
      const padrao = `%${query.q}%`;
      termos.push(sql`(
        ${nomeDebito} ilike ${padrao}
        or ${nomeCredito} ilike ${padrao}
        or ${centrosCusto.nome} ilike ${padrao}
        or ${rotuloTipo} ilike ${padrao}
      )`);
    }
    return and(...termos);
  }

  private colunaOrdem(ordenar: ListarPoliticasQuery['ordenar']) {
    if (ordenar === 'contaDebito') return nomeDebito;
    if (ordenar === 'contaCredito') return nomeCredito;
    if (ordenar === 'centroCusto') return centrosCusto.nome;
    if (ordenar === 'tipoEvento') return politicasContabilizacao.tipoEvento;
    return politicasContabilizacao.competencia;
  }

  private async travar(tx: Tx, codigo: string, numero: number) {
    const [politica] = await tx.select().from(politicasContabilizacao)
      .where(and(eq(politicasContabilizacao.codigo, codigo), isNull(politicasContabilizacao.deletedAt)))
      .for('update').limit(1);
    if (!politica) throw new NotFoundException('Política não encontrada');
    const versoes = await tx.select().from(politicaVersoes)
      .where(and(eq(politicaVersoes.politicaId, politica.id), isNull(politicaVersoes.deletedAt)));
    const maior = versoes.reduce((m, v) => Math.max(m, v.numero), 0);
    if (maior !== numero) throw new ConflitoPoliticaException('conflito concorrente', codigo);
    const versao = versoes.find((v) => v.numero === numero);
    if (!versao) throw new NotFoundException('Política não encontrada');
    return { politica, versao };
  }

  private async contaAnaliticaVigente(tx: Tx, codigoConta: string, codigoPolitica: string) {
    const [conta] = await tx.select({ id: contasContabeis.id }).from(contasContabeis)
      .innerJoin(contaVersoes, and(
        eq(contaVersoes.contaId, contasContabeis.id),
        eq(contaVersoes.situacao, 'APPROVED'),
        eq(contaVersoes.classificacao, 'analitica'),
        isNull(contaVersoes.deletedAt),
        sql`${contaVersoes.vigenciaInicio} <= ${HOJE}`,
        sql`(${contaVersoes.vigenciaFim} is null or ${contaVersoes.vigenciaFim} >= ${HOJE})`,
      ))
      .where(and(eq(contasContabeis.codigo, codigoConta), isNull(contasContabeis.deletedAt)))
      .orderBy(desc(contaVersoes.numero))
      .limit(1);
    if (!conta) throw new RegraPoliticaException('mapeamento ausente', codigoPolitica);
    return conta;
  }

  private async centroExistente(tx: Tx, codigoCentro: string, codigoPolitica: string) {
    const [centro] = await tx.select({ id: centrosCusto.id }).from(centrosCusto)
      .where(and(eq(centrosCusto.codigo, codigoCentro), isNull(centrosCusto.deletedAt))).limit(1);
    if (!centro) throw new RegraPoliticaException('mapeamento ausente', codigoPolitica);
    return centro;
  }
}
