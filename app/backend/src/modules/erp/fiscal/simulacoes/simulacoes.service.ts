import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { montarPaginado } from '../../../../common/crud/paginacao';
import { DRIZZLE } from '../../../../database/database.module';
import { EVENTOS } from '../../../../realtime/events/eventos';
import * as schema from '../../../../database/schema';
import {
  clientes,
  empresas,
  enquadramentosFiscais,
  estabelecimentos,
  ncms,
  operacoes,
  produtos,
  regrasTributarias,
  simulacoesFiscais,
  usuarios,
} from '../../../../database/schema';
import { beneficiosFiscais, classificacoesIbsCbs } from '../../../../database/schema/fiscal-regras.schema';
import {
  conflito,
  conflitoConcorrente,
  ehViolacaoUnica,
  exigirVersao,
  regraViolada,
  type Tx,
} from '../empresas/fiscal-comum';
import { formatarPercentualPtBr } from '../regras/percentual';
import { travarEnquadramento } from '../regras/regras.service';
import { calcularMemoria, formatarDinheiroPtBr, formatarEscalaPtBr, rotuloCompetencia } from './decimal-memoria';
import type { CriarSimulacaoDto, ListarSimulacoesQuery, NovaVersaoDto } from './dto/simulacao.dto';
import { montarCsvGrade, montarCsvMemoria } from './exportacao-csv';
import { montarExplicacao } from './explicacao';

type Db = NodePgDatabase<typeof schema>;
type Linha = typeof simulacoesFiscais.$inferSelect;
type Enquadramento = Awaited<ReturnType<typeof travarEnquadramento>>;

const MODULO = 'fiscal.simulacoes';
const BUSCA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

function razao4(valor: string): string {
  const [inteiro, frac = ''] = valor.split('.');
  return `${inteiro}.${(frac + '0000').slice(0, 4)}`;
}

function canonDinheiro(valor: string): string {
  const negativo = valor.startsWith('-');
  const absoluto = negativo ? valor.slice(1) : valor;
  const [inteiro, frac = ''] = absoluto.split('.');
  return `${negativo ? '-' : ''}${inteiro}.${frac.padEnd(2, '0').slice(0, 2)}`;
}

function canonEscala(valor: string): string {
  const [inteiro, frac = ''] = valor.split('.');
  return `${inteiro}.${frac.padEnd(3, '0').slice(0, 3)}`;
}

function diaCompetencia(competencia: string): string {
  return `${competencia}-01`;
}

function cobre(inicio: string, fim: string | null, dia: string): boolean {
  return inicio <= dia && (fim == null || fim >= dia);
}

function nomeClienteSql() {
  return sql<string>`CASE WHEN btrim(${clientes.nomeFantasia}) <> '' THEN btrim(${clientes.nomeFantasia}) ELSE ${clientes.razaoSocial} END`;
}

@Injectable()
export class SimulacoesFiscaisService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async contagens(query: ListarSimulacoesQuery) {
    const [linha] = await this.db
      .select({
        simulacoes: sql<number>`count(distinct ${simulacoesFiscais.codigo})::int`,
        versoes: sql<number>`count(*)::int`,
        baseDiferente: sql<number>`count(*) filter (where ${simulacoesFiscais.baseDifereBruto})::int`,
      })
      .from(simulacoesFiscais)
      .innerJoin(clientes, eq(clientes.id, simulacoesFiscais.clienteId))
      .innerJoin(produtos, eq(produtos.id, simulacoesFiscais.produtoId))
      .innerJoin(estabelecimentos, eq(estabelecimentos.id, simulacoesFiscais.estabelecimentoId))
      .innerJoin(operacoes, eq(operacoes.id, simulacoesFiscais.operacaoId))
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, simulacoesFiscais.enquadramentoId))
      .innerJoin(regrasTributarias, eq(regrasTributarias.id, simulacoesFiscais.regraId))
      .where(this.whereLista(query));
    return {
      simulacoes: linha?.simulacoes ?? 0,
      versoes: linha?.versoes ?? 0,
      baseDiferente: linha?.baseDiferente ?? 0,
    };
  }

  async exportar(query: ListarSimulacoesQuery) {
    const nomeCliente = nomeClienteSql();
    const linhas = await this.db
      .select({
        cliente: nomeCliente,
        produto: produtos.nome,
        valor: simulacoesFiscais.valor,
        valorLiquido: simulacoesFiscais.valorLiquido,
        estabelecimento: estabelecimentos.nome,
        operacao: operacoes.rotulo,
      })
      .from(simulacoesFiscais)
      .innerJoin(clientes, eq(clientes.id, simulacoesFiscais.clienteId))
      .innerJoin(produtos, eq(produtos.id, simulacoesFiscais.produtoId))
      .innerJoin(estabelecimentos, eq(estabelecimentos.id, simulacoesFiscais.estabelecimentoId))
      .innerJoin(operacoes, eq(operacoes.id, simulacoesFiscais.operacaoId))
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, simulacoesFiscais.enquadramentoId))
      .innerJoin(regrasTributarias, eq(regrasTributarias.id, simulacoesFiscais.regraId))
      .where(this.whereLista(query))
      .orderBy(asc(nomeCliente));
    return montarCsvGrade(linhas.map((linha) => ({
      cliente: linha.cliente,
      produto: linha.produto,
      valor: formatarLista(linha.valor),
      valorLiquido: formatarLista(linha.valorLiquido),
      estabelecimento: linha.estabelecimento,
      operacao: linha.operacao,
    })));
  }

  async listar(query: ListarSimulacoesQuery) {
    if (query.search && BUSCA_UUID.test(query.search.trim())) {
      return montarPaginado([], 0, query);
    }
    const where = this.whereLista(query);
    const totalLinha = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(simulacoesFiscais)
      .innerJoin(clientes, eq(clientes.id, simulacoesFiscais.clienteId))
      .innerJoin(produtos, eq(produtos.id, simulacoesFiscais.produtoId))
      .innerJoin(estabelecimentos, eq(estabelecimentos.id, simulacoesFiscais.estabelecimentoId))
      .innerJoin(operacoes, eq(operacoes.id, simulacoesFiscais.operacaoId))
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, simulacoesFiscais.enquadramentoId))
      .innerJoin(regrasTributarias, eq(regrasTributarias.id, simulacoesFiscais.regraId))
      .where(where);
    const nomeCliente = nomeClienteSql();
    const ordem = {
      cliente: nomeCliente,
      produto: produtos.nome,
      valor: simulacoesFiscais.valor,
      valorLiquido: simulacoesFiscais.valorLiquido,
      estabelecimento: estabelecimentos.nome,
      operacao: operacoes.rotulo,
    }[query.sort];
    const linhas = await this.db
      .select({
        id: simulacoesFiscais.id,
        cliente: nomeCliente,
        produto: produtos.nome,
        valor: simulacoesFiscais.valor,
        valorLiquido: simulacoesFiscais.valorLiquido,
        estabelecimento: estabelecimentos.nome,
        operacao: operacoes.rotulo,
      })
      .from(simulacoesFiscais)
      .innerJoin(clientes, eq(clientes.id, simulacoesFiscais.clienteId))
      .innerJoin(produtos, eq(produtos.id, simulacoesFiscais.produtoId))
      .innerJoin(estabelecimentos, eq(estabelecimentos.id, simulacoesFiscais.estabelecimentoId))
      .innerJoin(operacoes, eq(operacoes.id, simulacoesFiscais.operacaoId))
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, simulacoesFiscais.enquadramentoId))
      .innerJoin(regrasTributarias, eq(regrasTributarias.id, simulacoesFiscais.regraId))
      .where(where)
      .orderBy(query.dir === 'desc' ? desc(ordem) : asc(ordem))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return montarPaginado(linhas.map((linha) => ({
      id: linha.id,
      cliente: linha.cliente,
      produto: linha.produto,
      valor: formatarLista(linha.valor),
      valorLiquido: formatarLista(linha.valorLiquido),
      estabelecimento: linha.estabelecimento,
      operacao: linha.operacao,
    })), totalLinha[0]?.total ?? 0, query);
  }

  async detalhar(id: string) {
    const linha = await this.carregar(this.db, id);
    return this.apresentar(linha);
  }

  async explicar(id: string) {
    const linha = await this.carregar(this.db, id);
    return montarExplicacao({
      cliente: linha.cliente,
      produto: linha.produto,
      estabelecimento: linha.estabelecimento,
      operacao: linha.operacao,
      ncm: linha.ncm,
      quantidade: canonEscala(linha.quantidade),
      pesoNf: canonEscala(linha.pesoNf),
      valor: canonDinheiro(linha.valor),
      desconto: canonDinheiro(linha.desconto),
      valorLiquido: canonDinheiro(linha.valorLiquido),
      competencia: linha.competencia,
      enquadramento: linha.enquadramento,
      regraCodigo: linha.regraCodigo,
      regraNumeroVersao: linha.regraNumeroVersao,
      vigenciaInicio: linha.vigenciaInicio,
      vigenciaFim: linha.vigenciaFim,
      icmsCst: linha.icmsCst,
      pRedBc: razao4(linha.pRedBc),
      baseTributavel: canonDinheiro(linha.baseTributavel),
      pIcms: razao4(linha.pIcms),
      icms: canonDinheiro(linha.icms),
      ipiCst: linha.ipiCst,
      pisCst: linha.pisCst,
      ibsCst: linha.ibsCst,
      beneficio: linha.beneficio,
      classificacao: linha.classificacao,
      baseDifereBruto: linha.baseDifereBruto,
    });
  }

  async memoria(id: string) {
    return montarCsvMemoria(await this.explicar(id));
  }

  async preCondicoes(id: string) {
    const linha = await this.obter(this.db, id);
    const dia = diaCompetencia(linha.competencia);
    const [enquadramento] = await this.db.select({
      situacao: enquadramentosFiscais.situacao,
      deletedAt: enquadramentosFiscais.deletedAt,
      vigenciaInicio: enquadramentosFiscais.vigenciaInicio,
      vigenciaFim: enquadramentosFiscais.vigenciaFim,
    }).from(enquadramentosFiscais).where(eq(enquadramentosFiscais.id, linha.enquadramentoId));
    const [regra] = await this.db.select({
      situacao: regrasTributarias.situacao,
      deletedAt: regrasTributarias.deletedAt,
      vigenciaInicio: regrasTributarias.vigenciaInicio,
      vigenciaFim: regrasTributarias.vigenciaFim,
    }).from(regrasTributarias).where(eq(regrasTributarias.id, linha.regraId));
    const enquadramentoAtivo = Boolean(
      enquadramento
      && enquadramento.situacao === 'ATIVA'
      && enquadramento.deletedAt == null
      && cobre(enquadramento.vigenciaInicio, enquadramento.vigenciaFim, dia),
    );
    const regraVigente = Boolean(
      regra
      && regra.situacao === 'APROVADA'
      && regra.deletedAt == null
      && cobre(regra.vigenciaInicio, regra.vigenciaFim, dia),
    );
    return [
      { codigo: 'ENQUADRAMENTO_ATIVO', atendida: enquadramentoAtivo, provisoria: false },
      { codigo: 'REGRA_APROVADA_VIGENTE', atendida: regraVigente, provisoria: false },
      { codigo: 'MEMORIA_SEM_DOCUMENTO', atendida: true, provisoria: false },
      { codigo: 'DATAS_COMERCIAL_FISCAL_EFETIVA', atendida: false, provisoria: true },
      {
        codigo: 'DUPLA_APROVACAO',
        atendida: false,
        provisoria: true,
        texto: 'Esta tela não aprova nem publica regra. O quórum numérico permanece provisório.',
      },
      { codigo: 'PERFIS_ALEM_ADMINISTRADOR', atendida: false, provisoria: true },
    ];
  }

  async historico(id: string) {
    const atual = await this.obter(this.db, id);
    const ids = atual.origemVersaoId ? [atual.origemVersaoId, id] : [id];
    const autor = alias(usuarios, 'historico_simulacao_autor');
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
      .where(and(eq(schema.auditoria.tabela, 'simulacoes_fiscais'), inArray(schema.auditoria.registroId, ids)))
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

  async simular(dto: CriarSimulacaoDto, usuarioId: string) {
    const gravada = await this.db.transaction(async (tx) => {
      const { regra, memoria } = await this.resolverMemoria(tx, dto);
      const linha = await this.inserirComCodigo(tx, {
        numeroVersao: 1,
        estabelecimentoId: dto.estabelecimentoId,
        operacaoId: dto.operacaoId,
        clienteId: dto.clienteId,
        produtoId: dto.produtoId,
        ncmId: dto.ncmId,
        quantidade: dto.quantidade,
        pesoNf: dto.pesoNf,
        valor: dto.valor,
        desconto: dto.desconto,
        competencia: dto.competencia,
        enquadramentoId: dto.enquadramentoId,
        regraId: regra.id,
        valorLiquido: memoria.valorLiquido,
        baseTributavel: memoria.baseTributavel,
        icms: memoria.icms,
        baseDifereBruto: memoria.baseDifereBruto,
        situacao: 'CALCULADA',
        justificativa: dto.justificativa,
        criadoPorId: usuarioId,
        atualizadoPorId: usuarioId,
      });
      await this.auditar(tx, linha, null, usuarioId, dto.justificativa, 'Simulação calculada', 'INSERT');
      return linha;
    });
    this.emitir('simulada', gravada);
    return this.detalhar(gravada.id);
  }

  async novaVersao(id: string, dto: NovaVersaoDto, usuarioId: string) {
    const gravada = await this.db.transaction(async (tx) => {
      const origem = await this.obterBloqueado(tx, id);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('simulacoes_fiscais.versao.' || ${origem.codigo}))`);
      exigirVersao(origem.versao, dto.versao);
      if (dto.enquadramentoId !== origem.enquadramentoId) {
        regraViolada('LINHAGEM_ENQUADRAMENTO_FIXO', 'A versão nova permanece no mesmo enquadramento fiscal.');
      }
      const { regra, memoria } = await this.resolverMemoria(tx, dto);
      const gerado = await tx.execute(sql`
        SELECT COALESCE(MAX(numero_versao), 0)::int AS n
        FROM simulacoes_fiscais
        WHERE codigo = ${origem.codigo} AND deleted_at IS NULL
      `);
      const numeroVersao = Number((gerado.rows[0] as { n: number }).n) + 1;
      try {
        const [linha] = await tx.insert(simulacoesFiscais).values({
          codigo: origem.codigo,
          numeroVersao,
          origemVersaoId: origem.id,
          estabelecimentoId: dto.estabelecimentoId,
          operacaoId: dto.operacaoId,
          clienteId: dto.clienteId,
          produtoId: dto.produtoId,
          ncmId: dto.ncmId,
          quantidade: dto.quantidade,
          pesoNf: dto.pesoNf,
          valor: dto.valor,
          desconto: dto.desconto,
          competencia: dto.competencia,
          enquadramentoId: dto.enquadramentoId,
          regraId: regra.id,
          valorLiquido: memoria.valorLiquido,
          baseTributavel: memoria.baseTributavel,
          icms: memoria.icms,
          baseDifereBruto: memoria.baseDifereBruto,
          situacao: 'CALCULADA',
          justificativa: dto.justificativa,
          criadoPorId: usuarioId,
          atualizadoPorId: usuarioId,
        }).returning();
        if (!linha) throw new Error('Falha ao gravar simulação');
        await this.auditar(
          tx,
          linha,
          null,
          usuarioId,
          dto.justificativa,
          `Versão nova do código ${origem.codigo}`,
          'INSERT',
        );
        return linha;
      } catch (err) {
        if (ehViolacaoUnica(err, 'uq_simulacoes_codigo_versao')) conflitoConcorrente();
        throw err;
      }
    });
    this.emitir('versao_adicionada', gravada);
    return this.detalhar(gravada.id);
  }

  async recusarAlteracao(id: string): Promise<never> {
    await this.obter(this.db, id);
    conflito('VERSAO_IMUTAVEL', 'A memória calculada não pode ser alterada. Inclua uma versão nova.');
  }

  async comparar(id: string, com: string) {
    const antes = await this.carregar(this.db, id);
    const depois = await this.carregar(this.db, com);
    if (antes.codigo !== depois.codigo) {
      regraViolada('SIMULACOES_DISTINTAS', 'A comparação exige duas versões da mesma simulação.');
    }
    const textoAntes = textoComparavel(antes);
    const textoDepois = textoComparavel(depois);
    return {
      codigo: antes.codigo,
      numeroVersaoAntes: antes.numeroVersao,
      numeroVersaoDepois: depois.numeroVersao,
      diferencas: ORDEM_COMPARACAO
        .filter((campo) => textoAntes[campo] !== textoDepois[campo])
        .map((campo) => ({ campo, antes: textoAntes[campo], depois: textoDepois[campo] })),
    };
  }

  private async resolverMemoria(tx: Tx, dto: CriarSimulacaoDto) {
    const enquadramento = await travarEnquadramento(tx, dto.enquadramentoId);
    this.conferirFks(enquadramento, dto);
    await this.conferirCadastros(tx, dto);
    const dia = diaCompetencia(dto.competencia);
    if (!cobre(enquadramento.vigenciaInicio, enquadramento.vigenciaFim, dia)) {
      regraViolada('ENQUADRAMENTO_INDISPONIVEL', 'O enquadramento fiscal não cobre esta competência.');
    }
    const regra = await this.resolverRegra(tx, dto.enquadramentoId, dia);
    const memoria = calcularMemoria({
      valor: dto.valor,
      desconto: dto.desconto,
      pRedBc: razao4(regra.pRedBc),
      pIcms: razao4(regra.pIcms),
    });
    if (!memoria) {
      regraViolada('DESCONTO_MAIOR_QUE_VALOR', 'O desconto não pode ser maior que o valor.');
    }
    return { regra, memoria };
  }

  private whereLista(query: ListarSimulacoesQuery) {
    const filtros = [
      isNull(simulacoesFiscais.deletedAt),
      query.estabelecimentoId ? eq(simulacoesFiscais.estabelecimentoId, query.estabelecimentoId) : undefined,
      query.clienteId ? eq(simulacoesFiscais.clienteId, query.clienteId) : undefined,
      query.produtoId ? eq(simulacoesFiscais.produtoId, query.produtoId) : undefined,
      query.competencia ? eq(simulacoesFiscais.competencia, query.competencia) : undefined,
    ];
    if (query.search?.trim()) {
      const termo = `%${query.search.trim()}%`;
      filtros.push(or(
        sql`${nomeClienteSql()} ILIKE ${termo}`,
        ilike(clientes.razaoSocial, termo),
        ilike(produtos.nome, termo),
        ilike(operacoes.rotulo, termo),
        ilike(enquadramentosFiscais.codigo, termo),
        ilike(regrasTributarias.codigo, termo),
      ));
    }
    return and(...filtros);
  }

  private conferirFks(enquadramento: Enquadramento, dto: CriarSimulacaoDto) {
    if (
      dto.estabelecimentoId !== enquadramento.estabelecimentoId
      || dto.operacaoId !== enquadramento.operacaoId
      || dto.clienteId !== enquadramento.clienteId
      || dto.produtoId !== enquadramento.produtoId
      || dto.ncmId !== enquadramento.ncmId
    ) {
      regraViolada(
        'ENQUADRAMENTO_DIVERGENTE',
        'Estabelecimento, operação, cliente, produto e classificação fiscal (NCM) precisam ser os do enquadramento selecionado.',
      );
    }
  }

  private async conferirCadastros(tx: Tx, dto: CriarSimulacaoDto) {
    const [estabelecimento] = await tx.select({
      situacao: estabelecimentos.situacao,
      deletedAt: estabelecimentos.deletedAt,
    }).from(estabelecimentos).where(eq(estabelecimentos.id, dto.estabelecimentoId));
    if (!estabelecimento || estabelecimento.deletedAt || estabelecimento.situacao !== 'APPROVED') {
      regraViolada('ESTABELECIMENTO_INDISPONIVEL', 'O estabelecimento selecionado não está aprovado.');
    }
    const [cliente] = await tx.select({
      status: clientes.status,
      deletedAt: clientes.deletedAt,
    }).from(clientes).where(eq(clientes.id, dto.clienteId));
    if (!cliente || cliente.deletedAt || cliente.status !== 'ativo') {
      regraViolada('CLIENTE_INDISPONIVEL', 'O cliente selecionado não está ativo.');
    }
    const [produto] = await tx.select({
      status: produtos.status,
      deletedAt: produtos.deletedAt,
    }).from(produtos).where(eq(produtos.id, dto.produtoId));
    if (!produto || produto.deletedAt || produto.status !== 'ativo') {
      regraViolada('PRODUTO_INDISPONIVEL', 'O produto selecionado não está ativo.');
    }
    const [ncm] = await tx.select({ deletedAt: ncms.deletedAt }).from(ncms).where(eq(ncms.id, dto.ncmId));
    if (!ncm || ncm.deletedAt) {
      regraViolada('NCM_INDISPONIVEL', 'A classificação fiscal (NCM) selecionada não está ativa.');
    }
    const [operacao] = await tx.select({ deletedAt: operacoes.deletedAt }).from(operacoes).where(eq(operacoes.id, dto.operacaoId));
    if (!operacao || operacao.deletedAt) {
      regraViolada('OPERACAO_INDISPONIVEL', 'A operação selecionada não está disponível.');
    }
  }

  private async resolverRegra(tx: Tx, enquadramentoId: string, dia: string) {
    const regras = await tx.select().from(regrasTributarias).where(and(
      eq(regrasTributarias.enquadramentoId, enquadramentoId),
      eq(regrasTributarias.situacao, 'APROVADA'),
      isNull(regrasTributarias.deletedAt),
      sql`${regrasTributarias.vigenciaInicio} <= ${dia}`,
      sql`(${regrasTributarias.vigenciaFim} IS NULL OR ${regrasTributarias.vigenciaFim} >= ${dia})`,
    ));
    if (regras.length === 0) {
      regraViolada(
        'FALTA_REFERENCIA_LEGAL',
        'Não há regra tributária aprovada vigente nesta competência para o enquadramento selecionado.',
      );
    }
    if (regras.length > 1) {
      regraViolada(
        'REFERENCIA_AMBIGUA',
        'Há mais de uma regra tributária aprovada vigente nesta competência. Nenhuma foi escolhida.',
      );
    }
    return regras[0]!;
  }

  private async inserirComCodigo(tx: Tx, valores: Omit<typeof simulacoesFiscais.$inferInsert, 'codigo'>): Promise<Linha> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('simulacoes_fiscais.codigo'))`);
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      await tx.execute(sql`SAVEPOINT simulacao_codigo`);
      const gerado = await tx.execute(sql`
        SELECT (COALESCE(MAX(codigo::bigint), 0) + 1)::text AS proximo FROM simulacoes_fiscais
      `);
      const codigo = String((gerado.rows[0] as { proximo: string }).proximo);
      try {
        const [linha] = await tx.insert(simulacoesFiscais).values({ ...valores, codigo }).returning();
        await tx.execute(sql`RELEASE SAVEPOINT simulacao_codigo`);
        if (!linha) throw new Error('Falha ao gravar simulação');
        return linha;
      } catch (err) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT simulacao_codigo`);
        if (ehViolacaoUnica(err, 'uq_simulacoes_codigo_versao') && tentativa === 1) continue;
        if (ehViolacaoUnica(err, 'uq_simulacoes_codigo_versao')) conflitoConcorrente();
        throw err;
      }
    }
    conflitoConcorrente();
  }

  private async obter(tx: Tx, id: string): Promise<Linha> {
    const [linha] = await tx.select().from(simulacoesFiscais).where(and(
      eq(simulacoesFiscais.id, id),
      isNull(simulacoesFiscais.deletedAt),
    ));
    if (!linha) throw new NotFoundException('Simulação fiscal não encontrada');
    return linha;
  }

  private async obterBloqueado(tx: Tx, id: string): Promise<Linha> {
    const [linha] = await tx.select().from(simulacoesFiscais).where(and(
      eq(simulacoesFiscais.id, id),
      isNull(simulacoesFiscais.deletedAt),
    )).for('update');
    if (!linha) throw new NotFoundException('Simulação fiscal não encontrada');
    return linha;
  }

  private async carregar(tx: Tx, id: string) {
    const responsavel = alias(usuarios, 'simulacao_responsavel');
    const [linha] = await tx.select({
      id: simulacoesFiscais.id,
      codigo: simulacoesFiscais.codigo,
      numeroVersao: simulacoesFiscais.numeroVersao,
      versao: simulacoesFiscais.versao,
      quantidade: simulacoesFiscais.quantidade,
      pesoNf: simulacoesFiscais.pesoNf,
      valor: simulacoesFiscais.valor,
      desconto: simulacoesFiscais.desconto,
      valorLiquido: simulacoesFiscais.valorLiquido,
      baseTributavel: simulacoesFiscais.baseTributavel,
      icms: simulacoesFiscais.icms,
      baseDifereBruto: simulacoesFiscais.baseDifereBruto,
      competencia: simulacoesFiscais.competencia,
      justificativa: simulacoesFiscais.justificativa,
      criadoEm: simulacoesFiscais.createdAt,
      atualizadoEm: simulacoesFiscais.updatedAt,
      cliente: nomeClienteSql(),
      produto: produtos.nome,
      estabelecimento: estabelecimentos.nome,
      operacao: operacoes.rotulo,
      ncmCodigo: ncms.codigo,
      ncmDescricao: ncms.descricao,
      enquadramento: enquadramentosFiscais.codigo,
      empresa: empresas.razaoSocial,
      responsavel: responsavel.nome,
      regraCodigo: regrasTributarias.codigo,
      regraNumeroVersao: regrasTributarias.numeroVersao,
      vigenciaInicio: regrasTributarias.vigenciaInicio,
      vigenciaFim: regrasTributarias.vigenciaFim,
      icmsCst: regrasTributarias.icmsCst,
      pRedBc: regrasTributarias.pRedBc,
      pIcms: regrasTributarias.pIcms,
      ipiCst: regrasTributarias.ipiCst,
      pisCst: regrasTributarias.pisCst,
      ibsCst: regrasTributarias.ibsCst,
      beneficio: beneficiosFiscais.descricao,
      classificacao: classificacoesIbsCbs.descricao,
    }).from(simulacoesFiscais)
      .innerJoin(clientes, eq(clientes.id, simulacoesFiscais.clienteId))
      .innerJoin(produtos, eq(produtos.id, simulacoesFiscais.produtoId))
      .innerJoin(estabelecimentos, eq(estabelecimentos.id, simulacoesFiscais.estabelecimentoId))
      .innerJoin(operacoes, eq(operacoes.id, simulacoesFiscais.operacaoId))
      .innerJoin(ncms, eq(ncms.id, simulacoesFiscais.ncmId))
      .innerJoin(enquadramentosFiscais, eq(enquadramentosFiscais.id, simulacoesFiscais.enquadramentoId))
      .innerJoin(empresas, eq(empresas.id, enquadramentosFiscais.empresaId))
      .innerJoin(responsavel, eq(responsavel.id, simulacoesFiscais.criadoPorId))
      .innerJoin(regrasTributarias, eq(regrasTributarias.id, simulacoesFiscais.regraId))
      .innerJoin(beneficiosFiscais, eq(beneficiosFiscais.id, regrasTributarias.beneficioFiscalId))
      .innerJoin(classificacoesIbsCbs, eq(classificacoesIbsCbs.id, regrasTributarias.classificacaoIbsCbsId))
      .where(and(eq(simulacoesFiscais.id, id), isNull(simulacoesFiscais.deletedAt)));
    if (!linha) throw new NotFoundException('Simulação fiscal não encontrada');
    return { ...linha, ncm: `${linha.ncmCodigo} — ${linha.ncmDescricao}` };
  }

  private apresentar(linha: Awaited<ReturnType<SimulacoesFiscaisService['carregar']>>) {
    return {
      id: linha.id,
      codigo: linha.codigo,
      numeroVersao: linha.numeroVersao,
      versao: linha.versao,
      situacao: 'Calculada',
      cliente: linha.cliente,
      produto: linha.produto,
      estabelecimento: linha.estabelecimento,
      operacao: linha.operacao,
      ncm: linha.ncm,
      enquadramento: linha.enquadramento,
      empresa: linha.empresa,
      responsavel: linha.responsavel,
      quantidade: canonEscala(linha.quantidade),
      pesoNf: canonEscala(linha.pesoNf),
      valor: canonDinheiro(linha.valor),
      desconto: canonDinheiro(linha.desconto),
      valorLiquido: canonDinheiro(linha.valorLiquido),
      baseTributavel: canonDinheiro(linha.baseTributavel),
      icms: canonDinheiro(linha.icms),
      baseDifereBruto: linha.baseDifereBruto,
      competencia: linha.competencia,
      competenciaRotulo: rotuloCompetencia(linha.competencia),
      justificativa: linha.justificativa,
      criadoEm: linha.criadoEm,
      atualizadoEm: linha.atualizadoEm,
    };
  }

  private emitir(acao: 'simulada' | 'versao_adicionada', linha: Pick<Linha, 'id' | 'codigo' | 'numeroVersao'>) {
    this.eventos.emit(EVENTOS.SIMULACAO_FISCAL_ALTERADA, {
      simulacaoId: linha.id,
      codigo: linha.codigo,
      numeroVersao: linha.numeroVersao,
      acao,
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
      tabela: 'simulacoes_fiscais',
      registroId: linha.id,
      operacao,
      modulo: MODULO,
      usuarioId,
      dadosAnteriores: anterior
        ? { situacao: anterior.situacao, versao: anterior.versao, numeroVersao: anterior.numeroVersao }
        : {},
      dadosNovos: {
        situacao: 'Calculada',
        versao: linha.versao,
        numeroVersao: linha.numeroVersao,
        resumo,
      },
      justificativa,
    });
  }
}

function formatarLista(valor: string): string {
  return formatarDinheiroPtBr(canonDinheiro(valor));
}

const ORDEM_COMPARACAO = [
  'Cliente',
  'Produto',
  'Estabelecimento',
  'Operação',
  'Classificação fiscal (NCM)',
  'Quantidade',
  'Peso informado na nota (kg)',
  'Valor',
  'Desconto',
  'Competência',
  'Enquadramento fiscal',
  'Valor líquido (calculado)',
  'Base tributável (calculada)',
  'Alíquota (%)',
  'ICMS',
  'Código da regra',
  'Versão da regra',
] as const;

function textoComparavel(linha: {
  cliente: string;
  produto: string;
  estabelecimento: string;
  operacao: string;
  ncm: string;
  quantidade: string;
  pesoNf: string;
  valor: string;
  desconto: string;
  competencia: string;
  enquadramento: string;
  valorLiquido: string;
  baseTributavel: string;
  pIcms: string;
  icms: string;
  regraCodigo: string;
  regraNumeroVersao: number;
}): Record<(typeof ORDEM_COMPARACAO)[number], string> {
  return {
    Cliente: linha.cliente,
    Produto: linha.produto,
    Estabelecimento: linha.estabelecimento,
    Operação: linha.operacao,
    'Classificação fiscal (NCM)': linha.ncm,
    Quantidade: formatarEscalaPtBr(canonEscala(linha.quantidade)),
    'Peso informado na nota (kg)': formatarEscalaPtBr(canonEscala(linha.pesoNf)),
    Valor: formatarDinheiroPtBr(canonDinheiro(linha.valor)),
    Desconto: formatarDinheiroPtBr(canonDinheiro(linha.desconto)),
    Competência: rotuloCompetencia(linha.competencia),
    'Enquadramento fiscal': linha.enquadramento,
    'Valor líquido (calculado)': formatarDinheiroPtBr(canonDinheiro(linha.valorLiquido)),
    'Base tributável (calculada)': formatarDinheiroPtBr(canonDinheiro(linha.baseTributavel)),
    'Alíquota (%)': formatarPercentualPtBr(razao4(linha.pIcms)),
    ICMS: formatarDinheiroPtBr(canonDinheiro(linha.icms)),
    'Código da regra': linha.regraCodigo,
    'Versão da regra': String(linha.regraNumeroVersao),
  };
}
