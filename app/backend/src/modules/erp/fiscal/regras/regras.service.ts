import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { montarPaginado } from '../../../../common/crud/paginacao';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  beneficiosFiscais,
  classificacoesIbsCbs,
  empresas,
  enquadramentosFiscais,
  operacoes,
  regrasTributarias,
  ROTULOS_IBS_CST,
  ROTULOS_ICMS_CST,
  ROTULOS_IPI_CST,
  ROTULOS_PIS_CST,
  ROTULOS_SITUACAO_REGRA,
  usuarios,
} from '../../../../database/schema';
import { cfops } from '../../../../database/schema/fiscal-enquadramentos.schema';
import { intervalosSobrepoem } from '../enquadramentos/enquadramento-criterio';
import {
  conflito,
  ehViolacaoUnica,
  exigirSegregacao,
  exigirVersao,
  regraViolada,
  transicaoInvalida,
  type Tx,
} from '../empresas/fiscal-comum';
import type { AcaoRegraDto, AtualizarRegraDto, CriarRegraDto, ListarRegrasQuery, NovaVersaoDto } from './dto/regra.dto';
import { formatarPercentualPtBr } from './percentual';
import { recusarAcao, recusarEdicao, type SituacaoRegra } from './regra-transicao';

type Db = NodePgDatabase<typeof schema>;
type Linha = typeof regrasTributarias.$inferSelect;

const MODULO = 'fiscal.regras';

export async function travarEnquadramento(tx: Tx, id: string) {
  const [linha] = await tx
    .select()
    .from(enquadramentosFiscais)
    .where(and(eq(enquadramentosFiscais.id, id), isNull(enquadramentosFiscais.deletedAt)))
    .for('no key update');
  if (!linha) throw new NotFoundException('Enquadramento fiscal não encontrado');
  if (linha.situacao !== 'ATIVA') {
    regraViolada('ENQUADRAMENTO_INDISPONIVEL', 'O enquadramento fiscal não está ativo.');
  }
  return linha;
}

function razao(valor: string): string {
  const [inteiro, frac = ''] = valor.split('.');
  return `${inteiro}.${(frac + '0000').slice(0, 4)}`;
}

@Injectable()
export class RegrasTributariasService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async listar(query: ListarRegrasQuery) {
    const where = and(
      isNull(regrasTributarias.deletedAt),
      query.cfopId ? eq(enquadramentosFiscais.cfopId, query.cfopId) : undefined,
    );
    const totalLinha = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(regrasTributarias)
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, regrasTributarias.enquadramentoId))
      .where(where);
    const linhas = await this.db
      .select({
        id: regrasTributarias.id,
        enquadramentoFiscal: enquadramentosFiscais.codigo,
        operacaoFiscal: cfops.codigo,
        beneficioFiscal: beneficiosFiscais.descricao,
        classificacaoIbsCbs: classificacoesIbsCbs.descricao,
        operacao: operacoes.rotulo,
        icmsCst: regrasTributarias.icmsCst,
      })
      .from(regrasTributarias)
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, regrasTributarias.enquadramentoId))
      .innerJoin(cfops, eq(cfops.id, enquadramentosFiscais.cfopId))
      .innerJoin(operacoes, eq(operacoes.id, enquadramentosFiscais.operacaoId))
      .innerJoin(beneficiosFiscais, eq(beneficiosFiscais.id, regrasTributarias.beneficioFiscalId))
      .innerJoin(classificacoesIbsCbs, eq(classificacoesIbsCbs.id, regrasTributarias.classificacaoIbsCbsId))
      .where(where)
      .orderBy(enquadramentosFiscais.codigo)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const data = linhas.map((linha) => ({
      id: linha.id,
      enquadramentoFiscal: linha.enquadramentoFiscal,
      operacaoFiscal: linha.operacaoFiscal,
      beneficioFiscal: linha.beneficioFiscal,
      classificacaoIbsCbs: linha.classificacaoIbsCbs,
      operacao: linha.operacao,
      tratamentoIcms: ROTULOS_ICMS_CST[linha.icmsCst as keyof typeof ROTULOS_ICMS_CST],
    }));
    return montarPaginado(data, totalLinha[0]?.total ?? 0, query);
  }

  async detalhar(id: string) {
    const responsavel = alias(usuarios, 'regra_responsavel');
    const autor = alias(usuarios, 'regra_autor');
    const aprovador = alias(usuarios, 'regra_aprovador');
    const [linha] = await this.db
      .select({
        id: regrasTributarias.id,
        codigo: regrasTributarias.codigo,
        numeroVersao: regrasTributarias.numeroVersao,
        versao: regrasTributarias.versao,
        enquadramentoId: regrasTributarias.enquadramentoId,
        operacaoId: enquadramentosFiscais.operacaoId,
        cfopId: enquadramentosFiscais.cfopId,
        icmsCst: regrasTributarias.icmsCst,
        pRedBc: regrasTributarias.pRedBc,
        pIcms: regrasTributarias.pIcms,
        beneficioFiscalId: regrasTributarias.beneficioFiscalId,
        ipiCst: regrasTributarias.ipiCst,
        pisCst: regrasTributarias.pisCst,
        ibsCst: regrasTributarias.ibsCst,
        classificacaoIbsCbsId: regrasTributarias.classificacaoIbsCbsId,
        vigenciaInicio: regrasTributarias.vigenciaInicio,
        vigenciaFim: regrasTributarias.vigenciaFim,
        situacao: regrasTributarias.situacao,
        empresaNome: empresas.razaoSocial,
        responsavel: responsavel.nome,
        criadoEm: regrasTributarias.createdAt,
        atualizadoEm: regrasTributarias.updatedAt,
        autor: autor.nome,
        aprovador: aprovador.nome,
      })
      .from(regrasTributarias)
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, regrasTributarias.enquadramentoId))
      .innerJoin(empresas, eq(empresas.id, enquadramentosFiscais.empresaId))
      .innerJoin(responsavel, eq(responsavel.id, regrasTributarias.atualizadoPorId))
      .leftJoin(autor, eq(autor.id, regrasTributarias.submetidoPorId))
      .leftJoin(aprovador, eq(aprovador.id, regrasTributarias.aprovadoPorId))
      .where(and(eq(regrasTributarias.id, id), isNull(regrasTributarias.deletedAt)));
    if (!linha) throw new NotFoundException('Regra tributária não encontrada');
    return {
      ...linha,
      pRedBc: razao(linha.pRedBc),
      pIcms: razao(linha.pIcms),
      situacao: ROTULOS_SITUACAO_REGRA[linha.situacao as SituacaoRegra],
      tratamentoIcms: ROTULOS_ICMS_CST[linha.icmsCst as keyof typeof ROTULOS_ICMS_CST],
      autor: linha.autor ?? null,
      aprovador: linha.aprovador ?? null,
    };
  }

  async comparar(id: string, com: string) {
    const antes = await this.carregarComparavel(id);
    const depois = await this.carregarComparavel(com);
    if (antes.codigo !== depois.codigo) {
      regraViolada('REGRAS_DISTINTAS', 'A comparação exige duas versões do mesmo código.');
    }
    const campos = [
      ['Tratamento ICMS', antes.tratamentoIcms, depois.tratamentoIcms],
      ['Redução de base do ICMS (%)', formatarPercentualPtBr(razao(antes.pRedBc)), formatarPercentualPtBr(razao(depois.pRedBc))],
      ['Alíquota (%)', formatarPercentualPtBr(razao(antes.pIcms)), formatarPercentualPtBr(razao(depois.pIcms))],
      ['Benefício fiscal', antes.beneficio, depois.beneficio],
      ['Tratamento IPI', antes.tratamentoIpi, depois.tratamentoIpi],
      ['Tratamento PIS/COFINS', antes.tratamentoPis, depois.tratamentoPis],
      ['Tratamento IBS/CBS', antes.tratamentoIbs, depois.tratamentoIbs],
      ['Classificação IBS/CBS', antes.classificacao, depois.classificacao],
      ['Início de vigência', antes.vigenciaInicio, depois.vigenciaInicio],
      ['Fim de vigência', antes.vigenciaFim ?? 'Sem fim de vigência', depois.vigenciaFim ?? 'Sem fim de vigência'],
    ] as const;
    return {
      codigo: antes.codigo,
      numeroVersaoAntes: antes.numeroVersao,
      numeroVersaoDepois: depois.numeroVersao,
      diferencas: campos
        .filter(([, valorAntes, valorDepois]) => valorAntes !== valorDepois)
        .map(([campo, valorAntes, valorDepois]) => ({ campo, antes: valorAntes, depois: valorDepois })),
    };
  }

  async historico(id: string) {
    await this.obter(this.db, id);
    const autor = alias(usuarios, 'historico_regra_autor');
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
      .where(and(eq(schema.auditoria.tabela, 'regras_tributarias'), eq(schema.auditoria.registroId, id)))
      .orderBy(schema.auditoria.createdAt);
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
        numeroVersao: novos.numeroVersao ?? null,
      };
    });
  }

  async criarRascunho(dto: CriarRegraDto, usuarioId: string) {
    const criada = await this.db.transaction(async (tx) => {
      const enquadramento = await travarEnquadramento(tx, dto.enquadramentoId);
      this.exigirOperacaoDoEnquadramento(enquadramento, dto);
      await this.exigirCatalogos(tx, dto.beneficioFiscalId, dto.classificacaoIbsCbsId);
      const linha = await this.inserirComCodigo(tx, {
        numeroVersao: 1,
        enquadramentoId: dto.enquadramentoId,
        icmsCst: dto.icmsCst,
        pRedBc: dto.pRedBc,
        pIcms: dto.pIcms,
        beneficioFiscalId: dto.beneficioFiscalId,
        ipiCst: dto.ipiCst,
        pisCst: dto.pisCst,
        ibsCst: dto.ibsCst,
        classificacaoIbsCbsId: dto.classificacaoIbsCbsId,
        vigenciaInicio: dto.vigenciaInicio,
        vigenciaFim: dto.vigenciaFim ?? null,
        situacao: 'RASCUNHO',
        justificativa: dto.justificativa,
        criadoPorId: usuarioId,
        atualizadoPorId: usuarioId,
      });
      await this.auditar(tx, linha, null, usuarioId, dto.justificativa, 'Rascunho criado', 'INSERT');
      return linha;
    });
    return this.detalhar(criada.id);
  }

  async atualizarRascunho(id: string, dto: AtualizarRegraDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      const atual = await this.obterBloqueado(tx, id);
      recusarEdicao(atual.situacao as SituacaoRegra);
      exigirVersao(atual.versao, dto.versao);
      const enquadramento = await travarEnquadramento(tx, dto.enquadramentoId);
      this.exigirOperacaoDoEnquadramento(enquadramento, dto);
      await this.exigirCatalogos(tx, dto.beneficioFiscalId, dto.classificacaoIbsCbsId);
      const [linha] = await tx.update(regrasTributarias).set({
        enquadramentoId: dto.enquadramentoId,
        icmsCst: dto.icmsCst,
        pRedBc: dto.pRedBc,
        pIcms: dto.pIcms,
        beneficioFiscalId: dto.beneficioFiscalId,
        ipiCst: dto.ipiCst,
        pisCst: dto.pisCst,
        ibsCst: dto.ibsCst,
        classificacaoIbsCbsId: dto.classificacaoIbsCbsId,
        vigenciaInicio: dto.vigenciaInicio,
        vigenciaFim: dto.vigenciaFim ?? null,
        justificativa: dto.justificativa,
        versao: atual.versao + 1,
        atualizadoPorId: usuarioId,
        updatedAt: new Date(),
      }).where(eq(regrasTributarias.id, id)).returning();
      if (!linha) throw new NotFoundException('Regra tributária não encontrada');
      await this.auditar(tx, linha, atual, usuarioId, dto.justificativa, 'Rascunho atualizado', 'UPDATE');
    });
    return this.detalhar(id);
  }

  async adicionarVersao(id: string, dto: NovaVersaoDto, usuarioId: string) {
    const criada = await this.db.transaction(async (tx) => {
      const origem = await this.obterBloqueado(tx, id);
      recusarAcao(origem.situacao as SituacaoRegra, 'adicionarVersao');
      exigirVersao(origem.versao, dto.versao);
      if (dto.enquadramentoId !== origem.enquadramentoId) {
        regraViolada('LINHAGEM_ENQUADRAMENTO_FIXO', 'A versão nova permanece no mesmo enquadramento fiscal.');
      }
      await travarEnquadramento(tx, origem.enquadramentoId);
      this.exigirOperacaoDoEnquadramento(
        await travarEnquadramento(tx, origem.enquadramentoId),
        dto,
      );
      await this.exigirCatalogos(tx, dto.beneficioFiscalId, dto.classificacaoIbsCbsId);
      const aberta = await tx.select({ id: regrasTributarias.id }).from(regrasTributarias).where(and(
        eq(regrasTributarias.codigo, origem.codigo),
        isNull(regrasTributarias.deletedAt),
        sql`${regrasTributarias.situacao} IN ('RASCUNHO','SUBMETIDA')`,
      ));
      if (aberta.length > 0) {
        conflito('VERSAO_ABERTA', 'Já existe versão em rascunho ou submetida para este código.');
      }
      try {
        const [linha] = await tx.insert(regrasTributarias).values({
          codigo: origem.codigo,
          numeroVersao: origem.numeroVersao + 1,
          enquadramentoId: origem.enquadramentoId,
          icmsCst: dto.icmsCst,
          pRedBc: dto.pRedBc,
          pIcms: dto.pIcms,
          beneficioFiscalId: dto.beneficioFiscalId,
          ipiCst: dto.ipiCst,
          pisCst: dto.pisCst,
          ibsCst: dto.ibsCst,
          classificacaoIbsCbsId: dto.classificacaoIbsCbsId,
          vigenciaInicio: dto.vigenciaInicio,
          vigenciaFim: dto.vigenciaFim ?? null,
          situacao: 'RASCUNHO',
          origemVersaoId: origem.id,
          justificativa: dto.justificativa,
          criadoPorId: usuarioId,
          atualizadoPorId: usuarioId,
        }).returning();
        if (!linha) throw new Error('Falha ao gravar versão');
        await this.auditar(tx, linha, null, usuarioId, dto.justificativa, `Versão nova do código ${origem.codigo}`, 'INSERT');
        return linha;
      } catch (err) {
        if (ehViolacaoUnica(err, 'uq_regras_abertas_codigo') || ehViolacaoUnica(err, 'uq_regras_codigo_versao')) {
          conflito('VERSAO_ABERTA', 'Já existe versão em rascunho ou submetida para este código.');
        }
        throw err;
      }
    });
    return this.detalhar(criada.id);
  }

  async submeter(id: string, dto: AcaoRegraDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      const atual = await this.obterBloqueado(tx, id);
      recusarAcao(atual.situacao as SituacaoRegra, 'submeter');
      exigirVersao(atual.versao, dto.versao);
      const [linha] = await tx.update(regrasTributarias).set({
        situacao: 'SUBMETIDA',
        submetidoPorId: usuarioId,
        submetidoEm: new Date(),
        justificativa: dto.justificativa,
        versao: atual.versao + 1,
        atualizadoPorId: usuarioId,
        updatedAt: new Date(),
      }).where(eq(regrasTributarias.id, id)).returning();
      if (!linha) throw new NotFoundException('Regra tributária não encontrada');
      await this.auditar(tx, linha, atual, usuarioId, dto.justificativa, 'Versão submetida', 'UPDATE');
    });
    return this.detalhar(id);
  }

  async aprovar(id: string, dto: AcaoRegraDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      const linha = await this.obterBloqueado(tx, id);
      await travarEnquadramento(tx, linha.enquadramentoId);
      if (linha.situacao !== 'SUBMETIDA') transicaoInvalida(linha.situacao);
      exigirVersao(linha.versao, dto.versao);
      exigirSegregacao(linha.submetidoPorId, usuarioId);
      const outras = await tx.select({
        codigo: regrasTributarias.codigo,
        numeroVersao: regrasTributarias.numeroVersao,
        vigenciaInicio: regrasTributarias.vigenciaInicio,
        vigenciaFim: regrasTributarias.vigenciaFim,
      }).from(regrasTributarias).where(and(
        eq(regrasTributarias.enquadramentoId, linha.enquadramentoId),
        eq(regrasTributarias.situacao, 'APROVADA'),
        isNull(regrasTributarias.deletedAt),
        ne(regrasTributarias.id, linha.id),
      ));
      for (const outra of outras) {
        if (intervalosSobrepoem(
          { inicio: linha.vigenciaInicio, fim: linha.vigenciaFim },
          { inicio: outra.vigenciaInicio, fim: outra.vigenciaFim },
        )) {
          regraViolada(
            'VIGENCIA_AMBIGUA',
            'Já existe versão aprovada deste enquadramento com vigência sobreposta. Nenhuma foi escolhida.',
            { conflito: outra },
          );
        }
      }
      const [gravada] = await tx.update(regrasTributarias).set({
        situacao: 'APROVADA',
        aprovadoPorId: usuarioId,
        aprovadoEm: new Date(),
        justificativa: dto.justificativa,
        versao: linha.versao + 1,
        atualizadoPorId: usuarioId,
        updatedAt: new Date(),
      }).where(eq(regrasTributarias.id, id)).returning();
      if (!gravada) throw new NotFoundException('Regra tributária não encontrada');
      await this.auditar(tx, gravada, linha, usuarioId, dto.justificativa, 'Versão aprovada', 'UPDATE');
    });
    return this.detalhar(id);
  }

  async aposentar(id: string, dto: AcaoRegraDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      const linha = await this.obterBloqueado(tx, id);
      recusarAcao(linha.situacao as SituacaoRegra, 'aposentar');
      exigirVersao(linha.versao, dto.versao);
      exigirSegregacao(linha.submetidoPorId, usuarioId);
      const [gravada] = await tx.update(regrasTributarias).set({
        situacao: 'APOSENTADA',
        aposentadoPorId: usuarioId,
        aposentadoEm: new Date(),
        justificativa: dto.justificativa,
        versao: linha.versao + 1,
        atualizadoPorId: usuarioId,
        updatedAt: new Date(),
      }).where(eq(regrasTributarias.id, id)).returning();
      if (!gravada) throw new NotFoundException('Regra tributária não encontrada');
      await this.auditar(tx, gravada, linha, usuarioId, dto.justificativa, 'Versão aposentada', 'UPDATE');
    });
    return this.detalhar(id);
  }

  private exigirOperacaoDoEnquadramento(
    enquadramento: { operacaoId: string; cfopId: string },
    dto: { operacaoId: string; cfopId: string },
  ) {
    if (dto.operacaoId !== enquadramento.operacaoId || dto.cfopId !== enquadramento.cfopId) {
      regraViolada(
        'ENQUADRAMENTO_DIVERGENTE',
        'A operação e a operação fiscal (CFOP) precisam ser as do enquadramento selecionado.',
      );
    }
  }

  private async exigirCatalogos(tx: Tx, beneficioId: string, classificacaoId: string) {
    const [beneficio] = await tx.select({ id: beneficiosFiscais.id }).from(beneficiosFiscais).where(and(
      eq(beneficiosFiscais.id, beneficioId),
      isNull(beneficiosFiscais.deletedAt),
    ));
    if (!beneficio) regraViolada('BENEFICIO_NAO_ELEGIVEL', 'O benefício fiscal selecionado não está ativo.');
    const [classificacao] = await tx.select({ id: classificacoesIbsCbs.id }).from(classificacoesIbsCbs).where(and(
      eq(classificacoesIbsCbs.id, classificacaoId),
      isNull(classificacoesIbsCbs.deletedAt),
    ));
    if (!classificacao) regraViolada('CLASSIFICACAO_NAO_ATIVA', 'A classificação IBS/CBS selecionada não está ativa.');
  }

  private async inserirComCodigo(tx: Tx, valores: Omit<typeof regrasTributarias.$inferInsert, 'codigo'>): Promise<Linha> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('regras_tributarias.codigo'))`);
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      await tx.execute(sql`SAVEPOINT regra_codigo`);
      const gerado = await tx.execute(sql`
        SELECT (COALESCE(MAX(codigo::bigint), 0) + 1)::text AS proximo FROM regras_tributarias
      `);
      const codigo = String((gerado.rows[0] as { proximo: string }).proximo);
      try {
        const [linha] = await tx.insert(regrasTributarias).values({ ...valores, codigo }).returning();
        await tx.execute(sql`RELEASE SAVEPOINT regra_codigo`);
        if (!linha) throw new Error('Falha ao gravar regra tributária');
        return linha;
      } catch (err) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT regra_codigo`);
        if (ehViolacaoUnica(err, 'uq_regras_codigo_versao') && tentativa === 1) continue;
        if (ehViolacaoUnica(err, 'uq_regras_codigo_versao') || ehViolacaoUnica(err, 'uq_regras_abertas_codigo')) {
          conflito('VERSAO_ABERTA', 'Já existe versão em rascunho ou submetida para este código.');
        }
        throw err;
      }
    }
    conflito('VERSAO_ABERTA', 'Já existe versão em rascunho ou submetida para este código.');
  }

  private async carregarComparavel(id: string) {
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
      .where(and(eq(regrasTributarias.id, id), isNull(regrasTributarias.deletedAt)));
    if (!linha) throw new NotFoundException('Regra tributária não encontrada');
    return {
      ...linha,
      tratamentoIcms: ROTULOS_ICMS_CST[linha.icmsCst as keyof typeof ROTULOS_ICMS_CST],
      tratamentoIpi: ROTULOS_IPI_CST[linha.ipiCst as keyof typeof ROTULOS_IPI_CST],
      tratamentoPis: ROTULOS_PIS_CST[linha.pisCst as keyof typeof ROTULOS_PIS_CST],
      tratamentoIbs: ROTULOS_IBS_CST[linha.ibsCst as keyof typeof ROTULOS_IBS_CST],
    };
  }

  private async obter(tx: Tx, id: string): Promise<Linha> {
    const [linha] = await tx.select().from(regrasTributarias).where(and(
      eq(regrasTributarias.id, id),
      isNull(regrasTributarias.deletedAt),
    ));
    if (!linha) throw new NotFoundException('Regra tributária não encontrada');
    return linha;
  }

  private async obterBloqueado(tx: Tx, id: string): Promise<Linha> {
    const [linha] = await tx.select().from(regrasTributarias).where(and(
      eq(regrasTributarias.id, id),
      isNull(regrasTributarias.deletedAt),
    )).for('no key update');
    if (!linha) throw new NotFoundException('Regra tributária não encontrada');
    return linha;
  }

  private async auditar(
    tx: Tx,
    linha: Linha,
    anterior: Linha | null,
    usuarioId: string,
    justificativa: string,
    resumo: string,
    operacao: 'INSERT' | 'UPDATE',
  ) {
    await this.auditoria.registrar(tx, {
      tabela: 'regras_tributarias',
      registroId: linha.id,
      operacao,
      modulo: MODULO,
      usuarioId,
      dadosAnteriores: anterior
        ? { situacao: anterior.situacao, versao: anterior.versao, numeroVersao: anterior.numeroVersao }
        : {},
      dadosNovos: {
        situacao: linha.situacao,
        versao: linha.versao,
        numeroVersao: linha.numeroVersao,
        resumo,
      },
      justificativa,
    });
  }
}
