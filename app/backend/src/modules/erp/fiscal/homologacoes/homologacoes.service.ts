import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { montarPaginado } from '../../../../common/crud/paginacao';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  beneficiosFiscais,
  cenariosRegressao,
  classificacoesIbsCbs,
  empresas,
  enquadramentosFiscais,
  homologacoesRegras,
  ROTULOS_IBS_CST,
  ROTULOS_ICMS_CST,
  ROTULOS_IPI_CST,
  ROTULOS_PIS_CST,
  ROTULOS_SITUACAO_HOMOLOGACAO,
  regrasTributarias,
  simulacoesFiscais,
  usuarios,
} from '../../../../database/schema';
import {
  conflito,
  conflitoConcorrente,
  ehViolacaoUnica,
  exigirSegregacao,
  exigirVersao,
  regraViolada,
  type Tx,
} from '../empresas/fiscal-comum';
import type { CorpoDecisaoDto } from './dto/homologacao.dto';
import { recusarDecisao, type SituacaoHomologacao } from './homologacao-transicao';
import { formatarPercentualPtBr } from '../regras/percentual';
import { RegrasTributariasService } from '../regras/regras.service';
import { rotuloCompetencia } from '../simulacoes/decimal-memoria';
import { EVENTOS } from '../../../../realtime/events/eventos';
import type { CriarHomologacaoDto, ListarHomologacoesQuery, VincularCenarioDto } from './dto/homologacao.dto';

type Db = NodePgDatabase<typeof schema>;
type Linha = typeof homologacoesRegras.$inferSelect;
type Situacao = keyof typeof ROTULOS_SITUACAO_HOMOLOGACAO;

const MODULO = 'fiscal.homologacoes';
const MSG_ABERTA = 'Já existe homologação em aberto ou publicada para esta versão.';

function razao(valor: string): string {
  const [inteiro, frac = ''] = valor.split('.');
  return `${inteiro}.${(frac + '0000').slice(0, 4)}`;
}

/** `aaaa-MM-dd` → `dd/MM/aaaa`, o formato das telas. */
function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function celula(original: string): string {
  // Injeção de fórmula (OWASP): texto iniciado por = + - @ tab ou CR vira literal no Excel.
  const valor = /^[=+\-@\t\r]/.test(original) ? `'${original}` : original;
  if (/[;"\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

@Injectable()
export class HomologacoesService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventEmitter2,
    private readonly regras: RegrasTributariasService,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async listar(query: ListarHomologacoesQuery) {
    const autor = alias(usuarios, 'homologacao_lista_autor');
    const aprovador = alias(usuarios, 'homologacao_lista_aprovador');
    const where = this.whereLista(query);
    const totalLinha = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(homologacoesRegras)
      .innerJoin(regrasTributarias, eq(regrasTributarias.id, homologacoesRegras.regraId))
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, regrasTributarias.enquadramentoId))
      .where(where);
    const linhas = await this.db
      .select({
        id: homologacoesRegras.id,
        enquadramento: enquadramentosFiscais.codigo,
        vigenciaInicio: regrasTributarias.vigenciaInicio,
        situacao: homologacoesRegras.situacao,
        usuario: autor.nome,
        aprovador: aprovador.nome,
        descricao: homologacoesRegras.descricao,
      })
      .from(homologacoesRegras)
      .innerJoin(regrasTributarias, eq(regrasTributarias.id, homologacoesRegras.regraId))
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, regrasTributarias.enquadramentoId))
      .leftJoin(autor, eq(autor.id, regrasTributarias.submetidoPorId))
      .leftJoin(aprovador, eq(aprovador.id, homologacoesRegras.aprovadoPorId))
      .where(where)
      .orderBy(...this.ordem(query, autor, aprovador))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const data = linhas.map((linha) => ({
      id: linha.id,
      enquadramento: linha.enquadramento,
      vigenciaInicio: linha.vigenciaInicio,
      situacao: ROTULOS_SITUACAO_HOMOLOGACAO[linha.situacao as Situacao],
      usuario: linha.usuario ?? '',
      aprovador: linha.aprovador ?? '',
      descricao: linha.descricao,
    }));
    return montarPaginado(data, Number(totalLinha[0]?.total ?? 0), query);
  }

  async contagens(query: ListarHomologacoesQuery) {
    const [linha] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        emRevisao: sql<number>`count(*) filter (where ${homologacoesRegras.situacao} = 'EM_REVISAO')::int`,
        aprovadas: sql<number>`count(*) filter (where ${homologacoesRegras.situacao} = 'APROVADA')::int`,
        rejeitadas: sql<number>`count(*) filter (where ${homologacoesRegras.situacao} = 'REJEITADA')::int`,
        publicadas: sql<number>`count(*) filter (where ${homologacoesRegras.situacao} = 'PUBLICADA')::int`,
      })
      .from(homologacoesRegras)
      .innerJoin(regrasTributarias, eq(regrasTributarias.id, homologacoesRegras.regraId))
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, regrasTributarias.enquadramentoId))
      .where(this.whereLista(query));
    return {
      total: Number(linha?.total ?? 0),
      emRevisao: Number(linha?.emRevisao ?? 0),
      aprovadas: Number(linha?.aprovadas ?? 0),
      rejeitadas: Number(linha?.rejeitadas ?? 0),
      publicadas: Number(linha?.publicadas ?? 0),
    };
  }

  async exportar(query: ListarHomologacoesQuery): Promise<string> {
    const autor = alias(usuarios, 'homologacao_csv_autor');
    const aprovador = alias(usuarios, 'homologacao_csv_aprovador');
    const linhas = await this.db
      .select({
        enquadramento: enquadramentosFiscais.codigo,
        vigenciaInicio: regrasTributarias.vigenciaInicio,
        situacao: homologacoesRegras.situacao,
        usuario: autor.nome,
        aprovador: aprovador.nome,
        descricao: homologacoesRegras.descricao,
      })
      .from(homologacoesRegras)
      .innerJoin(regrasTributarias, eq(regrasTributarias.id, homologacoesRegras.regraId))
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, regrasTributarias.enquadramentoId))
      .leftJoin(autor, eq(autor.id, regrasTributarias.submetidoPorId))
      .leftJoin(aprovador, eq(aprovador.id, homologacoesRegras.aprovadoPorId))
      .where(this.whereLista(query))
      .orderBy(...this.ordem(query, autor, aprovador));
    const cabecalho = 'Enquadramento fiscal;Início de vigência;Situação;Usuário;Responsável pela aprovação;Descrição';
    const corpo = linhas.map((linha) => [
      linha.enquadramento,
      dataBr(linha.vigenciaInicio),
      ROTULOS_SITUACAO_HOMOLOGACAO[linha.situacao as Situacao],
      linha.usuario ?? '',
      linha.aprovador ?? '',
      linha.descricao,
    ].map(celula).join(';'));
    return `\uFEFF${[cabecalho, ...corpo].join('\r\n')}`;
  }

  async detalhar(id: string) {
    const autor = alias(usuarios, 'homologacao_detalhe_autor');
    const aprovador = alias(usuarios, 'homologacao_detalhe_aprovador');
    const responsavel = alias(usuarios, 'homologacao_detalhe_responsavel');
    const [linha] = await this.db
      .select({
        id: homologacoesRegras.id,
        regraId: homologacoesRegras.regraId,
        codigo: homologacoesRegras.codigo,
        versao: homologacoesRegras.versao,
        descricao: homologacoesRegras.descricao,
        situacao: homologacoesRegras.situacao,
        numeroVersao: regrasTributarias.numeroVersao,
        codigoRegra: regrasTributarias.codigo,
        vigenciaInicio: regrasTributarias.vigenciaInicio,
        vigenciaFim: regrasTributarias.vigenciaFim,
        enquadramento: enquadramentosFiscais.codigo,
        empresa: empresas.razaoSocial,
        usuario: autor.nome,
        aprovador: aprovador.nome,
        responsavel: responsavel.nome,
        criadoEm: homologacoesRegras.createdAt,
        atualizadoEm: homologacoesRegras.updatedAt,
      })
      .from(homologacoesRegras)
      .innerJoin(regrasTributarias, eq(regrasTributarias.id, homologacoesRegras.regraId))
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, regrasTributarias.enquadramentoId))
      .innerJoin(empresas, eq(empresas.id, enquadramentosFiscais.empresaId))
      .leftJoin(autor, eq(autor.id, regrasTributarias.submetidoPorId))
      .leftJoin(aprovador, eq(aprovador.id, homologacoesRegras.aprovadoPorId))
      .innerJoin(responsavel, eq(responsavel.id, homologacoesRegras.atualizadoPorId))
      .where(and(eq(homologacoesRegras.id, id), isNull(homologacoesRegras.deletedAt)));
    if (!linha) throw new NotFoundException('Homologação não encontrada');
    const cenarios = await this.db
      .select({
        codigo: simulacoesFiscais.codigo,
        numeroVersao: simulacoesFiscais.numeroVersao,
        competencia: simulacoesFiscais.competencia,
      })
      .from(cenariosRegressao)
      .innerJoin(simulacoesFiscais, eq(simulacoesFiscais.id, cenariosRegressao.simulacaoId))
      .where(and(eq(cenariosRegressao.homologacaoId, id), isNull(cenariosRegressao.deletedAt)))
      .orderBy(asc(simulacoesFiscais.codigo), asc(simulacoesFiscais.numeroVersao), asc(cenariosRegressao.id));
    return {
      ...linha,
      situacao: ROTULOS_SITUACAO_HOMOLOGACAO[linha.situacao as Situacao],
      usuario: linha.usuario ?? '',
      aprovador: linha.aprovador ?? '',
      vigenciaFim: linha.vigenciaFim,
      cenarios: cenarios.map((cenario) => ({
        codigo: cenario.codigo,
        numeroVersao: cenario.numeroVersao,
        competenciaRotulo: rotuloCompetencia(cenario.competencia),
      })),
    };
  }

  async diff(id: string) {
    const homologacao = await this.obter(this.db, id);
    const [regra] = await this.db
      .select({
        id: regrasTributarias.id,
        origemVersaoId: regrasTributarias.origemVersaoId,
      })
      .from(regrasTributarias)
      .where(and(eq(regrasTributarias.id, homologacao.regraId), isNull(regrasTributarias.deletedAt)));
    if (!regra) throw new NotFoundException('Regra tributária não encontrada');
    if (!regra.origemVersaoId) return this.diffSemOrigem(regra.id);
    return this.regras.comparar(regra.origemVersaoId, regra.id);
  }

  async preCondicoes(id: string) {
    const homologacao = await this.obter(this.db, id);
    const [regra] = await this.db
      .select({
        situacao: regrasTributarias.situacao,
        deletedAt: regrasTributarias.deletedAt,
        submetidoPorId: regrasTributarias.submetidoPorId,
      })
      .from(regrasTributarias)
      .where(eq(regrasTributarias.id, homologacao.regraId));
    const vinculos = await this.db
      .select({ id: cenariosRegressao.id })
      .from(cenariosRegressao)
      .where(and(eq(cenariosRegressao.homologacaoId, id), isNull(cenariosRegressao.deletedAt)));
    return [
      {
        codigo: 'REGRA_APROVADA',
        atendida: regra?.situacao === 'APROVADA' && regra.deletedAt == null,
        provisoria: false,
      },
      { codigo: 'AUTOR_IDENTIFICADO', atendida: Boolean(regra?.submetidoPorId), provisoria: false },
      { codigo: 'CENARIO_REGRESSAO', atendida: vinculos.length > 0, provisoria: false },
      { codigo: 'DATAS_COMERCIAL_FISCAL_EFETIVA', atendida: false, provisoria: true },
      {
        codigo: 'DUPLA_APROVACAO',
        atendida: false,
        provisoria: true,
        texto: 'Um aprovador diferente de quem submeteu a regra registra a decisão. O quórum numérico permanece provisório.',
      },
      { codigo: 'PERFIS_ALEM_ADMINISTRADOR', atendida: false, provisoria: true },
    ];
  }

  async historico(id: string) {
    await this.obter(this.db, id);
    const cenarios = await this.db
      .select({ id: cenariosRegressao.id })
      .from(cenariosRegressao)
      .where(eq(cenariosRegressao.homologacaoId, id));
    const autor = alias(usuarios, 'homologacao_historico_autor');
    const idsCenario = cenarios.map((cenario) => cenario.id);
    const linhas = await this.db
      .select({
        operacao: schema.auditoria.operacao,
        usuarioNome: autor.nome,
        criadoEm: schema.auditoria.createdAt,
        justificativa: schema.auditoria.justificativa,
        dadosNovos: schema.auditoria.dadosNovos,
        dadosAnteriores: schema.auditoria.dadosAnteriores,
      })
      .from(schema.auditoria)
      .leftJoin(autor, eq(autor.id, schema.auditoria.usuarioId))
      .where(or(
        and(eq(schema.auditoria.tabela, 'homologacoes_regras'), eq(schema.auditoria.registroId, id)),
        idsCenario.length > 0
          ? and(eq(schema.auditoria.tabela, 'cenarios_regressao'), inArray(schema.auditoria.registroId, idsCenario))
          : undefined,
      ))
      .orderBy(schema.auditoria.createdAt, schema.auditoria.id);
    return linhas.map((linha) => {
      const novos = (linha.dadosNovos ?? {}) as Record<string, unknown>;
      const anteriores = (linha.dadosAnteriores ?? {}) as Record<string, unknown>;
      return {
        operacao: linha.operacao,
        situacaoAnterior: anteriores.situacao ?? null,
        situacaoNova: novos.situacao ?? null,
        usuarioNome: linha.usuarioNome,
        criadoEm: linha.criadoEm,
        justificativa: linha.justificativa,
        resumo: novos.resumo ?? null,
        versao: novos.versao ?? null,
      };
    });
  }

  async abrir(dto: CriarHomologacaoDto, usuarioId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const gravado = await this.aplicarAbrir(tx, dto, usuarioId);
      await this.auditoria.registrar(tx, gravado.auditoria);
      return gravado;
    });
    this.eventos.emit(EVENTOS.HOMOLOGACAO_REGRA_ALTERADA, resultado.payload);
    return resultado.corpo;
  }

  async aprovar(id: string, dto: CorpoDecisaoDto, usuarioId: string) {
    return this.decidir(id, dto, usuarioId, 'aprovar');
  }

  async rejeitar(id: string, dto: CorpoDecisaoDto, usuarioId: string) {
    return this.decidir(id, dto, usuarioId, 'rejeitar');
  }

  async vincular(id: string, dto: VincularCenarioDto, usuarioId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const gravado = await this.aplicarVinculo(tx, id, dto, usuarioId);
      await this.auditoria.registrar(tx, gravado.auditoria);
      return gravado;
    });
    this.eventos.emit(EVENTOS.HOMOLOGACAO_REGRA_ALTERADA, resultado.payload);
    return this.detalhar(id);
  }

  async publicar(id: string, dto: CorpoDecisaoDto, usuarioId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const gravado = await this.aplicarPublicacao(tx, id, dto, usuarioId);
      await this.auditoria.registrar(tx, gravado.auditoria);
      return gravado;
    });
    this.eventos.emit(EVENTOS.HOMOLOGACAO_REGRA_ALTERADA, resultado.payload);
    return this.detalhar(id);
  }

  private async decidir(id: string, dto: CorpoDecisaoDto, usuarioId: string, acao: 'aprovar' | 'rejeitar') {
    const resultado = await this.db.transaction(async (tx) => {
      const gravado = await this.aplicarDecisao(tx, id, dto, usuarioId, acao);
      await this.auditoria.registrar(tx, gravado.auditoria);
      return gravado;
    });
    this.eventos.emit(EVENTOS.HOMOLOGACAO_REGRA_ALTERADA, resultado.payload);
    return this.detalhar(id);
  }

  private async aplicarAbrir(tx: Tx, dto: CriarHomologacaoDto, usuarioId: string) {
    const regra = await this.travarRegraAprovada(tx, dto.regraId);
    const aberta = await tx
      .select({ id: homologacoesRegras.id })
      .from(homologacoesRegras)
      .where(and(
        eq(homologacoesRegras.regraId, regra.id),
        isNull(homologacoesRegras.deletedAt),
        sql`${homologacoesRegras.situacao} IN ('EM_REVISAO','APROVADA','PUBLICADA')`,
      ));
    if (aberta.length > 0) conflito('HOMOLOGACAO_ABERTA', MSG_ABERTA);
    const linha = await this.inserirComCodigo(tx, {
      regraId: regra.id,
      descricao: dto.descricao,
      situacao: 'EM_REVISAO',
      justificativa: dto.justificativa,
      criadoPorId: usuarioId,
      atualizadoPorId: usuarioId,
    });
    return {
      corpo: {
        id: linha.id,
        regraId: linha.regraId,
        codigo: linha.codigo,
        versao: linha.versao,
        situacao: ROTULOS_SITUACAO_HOMOLOGACAO.EM_REVISAO,
        descricao: linha.descricao,
      },
      payload: {
        homologacaoId: linha.id,
        regraId: linha.regraId,
        codigo: linha.codigo,
        acao: 'revisao_aberta' as const,
        situacao: linha.situacao,
      },
      auditoria: {
        tabela: 'homologacoes_regras',
        registroId: linha.id,
        operacao: 'INSERT' as const,
        modulo: MODULO,
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: { situacao: linha.situacao, versao: linha.versao, resumo: 'Revisão aberta' },
        justificativa: dto.justificativa,
      },
    };
  }

  private async aplicarDecisao(
    tx: Tx,
    id: string,
    dto: CorpoDecisaoDto,
    usuarioId: string,
    acao: 'aprovar' | 'rejeitar',
  ) {
    const atual = await this.obterBloqueado(tx, id);
    exigirVersao(atual.versao, dto.versao);
    recusarDecisao(atual.situacao as SituacaoHomologacao, acao);
    // AD-28: rejeitar encerra a homologação mesmo sem regra vigente; aprovar exige regra APROVADA.
    const regra = await this.travarRegraAprovada(tx, atual.regraId, acao === 'aprovar');
    exigirSegregacao(regra.submetidoPorId, usuarioId);
    const agora = new Date();
    const resumo = acao === 'aprovar' ? 'Alteração aprovada' : 'Alteração rejeitada';
    const patch = acao === 'aprovar'
      ? { situacao: 'APROVADA' as const, aprovadoPorId: usuarioId, aprovadoEm: agora }
      : { situacao: 'REJEITADA' as const, rejeitadoPorId: usuarioId, rejeitadoEm: agora };
    const [linha] = await tx.update(homologacoesRegras).set({
      ...patch,
      justificativa: dto.justificativa,
      versao: atual.versao + 1,
      atualizadoPorId: usuarioId,
      updatedAt: agora,
    }).where(eq(homologacoesRegras.id, id)).returning();
    if (!linha) throw new NotFoundException('Homologação não encontrada');
    return {
      payload: {
        homologacaoId: linha.id,
        regraId: linha.regraId,
        codigo: linha.codigo,
        acao: acao === 'aprovar' ? 'aprovada' as const : 'rejeitada' as const,
        situacao: linha.situacao,
      },
      auditoria: {
        tabela: 'homologacoes_regras',
        registroId: linha.id,
        operacao: 'UPDATE' as const,
        modulo: MODULO,
        usuarioId,
        dadosAnteriores: { situacao: atual.situacao, versao: atual.versao },
        dadosNovos: { situacao: linha.situacao, versao: linha.versao, resumo },
        justificativa: dto.justificativa,
      },
    };
  }

  private async aplicarVinculo(tx: Tx, id: string, dto: VincularCenarioDto, usuarioId: string) {
    const atual = await this.obterBloqueado(tx, id);
    exigirVersao(atual.versao, dto.versao);
    recusarDecisao(atual.situacao as SituacaoHomologacao, 'vincular');
    await this.travarRegraAprovada(tx, atual.regraId);
    const [simulacao] = await tx
      .select()
      .from(simulacoesFiscais)
      .where(and(eq(simulacoesFiscais.id, dto.simulacaoId), isNull(simulacoesFiscais.deletedAt)));
    if (!simulacao || simulacao.situacao !== 'CALCULADA' || simulacao.regraId !== atual.regraId) {
      regraViolada(
        'CENARIO_REGRA_DIVERGENTE',
        'O cenário de regressão precisa ser uma memória calculada desta versão da regra.',
      );
    }
    const agora = new Date();
    let cenario: typeof cenariosRegressao.$inferSelect | undefined;
    try {
      [cenario] = await tx.insert(cenariosRegressao).values({
        homologacaoId: atual.id,
        simulacaoId: simulacao.id,
        criadoPorId: usuarioId,
        atualizadoPorId: usuarioId,
      }).returning();
    } catch (err) {
      if (ehViolacaoUnica(err, 'uq_cenarios_homologacao_simulacao')) {
        conflito('CENARIO_JA_VINCULADO', 'Este cenário já está vinculado a esta homologação.');
      }
      throw err;
    }
    if (!cenario) throw new Error('Falha ao gravar cenário de regressão');
    const [linha] = await tx.update(homologacoesRegras).set({
      justificativa: dto.justificativa,
      versao: atual.versao + 1,
      atualizadoPorId: usuarioId,
      updatedAt: agora,
    }).where(eq(homologacoesRegras.id, id)).returning();
    if (!linha) throw new NotFoundException('Homologação não encontrada');
    return {
      payload: {
        homologacaoId: linha.id,
        regraId: linha.regraId,
        codigo: linha.codigo,
        acao: 'cenario_vinculado' as const,
        situacao: linha.situacao,
      },
      auditoria: {
        tabela: 'cenarios_regressao',
        registroId: cenario.id,
        operacao: 'INSERT' as const,
        modulo: MODULO,
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: { resumo: 'Cenário de regressão vinculado', versao: cenario.versao },
        justificativa: dto.justificativa,
      },
    };
  }

  private async aplicarPublicacao(tx: Tx, id: string, dto: CorpoDecisaoDto, usuarioId: string) {
    const atual = await this.obterBloqueado(tx, id);
    exigirVersao(atual.versao, dto.versao);
    recusarDecisao(atual.situacao as SituacaoHomologacao, 'publicar');
    const regra = await this.travarRegraAprovada(tx, atual.regraId);
    exigirSegregacao(regra.submetidoPorId, usuarioId);
    const vinculos = await tx
      .select({ id: cenariosRegressao.id })
      .from(cenariosRegressao)
      .where(and(eq(cenariosRegressao.homologacaoId, id), isNull(cenariosRegressao.deletedAt)));
    if (vinculos.length === 0) {
      regraViolada('CENARIO_REGRESSAO_AUSENTE', 'A publicação exige ao menos um cenário de regressão.');
    }
    const agora = new Date();
    const [linha] = await tx.update(homologacoesRegras).set({
      situacao: 'PUBLICADA',
      publicadoPorId: usuarioId,
      publicadoEm: agora,
      justificativa: dto.justificativa,
      versao: atual.versao + 1,
      atualizadoPorId: usuarioId,
      updatedAt: agora,
    }).where(eq(homologacoesRegras.id, id)).returning();
    if (!linha) throw new NotFoundException('Homologação não encontrada');
    return {
      payload: {
        homologacaoId: linha.id,
        regraId: linha.regraId,
        codigo: linha.codigo,
        acao: 'publicada' as const,
        situacao: linha.situacao,
      },
      auditoria: {
        tabela: 'homologacoes_regras',
        registroId: linha.id,
        operacao: 'UPDATE' as const,
        modulo: MODULO,
        usuarioId,
        dadosAnteriores: { situacao: atual.situacao, versao: atual.versao },
        dadosNovos: { situacao: linha.situacao, versao: linha.versao, resumo: 'Alteração publicada' },
        justificativa: dto.justificativa,
      },
    };
  }

  private async inserirComCodigo(
    tx: Tx,
    valores: Omit<typeof homologacoesRegras.$inferInsert, 'codigo'>,
  ): Promise<Linha> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('homologacoes_regras.codigo'))`);
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      await tx.execute(sql`SAVEPOINT homologacao_codigo`);
      const gerado = await tx.execute(sql`
        SELECT (COALESCE(MAX(codigo::bigint), 0) + 1)::text AS proximo FROM homologacoes_regras
      `);
      const codigo = String((gerado.rows[0] as { proximo: string }).proximo);
      try {
        const [linha] = await tx.insert(homologacoesRegras).values({ ...valores, codigo }).returning();
        await tx.execute(sql`RELEASE SAVEPOINT homologacao_codigo`);
        if (!linha) throw new Error('Falha ao gravar homologação');
        return linha;
      } catch (err) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT homologacao_codigo`);
        if (ehViolacaoUnica(err, 'uq_homologacoes_codigo') && tentativa === 1) continue;
        if (ehViolacaoUnica(err, 'uq_homologacoes_codigo')) conflitoConcorrente();
        if (ehViolacaoUnica(err, 'uq_homologacoes_regra_aberta')) conflito('HOMOLOGACAO_ABERTA', MSG_ABERTA);
        throw err;
      }
    }
    conflitoConcorrente();
  }

  /** Lê a regra com FOR SHARE: aposentar (FOR UPDATE) espera esta transação e vice-versa. */
  private async travarRegraAprovada(tx: Tx, regraId: string, exigirAprovada = true) {
    const [regra] = await tx.select().from(regrasTributarias)
      .where(eq(regrasTributarias.id, regraId)).for('share');
    if (!regra) throw new NotFoundException('Regra tributária não encontrada');
    if (exigirAprovada && (regra.situacao !== 'APROVADA' || regra.deletedAt)) {
      regraViolada('REGRA_NAO_APROVADA', 'A homologação exige uma versão de regra já aprovada.');
    }
    return regra;
  }

  private async obterBloqueado(tx: Tx, id: string): Promise<Linha> {
    const [linha] = await tx.select().from(homologacoesRegras).where(and(
      eq(homologacoesRegras.id, id),
      isNull(homologacoesRegras.deletedAt),
    )).for('no key update');
    if (!linha) throw new NotFoundException('Homologação não encontrada');
    return linha;
  }

  private async obter(tx: Tx, id: string): Promise<Linha> {
    const [linha] = await tx.select().from(homologacoesRegras).where(and(
      eq(homologacoesRegras.id, id),
      isNull(homologacoesRegras.deletedAt),
    ));
    if (!linha) throw new NotFoundException('Homologação não encontrada');
    return linha;
  }

  private whereLista(query: ListarHomologacoesQuery) {
    const termo = query.search?.replace(/[%_]/g, '');
    return and(
      isNull(homologacoesRegras.deletedAt),
      query.situacao ? eq(homologacoesRegras.situacao, query.situacao) : undefined,
      termo
        ? or(
          ilike(homologacoesRegras.descricao, `%${termo}%`),
          ilike(homologacoesRegras.codigo, `%${termo}%`),
          ilike(enquadramentosFiscais.codigo, `%${termo}%`),
        )
        : undefined,
    );
  }

  private ordem(
    query: ListarHomologacoesQuery,
    autor: ReturnType<typeof alias<typeof usuarios, string>>,
    aprovador: ReturnType<typeof alias<typeof usuarios, string>>,
  ) {
    const direcao = query.dir === 'desc' ? desc : asc;
    const coluna = {
      enquadramento: sql`${enquadramentosFiscais.codigo}::bigint`,
      vigenciaInicio: regrasTributarias.vigenciaInicio,
      usuario: autor.nome,
      aprovador: aprovador.nome,
      descricao: homologacoesRegras.descricao,
    }[query.sort];
    return [direcao(coluna), direcao(homologacoesRegras.id)];
  }

  private async diffSemOrigem(regraId: string) {
    const [linha] = await this.db
      .select({
        codigo: regrasTributarias.codigo,
        numeroVersao: regrasTributarias.numeroVersao,
        icmsCst: regrasTributarias.icmsCst,
        pRedBc: regrasTributarias.pRedBc,
        pIcms: regrasTributarias.pIcms,
        ipiCst: regrasTributarias.ipiCst,
        pisCst: regrasTributarias.pisCst,
        ibsCst: regrasTributarias.ibsCst,
        vigenciaInicio: regrasTributarias.vigenciaInicio,
        vigenciaFim: regrasTributarias.vigenciaFim,
        beneficio: beneficiosFiscais.descricao,
        classificacao: classificacoesIbsCbs.descricao,
      })
      .from(regrasTributarias)
      .innerJoin(beneficiosFiscais, eq(beneficiosFiscais.id, regrasTributarias.beneficioFiscalId))
      .innerJoin(classificacoesIbsCbs, eq(classificacoesIbsCbs.id, regrasTributarias.classificacaoIbsCbsId))
      .where(and(eq(regrasTributarias.id, regraId), isNull(regrasTributarias.deletedAt)));
    if (!linha) throw new NotFoundException('Regra tributária não encontrada');
    const campos = [
      ['Tratamento ICMS', ROTULOS_ICMS_CST[linha.icmsCst as keyof typeof ROTULOS_ICMS_CST]],
      ['Redução de base do ICMS (%)', formatarPercentualPtBr(razao(linha.pRedBc))],
      ['Alíquota (%)', formatarPercentualPtBr(razao(linha.pIcms))],
      ['Benefício fiscal', linha.beneficio],
      ['Tratamento IPI', ROTULOS_IPI_CST[linha.ipiCst as keyof typeof ROTULOS_IPI_CST]],
      ['Tratamento PIS/COFINS', ROTULOS_PIS_CST[linha.pisCst as keyof typeof ROTULOS_PIS_CST]],
      ['Tratamento IBS/CBS', ROTULOS_IBS_CST[linha.ibsCst as keyof typeof ROTULOS_IBS_CST]],
      ['Classificação IBS/CBS', linha.classificacao],
      ['Início de vigência', linha.vigenciaInicio],
      ['Fim de vigência', linha.vigenciaFim ?? 'Sem fim de vigência'],
    ] as const;
    return {
      codigo: linha.codigo,
      numeroVersaoAntes: null,
      numeroVersaoDepois: linha.numeroVersao,
      diferencas: campos.map(([campo, depois]) => ({ campo, antes: null, depois })),
    };
  }

}
