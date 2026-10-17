import { ConflictException, HttpException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import {
  auditoria,
  centrosCusto,
  contaVersoes,
  contasContabeis,
  usuarios,
} from '../../../database/schema';
import * as schema from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import {
  acaoSchema,
  type CriarCentroDto,
  type CriarContaDto,
  type DecidirContaDto,
  type EditarContaDto,
  type ListarPlanoQuery,
  type OpcoesPaiQuery,
  type LoteDto,
  type MapearContaDto,
  type RevisarCompetenciaDto,
  dataCalendarioValida,
} from './dto/plano.dto';
import { RegraContabilException } from './regra-contabil.exception';
import { hojeSaoPaulo, LIMITE_OPCOES_PAI, opcoesPaiVigentes, ultimaVersaoDecidida, vigenciaContida, vigenteEm } from './vigencia';

type Banco = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0];
export interface ContagensPlano { revisao: number; suspensos: number }
type Vigencia = { vigenciaInicio: string; vigenciaFim: string | null };

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

const EVENTO_DA_ACAO = {
  'revisar-competencia': { evento: EVENTOS.PLANO_CONTA_REVISADA, acao: 'revisar', situacao: 'REVIEW' },
  aprovar: { evento: EVENTOS.PLANO_CONTA_APROVADA, acao: 'aprovar', situacao: 'APPROVED' },
  bloquear: { evento: EVENTOS.PLANO_CONTA_BLOQUEADA, acao: 'bloquear', situacao: 'SUSPENDED' },
} as const;

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
    // Plano D2: criar grava sempre DRAFT; outra situação enviada é recusada, não descartada em silêncio.
    if (dto.situacao !== undefined && dto.situacao !== 'DRAFT') {
      throw new RegraContabilException('Situação não permite esta transição');
    }
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'contabilidade:conta:' + dto.codigo}))`);
      const duplicada = await tx.select({ id: contasContabeis.id }).from(contasContabeis)
        .where(and(eq(contasContabeis.codigo, dto.codigo), isNull(contasContabeis.deletedAt))).limit(1);
      if (duplicada.length > 0) throw new ConflictException('Já existe conta com este código');
      const centro = await this.centroAtivo(tx, dto.centroCodigo);
      const paiId = await this.paiValido(tx, dto.classificacao, dto.contaPaiCodigo, dto);
      const conta = primeiroOuFalha(await tx.insert(contasContabeis).values({ codigo: dto.codigo }).returning());
      const versao = primeiroOuFalha(await tx.insert(contaVersoes).values({
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
        autorId: usuarioId,
      }).returning());
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
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'contabilidade:centro:' + dto.codigo}))`);
      const duplicado = await tx.select({ id: centrosCusto.id }).from(centrosCusto)
        .where(and(eq(centrosCusto.codigo, dto.codigo), isNull(centrosCusto.deletedAt))).limit(1);
      if (duplicado.length > 0) throw new ConflictException('Já existe centro de custo com este código');
      const centro = primeiroOuFalha(await tx.insert(centrosCusto).values({ codigo: dto.codigo, nome: dto.nome }).returning());
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

  async listar(query: ListarPlanoQuery): Promise<{ itens: ContaApresentada[]; total: number; contagens: ContagensPlano }> {
    // Lista, total e contagens no mesmo instantâneo: sem isso, uma gravação entre as consultas gera itens e total divergentes.
    return this.db.transaction(async (tx) => {
      const { linhas, total } = await this.consultarEm(tx, query, true);
      return { itens: linhas.map((linha) => this.apresentar(linha)), total, contagens: await this.contagens(tx) };
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  }

  /** KPIs da tela (Em revisão, Bloqueados) sobre a última versão de todas as contas, sem o filtro da grade. */
  private async contagens(tx: Tx): Promise<ContagensPlano> {
    // Agregado sem GROUP BY: sempre uma linha.
    const [linha] = (await tx.select({
      revisao: sql<number>`count(*) filter (where ${contaVersoes.situacao} = 'REVIEW')::int`,
      suspensos: sql<number>`count(*) filter (where ${contaVersoes.situacao} = 'SUSPENDED')::int`,
    })
      .from(contaVersoes)
      .innerJoin(contasContabeis, eq(contasContabeis.id, contaVersoes.contaId))
      .where(and(
        isNull(contasContabeis.deletedAt),
        isNull(contaVersoes.deletedAt),
        sql`${contaVersoes.numero} = (select max(v2.numero) from conta_versoes v2 where v2.conta_id = ${contaVersoes.contaId} and v2.deleted_at is null)`,
      ))) as [ContagensPlano];
    return { revisao: Number(linha.revisao), suspensos: Number(linha.suspensos) };
  }

  async obter(codigo: string): Promise<ContaApresentada> {
    const { linhas } = await this.consultar(
      { pagina: 1, q: '', situacao: '', ordenar: 'contaContabil', direcao: 'asc' },
      codigo,
    );
    const linha = linhas[0];
    if (!linha) throw new NotFoundException('Conta não encontrada');
    return this.apresentar(linha);
  }

  async listarCentrosAtivos() {
    return this.db.select({
      codigo: centrosCusto.codigo,
      nome: centrosCusto.nome,
    }).from(centrosCusto).where(isNull(centrosCusto.deletedAt)).orderBy(asc(centrosCusto.codigo));
  }

  async listarContasAnaliticasVigentes(): Promise<{ codigo: string; nome: string }[]> {
    const hoje = sql`(now() at time zone 'America/Sao_Paulo')::date`;
    // Mesma regra de plano/vigencia.ts (ultimaVersaoDecidida): vale a versão de maior numero entre APPROVED e SUSPENDED.
    return this.db.select({
      codigo: contasContabeis.codigo,
      nome: contaVersoes.nome,
    }).from(contasContabeis)
      .innerJoin(contaVersoes, and(
        eq(contaVersoes.contaId, contasContabeis.id),
        isNull(contaVersoes.deletedAt),
        sql`${contaVersoes.numero} = (
          select max(v2.numero) from conta_versoes v2
          where v2.conta_id = ${contasContabeis.id}
            and v2.deleted_at is null
            and v2.situacao in ('APPROVED', 'SUSPENDED')
        )`,
        eq(contaVersoes.situacao, 'APPROVED'),
        eq(contaVersoes.classificacao, 'analitica'),
        sql`${contaVersoes.vigenciaInicio} <= ${hoje}`,
        sql`(${contaVersoes.vigenciaFim} is null or ${contaVersoes.vigenciaFim} >= ${hoje})`,
      ))
      .where(isNull(contasContabeis.deletedAt))
      .orderBy(asc(contasContabeis.codigo));
  }

  async listarOpcoesPai(query: OpcoesPaiQuery) {
    const linhas = await opcoesPaiVigentes(this.db, query.q, LIMITE_OPCOES_PAI + 1);
    return { itens: linhas.slice(0, LIMITE_OPCOES_PAI), truncado: linhas.length > LIMITE_OPCOES_PAI };
  }

  async exportarCsv(query: ListarPlanoQuery): Promise<string> {
    const { linhas: bruto } = await this.consultar(query);
    const itens = bruto.map((linha) => this.apresentar(linha));
    const cabecalho = ['Conta contábil', 'Situação', 'Natureza da conta', 'Centro de custo', 'Início de vigência', 'Fim de vigência'];
    const linhas = itens.map((item) => [
      item.nome,
      item.situacaoRotulo,
      item.naturezaRotulo,
      item.centroNome,
      item.vigenciaInicio,
      item.vigenciaFim ?? '—',
    ]);
    // Célula que o Excel ou o Calc leria como fórmula ganha o prefixo ' (CSV injection).
    const neutralizar = (valor: string) => (/^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor);
    const escapar = (valor: string) => {
      const seguro = neutralizar(valor);
      return /[",;\r\n\t]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
    };
    const corpo = [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(';')).join('\n');
    return `\uFEFF${corpo}`;
  }

  async executar(
    acao: keyof typeof acaoSchema,
    codigo: string,
    dto: EditarContaDto | RevisarCompetenciaDto | DecidirContaDto | MapearContaDto,
    usuarioId: string,
  ) {
    if (acao === 'editar') return this.editar(codigo, dto as EditarContaDto, usuarioId);
    if (acao === 'versionar') return this.versionar(codigo, dto as EditarContaDto, usuarioId);
    if (acao === 'revisar-competencia') return this.revisarCompetencia(codigo, dto as RevisarCompetenciaDto, usuarioId);
    if (acao === 'aprovar') return this.aprovar(codigo, dto as DecidirContaDto, usuarioId);
    if (acao === 'bloquear') return this.bloquear(codigo, dto as DecidirContaDto, usuarioId);
    if (acao === 'mapear') return this.mapear(codigo, dto as MapearContaDto, usuarioId);
    throw new NotFoundException();
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

  private async paiValido(
    tx: Tx,
    classificacao: 'sintetica' | 'analitica',
    contaPaiCodigo: string | null,
    vigencia: Vigencia,
  ) {
    if (!contaPaiCodigo) {
      if (classificacao === 'analitica') throw new RegraContabilException('Conta pai não encontrada');
      return null;
    }
    const [pai] = await tx.select().from(contasContabeis)
      .where(and(eq(contasContabeis.codigo, contaPaiCodigo), isNull(contasContabeis.deletedAt))).limit(1);
    if (!pai) throw new RegraContabilException('Conta pai não encontrada');
    await this.exigirPaiVigente(tx, pai.id, vigencia);
    return pai.id;
  }

  /**
   * Versão vigente do pai, ou 422. Suspensa: `conta desativada`. Nunca decidida: `Conta pai não está ativa`.
   * Plano D3: o pai está vigente hoje (America/Sao_Paulo) e a vigência da filha cabe inteira na do pai.
   */
  private async exigirPaiVigente(tx: Tx, paiId: string, filha: Vigencia) {
    const decidida = await ultimaVersaoDecidida(tx, paiId);
    if (!decidida) throw new RegraContabilException('Conta pai não está ativa');
    if (decidida.situacao === 'SUSPENDED') throw new RegraContabilException('conta desativada');
    if (decidida.classificacao === 'analitica') {
      throw new RegraContabilException('Conta pai analítica não é nível hierárquico válido');
    }
    if (!vigenteEm(decidida, await hojeSaoPaulo(tx))) throw new RegraContabilException('Conta pai fora de vigência');
    if (!vigenciaContida(filha, decidida)) {
      throw new RegraContabilException('Vigência da conta fora da vigência da conta pai');
    }
    return decidida;
  }

  /** Mesmo lock de aprovar e bloquear, antes do FOR UPDATE da conta (mesma ordem: sem deadlock). */
  private async travarHierarquia(tx: Tx) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'contabilidade:hierarquia'}))`);
  }

  /**
   * Plano D3, sob o lock da hierarquia: conta com filha decidida não vira analítica (analítica não é pai) e
   * conta referenciada por política ativa (rascunho, revisão ou aprovada) não vira sintética (sintética não
   * recebe lançamento). Vale para editar, versionar e aprovar.
   */
  private async exigirClassificacaoCompativel(tx: Tx, contaId: string, classificacao: string) {
    if (classificacao === 'analitica') {
      const filhas = await tx.execute(sql`
        select 1
          from (
            select distinct on (v.conta_id) v.conta_pai_id
              from conta_versoes v
              join contas_contabeis c on c.id = v.conta_id
             where c.deleted_at is null
               and v.deleted_at is null
               and v.situacao in ('APPROVED', 'SUSPENDED')
             order by v.conta_id, v.numero desc
          ) d
         where d.conta_pai_id = ${contaId}
         limit 1`);
      if (filhas.rows.length > 0) throw new RegraContabilException('Conta com contas filhas não pode ser analítica');
      return;
    }
    const usos = await tx.execute(sql`
      select 1
        from politica_versoes pv
        join politicas_contabilizacao p on p.id = pv.politica_id
       where p.deleted_at is null
         and pv.deleted_at is null
         and pv.situacao in ('DRAFT', 'REVIEW', 'APPROVED')
         and (pv.conta_debito_id = ${contaId} or pv.conta_credito_id = ${contaId})
       limit 1`);
    if (usos.rows.length > 0) {
      throw new RegraContabilException('Conta usada em política de contabilização não pode ser sintética');
    }
  }

  /**
   * AD-39/D3 pelo lado do pai, sob o lock da hierarquia: a nova vigência da conta precisa conter a de cada
   * filha com versão em jogo (rascunho, revisão, aprovada ou suspensa; vale a última decidida e a aberta
   * acima dela) e, havendo filha ativa (rascunho, revisão ou aprovada), estar vigente hoje.
   * Vale para editar, versionar, revisar-competencia e aprovar.
   */
  private async exigirVigenciaCobreFilhas(tx: Tx, contaId: string, vigencia: Vigencia) {
    const filhas = await tx.execute(sql`
      select v.situacao, v.vigencia_inicio::text as "vigenciaInicio", v.vigencia_fim::text as "vigenciaFim"
        from conta_versoes v
        join contas_contabeis c on c.id = v.conta_id
       where c.deleted_at is null
         and v.deleted_at is null
         and v.conta_pai_id = ${contaId}
         and v.situacao in ('DRAFT', 'REVIEW', 'APPROVED', 'SUSPENDED')
         and v.numero >= coalesce((
           select max(v2.numero) from conta_versoes v2
            where v2.conta_id = v.conta_id and v2.deleted_at is null and v2.situacao in ('APPROVED', 'SUSPENDED')
         ), 0)`);
    const linhas = filhas.rows as (Vigencia & { situacao: string })[];
    if (linhas.some((filha) => !vigenciaContida(filha, vigencia))) {
      throw new RegraContabilException('A nova vigência da conta não cobre a vigência das contas filhas');
    }
    if (linhas.some((filha) => filha.situacao !== 'SUSPENDED') && !vigenteEm(vigencia, await hojeSaoPaulo(tx))) {
      throw new RegraContabilException('Conta com contas filhas ativas precisa estar vigente hoje');
    }
  }

  private async recusarCiclo(tx: Tx, contaId: string, paiId: string | null) {
    if (paiId && await this.ciclo(tx, contaId, paiId)) {
      throw new RegraContabilException('Ciclo na hierarquia da conta');
    }
  }

  /** Pai de uma versão nova ou editada: existe, é vigente e sintético, e não fecha ciclo. */
  private async paiDaVersao(tx: Tx, contaId: string, dto: EditarContaDto) {
    const paiId = await this.paiValido(tx, dto.classificacao, dto.contaPaiCodigo, dto);
    await this.recusarCiclo(tx, contaId, paiId);
    await this.exigirClassificacaoCompativel(tx, contaId, dto.classificacao);
    await this.exigirVigenciaCobreFilhas(tx, contaId, dto);
    return paiId;
  }

  async editar(codigo: string, dto: EditarContaDto, usuarioId: string) {
    const salva = await this.db.transaction(async (tx) => {
      await this.travarHierarquia(tx);
      const { atual } = await this.travar(tx, codigo, dto.numero);
      if (atual.situacao === 'SUSPENDED') throw new RegraContabilException('conta desativada');
      const centro = await this.centroAtivo(tx, dto.centroCodigo);
      if (atual.situacao === 'APPROVED' && this.mudouClassificacao(atual, dto, centro.id)) {
        throw new RegraContabilException('mudança de classificação após fechamento');
      }
      if (atual.situacao !== 'DRAFT') throw new RegraContabilException('Situação não permite esta transição');
      if (!dto.justificativa.trim()) throw new RegraContabilException('Informe justificativa para auditoria.');
      const paiId = await this.paiDaVersao(tx, atual.contaId, dto);
      const nova = primeiroOuFalha(await tx.update(contaVersoes).set({
        nome: dto.nome,
        classificacao: dto.classificacao,
        natureza: dto.natureza,
        grupo: dto.grupo,
        contaPaiId: paiId,
        centroCustoId: centro.id,
        vigenciaInicio: dto.vigenciaInicio,
        vigenciaFim: dto.vigenciaFim,
        justificativa: dto.justificativa,
        responsavelId: usuarioId,
      }).where(eq(contaVersoes.id, atual.id)).returning());
      await this.auditoria.registrar(tx, {
        tabela: 'conta_versoes', registroId: nova.id, operacao: 'UPDATE',
        modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: atual, dadosNovos: nova,
        justificativa: dto.justificativa,
      });
      return nova;
    });
    this.eventEmitter.emit(EVENTOS.PLANO_CONTA_CRIADA, { codigo, acao: 'editar', situacao: salva.situacao });
    return this.obter(codigo);
  }

  async revisarCompetencia(codigo: string, dto: RevisarCompetenciaDto | { numero: number; vigenciaInicio: string; vigenciaFim: string | null; justificativa: string }, usuarioId: string) {
    if (!dataCalendarioValida(dto.vigenciaInicio)) {
      throw new RegraContabilException('Início de vigência é obrigatório');
    }
    if (!dto.justificativa.trim()) throw new RegraContabilException('Informe justificativa para auditoria.');
    await this.db.transaction(async (tx) => {
      await this.revisarNaTx(tx, codigo, dto.numero, dto.justificativa, usuarioId, dto.vigenciaInicio, dto.vigenciaFim);
    });
    this.emitirAcao('revisar-competencia', codigo);
    return this.obter(codigo);
  }

  async aprovar(codigo: string, dto: DecidirContaDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      await this.aprovarNaTx(tx, codigo, dto.numero, dto.justificativa, usuarioId);
    });
    this.emitirAcao('aprovar', codigo);
    return this.obter(codigo);
  }

  async bloquear(codigo: string, dto: DecidirContaDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      await this.bloquearNaTx(tx, codigo, dto.numero, dto.justificativa, usuarioId);
    });
    this.emitirAcao('bloquear', codigo);
    return this.obter(codigo);
  }

  async versionar(codigo: string, dto: EditarContaDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      await this.travarHierarquia(tx);
      const { conta, atual } = await this.travar(tx, codigo, dto.numero);
      if (atual.situacao === 'SUSPENDED') throw new RegraContabilException('conta desativada');
      if (atual.situacao === 'DRAFT' || atual.situacao === 'REVIEW') {
        throw new ConflictException('Versão em aberto já existe');
      }
      if (atual.situacao !== 'APPROVED') throw new RegraContabilException('conta desativada');
      const paiId = await this.paiDaVersao(tx, conta.id, dto);
      const centro = await this.centroAtivo(tx, dto.centroCodigo);
      const nova = primeiroOuFalha(await tx.insert(contaVersoes).values({
        contaId: conta.id,
        numero: atual.numero + 1,
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
        autorId: usuarioId,
      }).returning());
      await this.auditoria.registrar(tx, {
        tabela: 'conta_versoes', registroId: nova.id, operacao: 'INSERT',
        modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: atual, dadosNovos: nova,
        justificativa: dto.justificativa,
      });
    });
    this.eventEmitter.emit(EVENTOS.PLANO_CONTA_VERSIONADA, { codigo, acao: 'versionar', situacao: 'DRAFT' });
    return this.obter(codigo);
  }

  async mapear(codigo: string, dto: MapearContaDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      const { atual } = await this.travar(tx, codigo, dto.numero);
      if (atual.situacao === 'SUSPENDED') throw new RegraContabilException('conta desativada');
      if (atual.classificacao !== 'analitica') {
        throw new RegraContabilException('Conta sintética não recebe mapeamento de lançamentos');
      }
      if (atual.situacao !== 'APPROVED') throw new RegraContabilException('Conta ainda não aprovada');
      const centro = await this.centroAtivo(tx, dto.centroCodigo);
      if (centro.id !== atual.centroCustoId) {
        throw new RegraContabilException('mudança de classificação após fechamento');
      }
      await this.auditoria.registrar(tx, {
        tabela: 'conta_versoes', registroId: atual.id, operacao: 'ACAO_MANUAL',
        modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: atual, dadosNovos: atual,
        justificativa: dto.justificativa,
      });
    });
    this.eventEmitter.emit(EVENTOS.PLANO_CONTA_MAPEADA, { codigo, acao: 'mapear', situacao: 'APPROVED' });
    return this.obter(codigo);
  }

  private emitirAcao(chave: keyof typeof EVENTO_DA_ACAO, codigo: string) {
    const { evento, acao, situacao } = EVENTO_DA_ACAO[chave];
    this.eventEmitter.emit(evento, { codigo, acao, situacao });
  }

  async lote(dto: LoteDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      for (const codigo of dto.codigos) {
        try {
          const numero = Object.hasOwn(dto.numeroPorCodigo, codigo) ? dto.numeroPorCodigo[codigo] : undefined;
          if (numero === undefined) throw new RegraContabilException('conflito concorrente');
          if (dto.acao === 'bloquear') await this.bloquearNaTx(tx, codigo, numero, dto.justificativa, usuarioId);
          if (dto.acao === 'aprovar') await this.aprovarNaTx(tx, codigo, numero, dto.justificativa, usuarioId);
          if (dto.acao === 'revisar-competencia') await this.revisarNaTx(tx, codigo, numero, dto.justificativa, usuarioId);
        } catch (erro) {
          if (erro instanceof HttpException) {
            // `codigo` no lote é a conta que falhou; o código do erro (ex. SEGREGACAO_FUNCAO) segue em `erro`.
            const corpo = erro.getResponse();
            const bruto = typeof corpo === 'object' && corpo !== null ? (corpo as { codigo?: unknown }).codigo : undefined;
            const codigoErro = typeof bruto === 'string' ? bruto : undefined;
            throw new HttpException({ message: textoDe(erro), codigo, ...(codigoErro ? { erro: codigoErro } : {}) }, erro.getStatus());
          }
          throw erro;
        }
      }
    });
    for (const codigo of dto.codigos) this.emitirAcao(dto.acao, codigo);
    return Promise.all(dto.codigos.map((codigo) => this.obter(codigo)));
  }

  async validar(dto: CriarContaDto, _usuarioId: string) {
    const mensagens: string[] = [];
    await this.db.transaction(async (tx) => {
      try {
        await this.centroAtivo(tx, dto.centroCodigo);
      } catch (erro) {
        mensagens.push(textoDe(erro));
      }
      try {
        await this.paiValido(tx, dto.classificacao, dto.contaPaiCodigo, dto);
      } catch (erro) {
        mensagens.push(textoDe(erro));
      }
      const duplicada = await tx.select({ id: contasContabeis.id }).from(contasContabeis)
        .where(and(eq(contasContabeis.codigo, dto.codigo), isNull(contasContabeis.deletedAt))).limit(1);
      if (duplicada.length > 0) mensagens.push('Já existe conta com este código');
    });
    return { valido: mensagens.length === 0, mensagens };
  }

  async historico(codigo: string) {
    const [conta] = await this.db.select().from(contasContabeis)
      .where(and(eq(contasContabeis.codigo, codigo), isNull(contasContabeis.deletedAt))).limit(1);
    if (!conta) throw new NotFoundException('Conta não encontrada');
    const versoes = await this.db.select({ id: contaVersoes.id }).from(contaVersoes)
      .where(eq(contaVersoes.contaId, conta.id));
    if (versoes.length === 0) return [];
    const linhas = await this.db.select({
      quando: auditoria.createdAt,
      quem: usuarios.nome,
      acontecimento: auditoria.operacao,
      novos: auditoria.dadosNovos,
      justificativa: auditoria.justificativa,
    }).from(auditoria)
      .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(and(
        eq(auditoria.tabela, 'conta_versoes'),
        inArray(auditoria.registroId, versoes.map((versao) => versao.id)),
      ))
      .orderBy(asc(auditoria.createdAt), asc(auditoria.id));
    return linhas.map((linha) => ({
      quando: instante(linha.quando),
      quem: linha.quem ?? '',
      acontecimento: rotularAcontecimento(linha.acontecimento, linha.novos),
      justificativa: linha.justificativa ?? '',
    }));
  }

  private async travar(tx: Tx, codigo: string, numero: number) {
    const [conta] = await tx.select().from(contasContabeis)
      .where(and(eq(contasContabeis.codigo, codigo), isNull(contasContabeis.deletedAt)))
      .for('update').limit(1);
    if (!conta) throw new NotFoundException('Conta não encontrada');
    const versoes = await tx.select().from(contaVersoes)
      .where(and(eq(contaVersoes.contaId, conta.id), isNull(contaVersoes.deletedAt)));
    const maior = versoes.reduce((m, v) => Math.max(m, v.numero), 0);
    if (maior !== numero) throw new ConflictException('conflito concorrente');
    const atual = versoes.find((v) => v.numero === numero);
    if (!atual) throw new NotFoundException('Conta não encontrada');
    return { conta, atual, versoes };
  }

  private mudouClassificacao(
    atual: typeof contaVersoes.$inferSelect,
    dto: { natureza: string; grupo: string; classificacao: string },
    centroId: string,
  ) {
    return atual.natureza !== dto.natureza || atual.grupo !== dto.grupo
      || atual.classificacao !== dto.classificacao || atual.centroCustoId !== centroId;
  }

  private async revisarNaTx(
    tx: Tx,
    codigo: string,
    numero: number,
    justificativa: string,
    usuarioId: string,
    vigenciaInicio?: string,
    vigenciaFim?: string | null,
  ) {
    await this.travarHierarquia(tx);
    const { atual } = await this.travar(tx, codigo, numero);
    if (atual.situacao === 'SUSPENDED') throw new RegraContabilException('conta desativada');
    if (atual.situacao !== 'DRAFT' && atual.situacao !== 'REJECTED') {
      throw new RegraContabilException('Situação não permite esta transição');
    }
    if (!justificativa.trim()) throw new RegraContabilException('Informe justificativa para auditoria.');
    const inicio = vigenciaInicio ?? atual.vigenciaInicio;
    if (!dataCalendarioValida(inicio)) {
      throw new RegraContabilException('Início de vigência é obrigatório');
    }
    const fim = vigenciaFim === undefined ? atual.vigenciaFim : vigenciaFim;
    await this.exigirVigenciaCobreFilhas(tx, atual.contaId, { vigenciaInicio: inicio, vigenciaFim: fim });
    const nova = primeiroOuFalha(await tx.update(contaVersoes).set({
      situacao: 'REVIEW',
      vigenciaInicio: inicio,
      vigenciaFim: fim,
      justificativa,
      responsavelId: usuarioId,
    }).where(eq(contaVersoes.id, atual.id)).returning());
    await this.auditoria.registrar(tx, {
      tabela: 'conta_versoes', registroId: nova.id, operacao: 'UPDATE',
      modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: atual, dadosNovos: nova,
      justificativa,
    });
    return nova;
  }

  private async aprovarNaTx(tx: Tx, codigo: string, numero: number, justificativa: string, usuarioId: string) {
    await this.travarHierarquia(tx);
    const { atual } = await this.travar(tx, codigo, numero);
    if (atual.situacao === 'SUSPENDED') throw new RegraContabilException('conta desativada');
    if (atual.situacao !== 'REVIEW') throw new RegraContabilException('Situação não permite esta transição');
    if (!justificativa.trim()) throw new RegraContabilException('Informe justificativa para auditoria.');
    // AD-39: só o autor original da versão conta; quem editou ou revisou sem ser o autor pode aprovar.
    if (atual.autorId === usuarioId) {
      throw new UnprocessableEntityException({
        message: 'A aprovação deve ser feita por usuário diferente do autor da conta.',
        codigo: 'SEGREGACAO_FUNCAO',
      });
    }
    if (atual.contaPaiId) {
      await this.exigirPaiVigente(tx, atual.contaPaiId, atual);
      await this.recusarCiclo(tx, atual.contaId, atual.contaPaiId);
    } else if (atual.classificacao === 'analitica') {
      throw new RegraContabilException('Conta pai não encontrada');
    }
    await this.exigirClassificacaoCompativel(tx, atual.contaId, atual.classificacao);
    await this.exigirVigenciaCobreFilhas(tx, atual.contaId, atual);
    const nova = primeiroOuFalha(await tx.update(contaVersoes).set({
      situacao: 'APPROVED',
      justificativa,
      responsavelId: usuarioId,
    }).where(eq(contaVersoes.id, atual.id)).returning());
    await this.auditoria.registrar(tx, {
      tabela: 'conta_versoes', registroId: nova.id, operacao: 'UPDATE',
      modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: atual, dadosNovos: nova,
      justificativa,
    });
    return nova;
  }

  private async bloquearNaTx(tx: Tx, codigo: string, numero: number, justificativa: string, usuarioId: string) {
    await this.travarHierarquia(tx);
    const { atual, versoes } = await this.travar(tx, codigo, numero);
    if (atual.situacao === 'SUSPENDED') throw new ConflictException('conta desativada');
    const aberta = atual.situacao === 'DRAFT' || atual.situacao === 'REVIEW' ? atual : null;
    const alvo = aberta
      ? versoes.filter((v) => v.numero < aberta.numero).sort((a, b) => b.numero - a.numero)[0]
      : atual;
    if (!alvo || alvo.situacao !== 'APPROVED') throw new RegraContabilException('Situação não permite esta transição');
    if (!justificativa.trim()) throw new RegraContabilException('Informe justificativa para auditoria.');
    if (aberta) {
      // AD-25 item 3: o rascunho aberto é encerrado na mesma transação do bloqueio.
      const descartada = primeiroOuFalha(await tx.update(contaVersoes).set({ deletedAt: sql`now()` })
        .where(eq(contaVersoes.id, aberta.id)).returning());
      await this.auditoria.registrar(tx, {
        tabela: 'conta_versoes', registroId: aberta.id, operacao: 'DELETE',
        modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: aberta, dadosNovos: descartada,
        justificativa: `Rascunho descartado pelo bloqueio da conta. ${justificativa}`,
      });
    }
    const nova = primeiroOuFalha(await tx.update(contaVersoes).set({
      situacao: 'SUSPENDED',
      justificativa,
      responsavelId: usuarioId,
    }).where(eq(contaVersoes.id, alvo.id)).returning());
    await this.auditoria.registrar(tx, {
      tabela: 'conta_versoes', registroId: nova.id, operacao: 'UPDATE',
      modulo: 'contabilidade.plano', usuarioId, dadosAnteriores: alvo, dadosNovos: nova,
      justificativa,
    });
    return nova;
  }

  private async ciclo(tx: Tx, contaId: string, paiId: string) {
    let cursor: string | null = paiId;
    const vistos = new Set<string>();
    while (cursor) {
      if (cursor === contaId) return true;
      if (vistos.has(cursor)) return true;
      vistos.add(cursor);
      const versao = await ultimaVersaoDecidida(tx, cursor);
      cursor = versao?.contaPaiId ?? null;
    }
    return false;
  }

  /** Sem paginação (ficha e CSV); a listagem paginada roda em listar(), na transação de leitura. */
  private consultar(query: ListarPlanoQuery, codigoExato?: string) {
    return this.consultarEm(this.db, query, false, codigoExato);
  }

  private async consultarEm(executor: Banco | Tx, query: ListarPlanoQuery, paginar: boolean, codigoExato?: string) {
    const ultima = executor
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
      const termo = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
      const busca = or(
        sql`${contaVersoes.nome} ilike ${termo} escape '\\'`,
        sql`${contasContabeis.codigo} ilike ${termo} escape '\\'`,
        sql`${contaVersoes.grupo} ilike ${termo} escape '\\'`,
        sql`${centrosCusto.nome} ilike ${termo} escape '\\'`,
      );
      if (busca) filtros.push(busca);
    }
    const onde = and(...filtros);
    const coluna = colunaOrdem(query.ordenar);
    // codigo é único (uma linha por conta, a última versão): desempate estável para paginar sem repetir nem perder linha.
    const ordem = query.direcao === 'desc' ? [desc(coluna), desc(contasContabeis.codigo)] : [asc(coluna), asc(contasContabeis.codigo)];
    const base = executor
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
      .orderBy(...ordem);
    const linhas = paginar
      ? await base.limit(PAGINA).offset((query.pagina - 1) * PAGINA)
      : await base;
    const [contagem] = await executor
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

function rotularAcontecimento(operacao: string, novos: unknown): string {
  const dados = (novos ?? {}) as { situacao?: string; numero?: number };
  if (operacao === 'INSERT') return (dados.numero ?? 1) > 1 ? 'Nova versão criada' : 'Conta criada';
  if (operacao === 'DELETE') return 'Rascunho descartado';
  if (operacao === 'ACAO_MANUAL') return 'Lançamentos mapeados';
  if (dados.situacao === 'REVIEW') return 'Enviada para revisão';
  if (dados.situacao === 'APPROVED') return 'Aprovada';
  if (dados.situacao === 'SUSPENDED') return 'Bloqueada';
  return 'Rascunho editado';
}

function textoDe(erro: unknown): string {
  if (erro instanceof HttpException) {
    const corpo = erro.getResponse();
    if (typeof corpo === 'object' && corpo !== null && 'message' in corpo) {
      return String((corpo as { message: unknown }).message);
    }
    return erro.message;
  }
  return erro instanceof Error ? erro.message : 'Falha de validação';
}
