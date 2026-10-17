import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import {
  auditoria,
  centrosCusto,
  contasContabeis,
  contaVersoes,
  politicasContabilizacao,
  politicaSimulacoes,
  politicaVersoes,
  usuarios,
} from '../../../database/schema';
import * as schema from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import { PlanoContasService } from '../plano/plano.service';
import { ultimaVersaoDecidida } from '../plano/vigencia';
import { balancear, centavos } from './centavos';
import { celulaCsv } from './csv';
import type {
  AprovarPoliticaDto,
  ConfigurarPoliticaDto,
  EditarPoliticaDto,
  ListarPoliticasQuery,
  LotePoliticaDto,
  SimularPoliticaDto,
} from './dto/politicas.dto';
import { ConflitoPoliticaException, RegraPoliticaException } from './regra-politica.exception';

type Banco = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0];
export interface ContagensPoliticas { revisao: number; suspensos: number }

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
  if (ano === undefined || mes === undefined) return competencia;
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(ano, mes - 1, 1)));
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

function instante(valor: Date | string): string {
  return valor instanceof Date ? valor.toISOString() : valor;
}

const ROTULO_ACAO: Record<string, string> = {
  configurar: 'Configurar mappings',
  editar: 'Editar versão',
  simular: 'Simular evento',
  aprovar: 'Aprovar regra',
};

function acontecimentoDe(dados: unknown, operacao: string) {
  if (dados && typeof dados === 'object' && 'acao' in dados) {
    const acao = String((dados as { acao: unknown }).acao);
    if (ROTULO_ACAO[acao]) return ROTULO_ACAO[acao];
  }
  return operacao;
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
      const [existente] = duplicada;
      if (existente) throw new ConflitoPoliticaException('evento duplicado', existente.codigo);
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
        dadosNovos: { codigo, tipoEvento: dto.tipoEvento, competencia: dto.competencia, numero: 1, acao: 'configurar' },
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
        dadosNovos: { codigo, numero: nova.numero, situacao: nova.situacao, acao: 'editar' },
        justificativa: dto.justificativa,
      });
    });
    this.eventEmitter.emit(EVENTOS.POLITICA_EDITADA, { codigo, acao: 'editar', situacao: 'DRAFT' });
    return this.obter(codigo);
  }

  async simular(codigo: string, dto: SimularPoliticaDto, usuarioId: string) {
    const situacao = await this.db.transaction(async (tx) => this.simularNaTx(tx, codigo, dto, usuarioId));
    this.eventEmitter.emit(EVENTOS.POLITICA_SIMULADA, { codigo, acao: 'simular', situacao });
    return this.obter(codigo);
  }

  async aprovar(codigo: string, dto: AprovarPoliticaDto, usuarioId: string) {
    await this.db.transaction(async (tx) => this.aprovarNaTx(tx, codigo, dto, usuarioId));
    this.eventEmitter.emit(EVENTOS.POLITICA_APROVADA, { codigo, acao: 'aprovar', situacao: 'APPROVED' });
    return this.obter(codigo);
  }

  async validar(dto: ConfigurarPoliticaDto) {
    const codigo = codigoDe(dto.tipoEvento, dto.competencia);
    const mensagens: string[] = [];
    await this.db.transaction(async (tx) => {
      const duplicada = await tx.select({ codigo: politicasContabilizacao.codigo }).from(politicasContabilizacao)
        .where(and(eq(politicasContabilizacao.codigo, codigo), isNull(politicasContabilizacao.deletedAt))).limit(1);
      if (duplicada.length > 0) mensagens.push('evento duplicado');
      for (const conta of [dto.contaDebitoCodigo, dto.contaCreditoCodigo]) {
        try {
          await this.contaAnaliticaVigente(tx, conta, codigo);
        } catch (erro) {
          if (!(erro instanceof RegraPoliticaException)) throw erro;
          mensagens.push('mapeamento ausente');
        }
      }
      try {
        await this.centroExistente(tx, dto.centroCodigo, codigo);
      } catch (erro) {
        if (!(erro instanceof RegraPoliticaException)) throw erro;
        mensagens.push('mapeamento ausente');
      }
    });
    return { valido: mensagens.length === 0, mensagens };
  }

  async historico(codigo: string) {
    const [politica] = await this.db.select({ id: politicasContabilizacao.id }).from(politicasContabilizacao)
      .where(and(eq(politicasContabilizacao.codigo, codigo), isNull(politicasContabilizacao.deletedAt))).limit(1);
    if (!politica) throw new NotFoundException('Política não encontrada');
    const versoes = await this.db.select({ id: politicaVersoes.id }).from(politicaVersoes)
      .where(eq(politicaVersoes.politicaId, politica.id));
    const simulacoes = await this.db.select({ id: politicaSimulacoes.id }).from(politicaSimulacoes)
      .where(eq(politicaSimulacoes.politicaId, politica.id));
    const ids = [...versoes.map((v) => v.id), ...simulacoes.map((s) => s.id)];
    if (ids.length === 0) return [];
    const linhas = await this.db.select({
      quando: auditoria.createdAt,
      quem: usuarios.nome,
      dadosNovos: auditoria.dadosNovos,
      operacao: auditoria.operacao,
      justificativa: auditoria.justificativa,
    }).from(auditoria)
      .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(and(inArray(auditoria.registroId, ids), eq(auditoria.modulo, 'contabilidade.politicas')))
      .orderBy(desc(auditoria.createdAt));
    return linhas.map((linha) => ({
      quando: instante(linha.quando),
      quem: linha.quem ?? '',
      acontecimento: acontecimentoDe(linha.dadosNovos, linha.operacao),
      justificativa: linha.justificativa ?? '',
    }));
  }

  async lote(dto: LotePoliticaDto, usuarioId: string) {
    const efeitos = await this.db.transaction(async (tx) => {
      const saida: { codigo: string; acao: string; situacao: string }[] = [];
      for (const codigo of dto.codigos) {
        const numero = dto.numeroPorCodigo[codigo];
        if (!numero) throw new ConflitoPoliticaException('conflito concorrente', codigo);
        if (dto.acao === 'simular') {
          if (!dto.valor) throw new RegraPoliticaException('Valor é obrigatório.', codigo);
          const situacao = await this.simularNaTx(tx, codigo, {
            numero,
            valor: dto.valor,
            justificativa: dto.justificativa,
          }, usuarioId);
          saida.push({ codigo, acao: 'simular', situacao });
        } else {
          await this.aprovarNaTx(tx, codigo, { numero, justificativa: dto.justificativa }, usuarioId);
          saida.push({ codigo, acao: 'aprovar', situacao: 'APPROVED' });
        }
      }
      return saida;
    });
    for (const efeito of efeitos) {
      const evento = efeito.acao === 'simular' ? EVENTOS.POLITICA_SIMULADA : EVENTOS.POLITICA_APROVADA;
      this.eventEmitter.emit(evento, efeito);
    }
    return efeitos;
  }

  async exportarCsv(query: ListarPoliticasQuery): Promise<string> {
    const bruto = await this.consulta(this.filtro(query)).orderBy(...this.ordemDe(query));
    const itens = bruto.map((linha) => this.apresentar(linha));
    const cabecalho = ['Competência', 'Situação', 'Conta de débito', 'Conta de crédito', 'Centro de custo', 'Tipo de ocorrência'];
    const linhas = itens.map((item) => [
      item.competenciaRotulo,
      item.situacaoRotulo,
      item.contaDebitoNome,
      item.contaCreditoNome,
      item.centroNome,
      item.tipoEventoRotulo,
    ]);
    const corpo = [cabecalho, ...linhas].map((linha) => linha.map(celulaCsv).join(';')).join('\n');
    return `\uFEFF${corpo}`;
  }

  async listar(query: ListarPoliticasQuery): Promise<{ itens: PoliticaApresentada[]; total: number; contagens: ContagensPoliticas }> {
    const filtro = this.filtro(query);
    const ordem = this.ordemDe(query);
    // Lista e total no mesmo instantâneo: sem isso, uma gravação entre as duas consultas gera itens vazio com total 1.
    return this.db.transaction(async (tx) => {
      const linhas = await this.consulta(filtro, tx).orderBy(...ordem).limit(PAGINA).offset((query.pagina - 1) * PAGINA);
      const [contagem] = await tx.select({ total: sql<number>`count(*)::int` })
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
      // KPIs da tela (Em revisão, Bloqueados) sobre a última versão de todas as políticas, sem o filtro da grade.
      const [kpi] = await tx.select({
        revisao: sql<number>`count(*) filter (where ${politicaVersoes.situacao} = 'REVIEW')::int`,
        suspensos: sql<number>`count(*) filter (where ${politicaVersoes.situacao} = 'SUSPENDED')::int`,
      })
        .from(politicasContabilizacao)
        .innerJoin(politicaVersoes, and(
          eq(politicaVersoes.politicaId, politicasContabilizacao.id),
          isNull(politicaVersoes.deletedAt),
          sql`${politicaVersoes.numero} = (
            select max(v2.numero) from politica_versoes v2
            where v2.politica_id = ${politicasContabilizacao.id} and v2.deleted_at is null
          )`,
        ))
        .where(isNull(politicasContabilizacao.deletedAt));
      return {
        itens: linhas.map((linha) => this.apresentar(linha)),
        total: Number(contagem?.total ?? 0),
        contagens: { revisao: Number(kpi?.revisao ?? 0), suspensos: Number(kpi?.suspensos ?? 0) },
      };
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  }

  async obter(codigo: string): Promise<PoliticaApresentada> {
    const [linha] = await this.consulta(eq(politicasContabilizacao.codigo, codigo)).limit(1);
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

  private consulta(extra?: SQL, executor: Banco | Tx = this.db) {
    const aprovador = alias(usuarios, 'aprovador_politica');
    return executor.select({
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
      .where(and(isNull(politicasContabilizacao.deletedAt), extra));
  }

  private filtro(query: ListarPoliticasQuery) {
    const termos = [isNull(politicasContabilizacao.deletedAt)];
    if (query.situacao) termos.push(eq(politicaVersoes.situacao, query.situacao));
    if (query.competencia) termos.push(eq(politicasContabilizacao.competencia, `${query.competencia}-01`));
    if (query.q) {
      const padrao = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
      termos.push(sql`(
        ${nomeDebito} ilike ${padrao} escape '\\'
        or ${nomeCredito} ilike ${padrao} escape '\\'
        or ${centrosCusto.nome} ilike ${padrao} escape '\\'
        or ${rotuloTipo} ilike ${padrao} escape '\\'
      )`);
    }
    return and(...termos);
  }

  private ordemDe(query: ListarPoliticasQuery) {
    const coluna = this.colunaOrdem(query.ordenar);
    // codigo é único entre as políticas vivas: desempate estável para paginar sem repetir nem perder linha.
    return query.direcao === 'desc'
      ? [desc(coluna), desc(politicasContabilizacao.codigo)]
      : [asc(coluna), asc(politicasContabilizacao.codigo)];
  }

  private colunaOrdem(ordenar: ListarPoliticasQuery['ordenar']) {
    if (ordenar === 'contaDebito') return nomeDebito;
    if (ordenar === 'contaCredito') return nomeCredito;
    if (ordenar === 'centroCusto') return centrosCusto.nome;
    if (ordenar === 'tipoEvento') return politicasContabilizacao.tipoEvento;
    return politicasContabilizacao.competencia;
  }

  private async simularNaTx(tx: Tx, codigo: string, dto: SimularPoliticaDto, usuarioId: string) {
    if (!dto.justificativa.trim()) throw new RegraPoliticaException('Informe justificativa para auditoria.', codigo);
    if (centavos(dto.valor, codigo) <= 0n) throw new RegraPoliticaException('valor deve ser maior que zero', codigo);
    const { versao } = await this.travar(tx, codigo, dto.numero);
    if (versao.situacao !== 'DRAFT' && versao.situacao !== 'APPROVED') {
      throw new ConflitoPoliticaException('conflito concorrente', codigo);
    }
    const debitoConta = await tx.select({ id: contasContabeis.id }).from(contasContabeis)
      .where(eq(contasContabeis.id, versao.contaDebitoId)).limit(1);
    const creditoConta = await tx.select({ id: contasContabeis.id }).from(contasContabeis)
      .where(eq(contasContabeis.id, versao.contaCreditoId)).limit(1);
    const centroLinha = await tx.select({ codigo: centrosCusto.codigo }).from(centrosCusto)
      .where(eq(centrosCusto.id, versao.centroCustoId)).limit(1);
    const codigoDebito = debitoConta[0] ? (await tx.select({ codigo: contasContabeis.codigo }).from(contasContabeis).where(eq(contasContabeis.id, versao.contaDebitoId)).limit(1))[0]?.codigo : undefined;
    const codigoCredito = creditoConta[0] ? (await tx.select({ codigo: contasContabeis.codigo }).from(contasContabeis).where(eq(contasContabeis.id, versao.contaCreditoId)).limit(1))[0]?.codigo : undefined;
    if (!codigoDebito || !codigoCredito || !centroLinha[0]) {
      throw new RegraPoliticaException('mapeamento ausente', codigo);
    }
    await this.contaAnaliticaVigente(tx, codigoDebito, codigo);
    await this.contaAnaliticaVigente(tx, codigoCredito, codigo);
    await this.centroExistente(tx, centroLinha[0].codigo, codigo);
    const balanceado = balancear([
      { lado: 'D', valor: dto.valor },
      { lado: 'C', valor: dto.valor },
    ], codigo);
    const simulacao = primeiroOuFalha(await tx.insert(politicaSimulacoes).values({
      politicaId: versao.politicaId,
      versaoNumero: versao.numero,
      valor: dto.valor,
      debito: balanceado.debito,
      credito: balanceado.credito,
    }).returning());
    await this.auditoria.registrar(tx, {
      tabela: 'politica_simulacoes',
      registroId: simulacao.id,
      operacao: 'INSERT',
      modulo: 'contabilidade.politicas',
      usuarioId,
      dadosAnteriores: {},
      dadosNovos: { codigo, numero: versao.numero, acao: 'simular', valor: dto.valor },
      justificativa: dto.justificativa,
    });
    return versao.situacao;
  }

  private async aprovarNaTx(tx: Tx, codigo: string, dto: AprovarPoliticaDto, usuarioId: string) {
    if (!dto.justificativa.trim()) throw new RegraPoliticaException('Informe justificativa para auditoria.', codigo);
    const { versao } = await this.travar(tx, codigo, dto.numero);
    if (versao.situacao !== 'DRAFT') throw new ConflitoPoliticaException('conflito concorrente', codigo);
    if (usuarioId === versao.responsavelId) {
      throw new RegraPoliticaException('aprovador diferente do autor', codigo);
    }
    const [simulacao] = await tx.select({ id: politicaSimulacoes.id }).from(politicaSimulacoes)
      .where(and(
        eq(politicaSimulacoes.politicaId, versao.politicaId),
        eq(politicaSimulacoes.versaoNumero, versao.numero),
        sql`${politicaSimulacoes.valor} > 0`,
        isNull(politicaSimulacoes.deletedAt),
      )).limit(1);
    if (!simulacao) {
      throw new RegraPoliticaException('Simule a versão com valor maior que zero antes de aprovar.', codigo);
    }
    const idsDasContas = [versao.contaDebitoId, versao.contaCreditoId];
    const codigosDasContas = new Map((await tx.select({ id: contasContabeis.id, codigo: contasContabeis.codigo })
      .from(contasContabeis).where(inArray(contasContabeis.id, idsDasContas))).map((c) => [c.id, c.codigo]));
    for (const idConta of idsDasContas) {
      const codigoConta = codigosDasContas.get(idConta);
      if (!codigoConta) throw new RegraPoliticaException('mapeamento ausente', codigo);
      await this.contaAnaliticaVigente(tx, codigoConta, codigo);
    }
    const nova = primeiroOuFalha(await tx.update(politicaVersoes).set({
      situacao: 'APPROVED',
      aprovadorId: usuarioId,
      justificativa: dto.justificativa,
    }).where(eq(politicaVersoes.id, versao.id)).returning());
    await this.auditoria.registrar(tx, {
      tabela: 'politica_versoes',
      registroId: nova.id,
      operacao: 'UPDATE',
      modulo: 'contabilidade.politicas',
      usuarioId,
      dadosAnteriores: { situacao: versao.situacao, numero: versao.numero },
      dadosNovos: { codigo, numero: nova.numero, situacao: 'APPROVED', acao: 'aprovar' },
      justificativa: dto.justificativa,
    });
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
      .where(and(eq(contasContabeis.codigo, codigoConta), isNull(contasContabeis.deletedAt))).limit(1);
    const emVigor = conta ? await ultimaVersaoDecidida(tx, conta.id) : null;
    if (!conta || !emVigor || emVigor.situacao !== 'APPROVED' || emVigor.classificacao !== 'analitica') {
      throw new RegraPoliticaException('mapeamento ausente', codigoPolitica);
    }
    const [vigente] = await tx.select({ id: contaVersoes.id }).from(contaVersoes).where(and(
      eq(contaVersoes.id, emVigor.id),
      sql`${contaVersoes.vigenciaInicio} <= ${HOJE}`,
      sql`(${contaVersoes.vigenciaFim} is null or ${contaVersoes.vigenciaFim} >= ${HOJE})`,
    )).limit(1);
    if (!vigente) throw new RegraPoliticaException('mapeamento ausente', codigoPolitica);
    return conta;
  }

  private async centroExistente(tx: Tx, codigoCentro: string, codigoPolitica: string) {
    const [centro] = await tx.select({ id: centrosCusto.id }).from(centrosCusto)
      .where(and(eq(centrosCusto.codigo, codigoCentro), isNull(centrosCusto.deletedAt))).limit(1);
    if (!centro) throw new RegraPoliticaException('mapeamento ausente', codigoPolitica);
    return centro;
  }
}
