import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
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
import { EVENTOS, type AcaoRegraTributaria } from '../../../../realtime/events/eventos';
import { intervalosSobrepoem } from '../enquadramentos/enquadramento-criterio';
import {
  conflito,
  conflitoConcorrente,
  ehViolacaoUnica,
  exigirSegregacao,
  exigirVersao,
  regraViolada,
  transicaoInvalida,
  type Tx,
} from '../empresas/fiscal-comum';
import type { AcaoRegraDto, AtualizarRegraDto, CriarRegraDto, ListarRegrasQuery, NovaVersaoDto } from './dto/regra.dto';
import { montarCsvRegras } from './exportacao-csv';
import { formatarPercentualPtBr } from './percentual';
import { recusarAcao, recusarEdicao, type SituacaoRegra } from './regra-transicao';
import { exigirTratamentoIcmsCoerente } from './tratamento-icms';

type Db = NodePgDatabase<typeof schema>;
type Linha = typeof regrasTributarias.$inferSelect;

const MODULO = 'fiscal.regras';

type LinhaEnquadramento = typeof enquadramentosFiscais.$inferSelect;

/**
 * Ordem única de locks (AD-33): enquadramento antes de regra, em todo o código. Inativar, remover e trocar
 * a chave do enquadramento travam o enquadramento e depois as regras; as ações de regra fazem o mesmo.
 * Só trava: a validação fica em `exigirEnquadramentoAtivo`, para preservar a precedência dos erros.
 */
async function bloquearEnquadramento(tx: Tx, id: string): Promise<LinhaEnquadramento | undefined> {
  const [linha] = await tx.select().from(enquadramentosFiscais).where(eq(enquadramentosFiscais.id, id)).for('no key update');
  return linha;
}

/** Removido ou inativo é indisponível (422): o enquadramento existiu e a regra o referencia. */
function exigirEnquadramentoAtivo(linha: LinhaEnquadramento | undefined): LinhaEnquadramento {
  if (!linha) throw new NotFoundException('Enquadramento fiscal não encontrado');
  if (linha.deletedAt || linha.situacao !== 'ATIVA') {
    regraViolada('ENQUADRAMENTO_INDISPONIVEL', 'O enquadramento fiscal não está ativo.');
  }
  return linha;
}

export async function travarEnquadramento(tx: Tx, id: string) {
  return exigirEnquadramentoAtivo(await bloquearEnquadramento(tx, id));
}

/** Códigos numéricos guardados como texto: a ordenação põe 2 antes de 10. */
const enquadramentoNumerico = sql`${enquadramentosFiscais.codigo}::bigint`;
const regraNumerica = sql`${regrasTributarias.codigo}::bigint`;

function razao(valor: string): string {
  const [inteiro, frac = ''] = valor.split('.');
  return `${inteiro}.${(frac + '0000').slice(0, 4)}`;
}

@Injectable()
export class RegrasTributariasService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  private whereLista(query: ListarRegrasQuery) {
    const filtro = query.search?.trim();
    const termo = filtro ? `%${filtro.replace(/[%_\\]/g, '')}%` : undefined;
    return and(
      isNull(regrasTributarias.deletedAt),
      query.cfopId ? eq(enquadramentosFiscais.cfopId, query.cfopId) : undefined,
      query.codigo ? eq(regrasTributarias.codigo, query.codigo) : undefined,
      query.situacao ? eq(regrasTributarias.situacao, query.situacao) : undefined,
      termo
        ? sql`(
            ${enquadramentosFiscais.codigo} ILIKE ${termo}
            OR ${cfops.codigo} ILIKE ${termo}
            OR ${operacoes.rotulo} ILIKE ${termo}
            OR ${beneficiosFiscais.codigo} ILIKE ${termo}
            OR ${beneficiosFiscais.descricao} ILIKE ${termo}
            OR ${classificacoesIbsCbs.codigo} ILIKE ${termo}
            OR ${classificacoesIbsCbs.descricao} ILIKE ${termo}
            OR ${regrasTributarias.codigo} ILIKE ${termo}
          )`
        : undefined,
    );
  }

  private ordem(query: ListarRegrasQuery) {
    const coluna = {
      enquadramento: enquadramentoNumerico,
      cfop: cfops.codigo,
      cBenef: beneficiosFiscais.descricao,
      cClassTrib: classificacoesIbsCbs.descricao,
      operacao: operacoes.rotulo,
      icmsCst: regrasTributarias.icmsCst,
    }[query.sort];
    return [
      query.dir === 'desc' ? desc(coluna) : asc(coluna),
      asc(enquadramentoNumerico),
      asc(regraNumerica),
      asc(regrasTributarias.numeroVersao),
      asc(regrasTributarias.id),
    ];
  }

  async listar(query: ListarRegrasQuery) {
    const where = this.whereLista(query);
    const totalLinha = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(regrasTributarias)
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, regrasTributarias.enquadramentoId))
      .innerJoin(cfops, eq(cfops.id, enquadramentosFiscais.cfopId))
      .innerJoin(operacoes, eq(operacoes.id, enquadramentosFiscais.operacaoId))
      .innerJoin(beneficiosFiscais, eq(beneficiosFiscais.id, regrasTributarias.beneficioFiscalId))
      .innerJoin(classificacoesIbsCbs, eq(classificacoesIbsCbs.id, regrasTributarias.classificacaoIbsCbsId))
      .where(where);
    const linhas = await this.db
      .select({
        id: regrasTributarias.id,
        codigo: regrasTributarias.codigo,
        numeroVersao: regrasTributarias.numeroVersao,
        situacao: regrasTributarias.situacao,
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
      .orderBy(...this.ordem(query))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const data = linhas.map((linha) => ({
      id: linha.id,
      codigo: linha.codigo,
      numeroVersao: linha.numeroVersao,
      situacao: ROTULOS_SITUACAO_REGRA[linha.situacao as SituacaoRegra],
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
        enquadramentoCodigo: enquadramentosFiscais.codigo,
        operacaoId: enquadramentosFiscais.operacaoId,
        operacaoRotulo: operacoes.rotulo,
        cfopId: enquadramentosFiscais.cfopId,
        cfopCodigo: cfops.codigo,
        beneficioDescricao: beneficiosFiscais.descricao,
        classificacaoDescricao: classificacoesIbsCbs.descricao,
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
      .innerJoin(cfops, eq(cfops.id, enquadramentosFiscais.cfopId))
      .innerJoin(operacoes, eq(operacoes.id, enquadramentosFiscais.operacaoId))
      .innerJoin(beneficiosFiscais, eq(beneficiosFiscais.id, regrasTributarias.beneficioFiscalId))
      .innerJoin(classificacoesIbsCbs, eq(classificacoesIbsCbs.id, regrasTributarias.classificacaoIbsCbsId))
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
      tratamentoIpi: ROTULOS_IPI_CST[linha.ipiCst as keyof typeof ROTULOS_IPI_CST],
      tratamentoPis: ROTULOS_PIS_CST[linha.pisCst as keyof typeof ROTULOS_PIS_CST],
      tratamentoIbs: ROTULOS_IBS_CST[linha.ibsCst as keyof typeof ROTULOS_IBS_CST],
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

  async contagens(query: ListarRegrasQuery) {
    const [linha] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        rascunhos: sql<number>`count(*) filter (where ${regrasTributarias.situacao} = 'RASCUNHO')::int`,
        submetidas: sql<number>`count(*) filter (where ${regrasTributarias.situacao} = 'SUBMETIDA')::int`,
        aprovadas: sql<number>`count(*) filter (where ${regrasTributarias.situacao} = 'APROVADA')::int`,
        aposentadas: sql<number>`count(*) filter (where ${regrasTributarias.situacao} = 'APOSENTADA')::int`,
      })
      .from(regrasTributarias)
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, regrasTributarias.enquadramentoId))
      .innerJoin(cfops, eq(cfops.id, enquadramentosFiscais.cfopId))
      .innerJoin(operacoes, eq(operacoes.id, enquadramentosFiscais.operacaoId))
      .innerJoin(beneficiosFiscais, eq(beneficiosFiscais.id, regrasTributarias.beneficioFiscalId))
      .innerJoin(classificacoesIbsCbs, eq(classificacoesIbsCbs.id, regrasTributarias.classificacaoIbsCbsId))
      .where(this.whereLista(query));
    return {
      total: linha?.total ?? 0,
      rascunhos: linha?.rascunhos ?? 0,
      submetidas: linha?.submetidas ?? 0,
      aprovadas: linha?.aprovadas ?? 0,
      aposentadas: linha?.aposentadas ?? 0,
    };
  }

  async exportar(query: ListarRegrasQuery): Promise<string> {
    const linhas = await this.db
      .select({
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
      .where(this.whereLista(query))
      .orderBy(...this.ordem(query));
    return montarCsvRegras(linhas);
  }

  async preCondicoes(id: string) {
    const linha = await this.obter(this.db, id);
    const [enquadramento] = await this.db
      .select({ situacao: enquadramentosFiscais.situacao, deletedAt: enquadramentosFiscais.deletedAt })
      .from(enquadramentosFiscais)
      .where(eq(enquadramentosFiscais.id, linha.enquadramentoId));
    const campos = [
      linha.icmsCst,
      linha.pRedBc,
      linha.pIcms,
      linha.beneficioFiscalId,
      linha.ipiCst,
      linha.pisCst,
      linha.ibsCst,
      linha.classificacaoIbsCbsId,
    ].every((valor) => String(valor).trim() !== '');
    return [
      {
        codigo: 'ENQUADRAMENTO_ATIVO',
        atendida: enquadramento?.situacao === 'ATIVA' && enquadramento.deletedAt == null,
        provisoria: false,
      },
      { codigo: 'VIGENCIA_INFORMADA', atendida: linha.vigenciaInicio.trim() !== '', provisoria: false },
      { codigo: 'CAMPOS_TRIBUTARIOS', atendida: campos, provisoria: false },
      { codigo: 'DATAS_COMERCIAL_FISCAL_EFETIVA', atendida: false, provisoria: true },
      {
        codigo: 'DUPLA_APROVACAO',
        atendida: false,
        provisoria: true,
        texto: 'Um aprovador diferente de quem submeteu registra a aprovação. Quantos aprovadores formam quórum ainda não foi decidido.',
      },
      { codigo: 'PERFIS_ALEM_ADMINISTRADOR', atendida: false, provisoria: true },
    ];
  }

  async historico(id: string) {
    const atual = await this.obter(this.db, id);
    const ids = atual.origemVersaoId ? [atual.origemVersaoId, id] : [id];
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
      .where(and(eq(schema.auditoria.tabela, 'regras_tributarias'), inArray(schema.auditoria.registroId, ids)))
      .orderBy(asc(schema.auditoria.createdAt), asc(schema.auditoria.id));
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
      exigirTratamentoIcmsCoerente(dto);
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
    this.emitir('rascunho_criado', criada);
    return this.detalhar(criada.id);
  }

  async atualizarRascunho(id: string, dto: AtualizarRegraDto, usuarioId: string) {
    const linha = await this.db.transaction(async (tx) => {
      const destino = await bloquearEnquadramento(tx, dto.enquadramentoId);
      const atual = await this.obterBloqueado(tx, id);
      recusarEdicao(atual.situacao as SituacaoRegra);
      exigirVersao(atual.versao, dto.versao);
      if ((atual.origemVersaoId || atual.numeroVersao > 1) && dto.enquadramentoId !== atual.enquadramentoId) {
        regraViolada('LINHAGEM_ENQUADRAMENTO_FIXO', 'A versão nova permanece no mesmo enquadramento fiscal.');
      }
      const enquadramento = exigirEnquadramentoAtivo(destino);
      this.exigirOperacaoDoEnquadramento(enquadramento, dto);
      await this.exigirCatalogos(tx, dto.beneficioFiscalId, dto.classificacaoIbsCbsId);
      exigirTratamentoIcmsCoerente(dto);
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
      return linha;
    });
    this.emitir('rascunho_atualizado', linha);
    return this.detalhar(id);
  }

  async adicionarVersao(id: string, dto: NovaVersaoDto, usuarioId: string) {
    const criada = await this.db.transaction(async (tx) => {
      const { linha: origem, enquadramento } = await this.travarComEnquadramento(tx, id);
      recusarAcao(origem.situacao as SituacaoRegra, 'adicionarVersao');
      exigirVersao(origem.versao, dto.versao);
      // 409 de versão aberta antes de qualquer 422: a linhagem decide primeiro (M9).
      const aberta = await tx.select({ id: regrasTributarias.id }).from(regrasTributarias).where(and(
        eq(regrasTributarias.codigo, origem.codigo),
        isNull(regrasTributarias.deletedAt),
        sql`${regrasTributarias.situacao} IN ('RASCUNHO','SUBMETIDA')`,
      ));
      if (aberta.length > 0) {
        conflito('VERSAO_ABERTA', 'Já existe versão em rascunho ou submetida para este código.');
      }
      if (dto.enquadramentoId !== origem.enquadramentoId) {
        regraViolada('LINHAGEM_ENQUADRAMENTO_FIXO', 'A versão nova permanece no mesmo enquadramento fiscal.');
      }
      this.exigirOperacaoDoEnquadramento(exigirEnquadramentoAtivo(enquadramento), dto);
      await this.exigirCatalogos(tx, dto.beneficioFiscalId, dto.classificacaoIbsCbsId);
      exigirTratamentoIcmsCoerente(dto);
      // Sob a trava do enquadramento (a linhagem não troca de enquadramento): MAX + 1, como na T04 (D24).
      const [ultima] = await tx.select({ maior: sql<number>`MAX(${regrasTributarias.numeroVersao})::int` })
        .from(regrasTributarias).where(eq(regrasTributarias.codigo, origem.codigo));
      try {
        const [linha] = await tx.insert(regrasTributarias).values({
          codigo: origem.codigo,
          numeroVersao: (ultima?.maior ?? origem.numeroVersao) + 1,
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
    this.emitir('versao_adicionada', criada);
    return this.detalhar(criada.id);
  }

  async submeter(id: string, dto: AcaoRegraDto, usuarioId: string) {
    const linha = await this.db.transaction(async (tx) => {
      const { linha: atual, enquadramento } = await this.travarComEnquadramento(tx, id);
      recusarAcao(atual.situacao as SituacaoRegra, 'submeter');
      exigirVersao(atual.versao, dto.versao);
      exigirEnquadramentoAtivo(enquadramento);
      exigirTratamentoIcmsCoerente(atual, 'aprovacao');
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
      return linha;
    });
    this.emitir('submetida', linha);
    return this.detalhar(id);
  }

  async aprovar(id: string, dto: AcaoRegraDto, usuarioId: string) {
    const gravada = await this.db.transaction(async (tx) => {
      const { linha, enquadramento } = await this.travarComEnquadramento(tx, id);
      exigirEnquadramentoAtivo(enquadramento);
      if (linha.situacao !== 'SUBMETIDA') transicaoInvalida(linha.situacao);
      exigirVersao(linha.versao, dto.versao);
      exigirSegregacao(linha.submetidoPorId, usuarioId);
      exigirTratamentoIcmsCoerente(linha, 'aprovacao');
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
      return gravada;
    });
    this.emitir('aprovada', gravada);
    return this.detalhar(id);
  }

  async aposentar(id: string, dto: AcaoRegraDto, usuarioId: string) {
    const gravada = await this.db.transaction(async (tx) => {
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
      return gravada;
    });
    this.emitir('aposentada', gravada);
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

  /**
   * Trava o enquadramento da regra e só então a regra (ordem única, AD-33). O enquadramento é lido sem
   * trava primeiro; se um PATCH concorrente mudou o vínculo nesse meio-tempo, a disputa vira 409.
   */
  private async travarComEnquadramento(tx: Tx, id: string) {
    const previa = await this.obter(tx, id);
    const enquadramento = await bloquearEnquadramento(tx, previa.enquadramentoId);
    const linha = await this.obterBloqueado(tx, id);
    if (linha.enquadramentoId !== previa.enquadramentoId) conflitoConcorrente();
    return { linha, enquadramento };
  }

  private async obterBloqueado(tx: Tx, id: string): Promise<Linha> {
    const [linha] = await tx.select().from(regrasTributarias).where(and(
      eq(regrasTributarias.id, id),
      isNull(regrasTributarias.deletedAt),
    )).for('no key update');
    if (!linha) throw new NotFoundException('Regra tributária não encontrada');
    return linha;
  }

  private emitir(acao: AcaoRegraTributaria, linha: Pick<Linha, 'id' | 'enquadramentoId' | 'codigo' | 'numeroVersao' | 'situacao'>) {
    this.eventos.emit(EVENTOS.REGRA_TRIBUTARIA_ALTERADA, {
      regraId: linha.id,
      enquadramentoId: linha.enquadramentoId,
      codigo: linha.codigo,
      numeroVersao: linha.numeroVersao,
      acao,
      situacao: linha.situacao,
    });
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
        ? { situacao: anterior.situacao, versao: anterior.versao, numeroVersao: anterior.numeroVersao, ...camposFiscais(anterior) }
        : {},
      dadosNovos: {
        situacao: linha.situacao,
        versao: linha.versao,
        numeroVersao: linha.numeroVersao,
        ...camposFiscais(linha),
        resumo,
      },
      justificativa,
    });
  }
}

/** Campos tributários auditados antes e depois (CST, redução, alíquota, benefício, classificação, vigência). */
function camposFiscais(linha: Linha) {
  return {
    icmsCst: linha.icmsCst,
    pRedBc: linha.pRedBc,
    pIcms: linha.pIcms,
    beneficioFiscalId: linha.beneficioFiscalId,
    ipiCst: linha.ipiCst,
    pisCst: linha.pisCst,
    ibsCst: linha.ibsCst,
    classificacaoIbsCbsId: linha.classificacaoIbsCbsId,
    vigenciaInicio: linha.vigenciaInicio,
    vigenciaFim: linha.vigenciaFim,
  };
}
