import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { montarPaginado } from '../../../../common/crud/paginacao';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  auditoria,
  cfops,
  clientes,
  empresas,
  enquadramentosFiscais,
  estabelecimentos,
  ncms,
  operacoes,
  produtos,
  regrasTributarias,
  usuarios,
} from '../../../../database/schema';
import { EVENTOS, type AcaoEnquadramentoFiscal } from '../../../../realtime/events/eventos';
import type { ConsultaEnquadramentoDto } from './dto/consulta.dto';
import type {
  AcaoSituacaoDto,
  CreateEnquadramentoDto,
  DuplicarEnquadramentoDto,
  ListarEnquadramentosQuery,
  RemoverEnquadramentoDto,
  UpdateEnquadramentoDto,
} from './dto/enquadramento.dto';
import {
  classificarEnquadramentos,
  mesmaChave,
  intervalosSobrepoem,
  type ChaveEnquadramento,
  type Intervalo,
} from './enquadramento-criterio';
import { montarCsvEnquadramentos } from './exportacao-csv';
import {
  conflito,
  conflitoConcorrente,
  ehViolacaoUnica,
  exigirVersao,
  regraViolada,
  transicaoInvalida,
  travarEstabelecimento,
  type Tx,
} from '../empresas/fiscal-comum';

type Db = NodePgDatabase<typeof schema>;
type Linha = typeof enquadramentosFiscais.$inferSelect;

const MODULO = 'fiscal.enquadramentos';

/** `codigo` é texto numérico (CHECK `^[1-9][0-9]{0,17}$`): ordena como número, "9" antes de "10". */
const codigoNumerico = sql`${enquadramentosFiscais.codigo}::bigint`;

const ROTULOS_TP_NF: Record<string, string> = { '0': 'Entrada', '1': 'Saída' };
const ROTULOS_FIN_NFE: Record<string, string> = {
  '1': 'Operação normal',
  '2': 'NF-e complementar',
  '3': 'NF-e de ajuste',
  '4': 'Devolução',
};
const ROTULOS_ABRANGENCIA: Record<string, string> = {
  INTERNA: 'Dentro do estado',
  INTER: 'Outro estado',
  EXT: 'Exterior',
};
const ROTULOS_TIPO_PRODUTO: Record<string, string> = {
  PROPRIA: 'Produção própria',
  REVENDA: 'Revenda',
  SUB: 'Subproduto',
};

function chaveDe(dto: ChaveEnquadramento): ChaveEnquadramento {
  return {
    operacaoId: dto.operacaoId,
    tpNf: dto.tpNf,
    finNfe: dto.finNfe,
    cfopId: dto.cfopId,
    abrangencia: dto.abrangencia,
    tipoProduto: dto.tipoProduto,
    produtoId: dto.produtoId,
    ncmId: dto.ncmId,
    cest: dto.cest,
    clienteId: dto.clienteId,
  };
}

function intervaloDe(inicio: string, fim?: string | null): Intervalo {
  return { inicio, fim: fim ?? null };
}

function iso(valor: Date | string): string {
  return valor instanceof Date ? valor.toISOString() : new Date(valor).toISOString();
}

@Injectable()
export class EnquadramentosService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoriaSvc: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async listar(query: ListarEnquadramentosQuery) {
    const where = this.whereLista(query);
    const coluna = {
      operacao: operacoes.rotulo,
      cfop: cfops.codigo,
      vigenciaInicio: enquadramentosFiscais.vigenciaInicio,
      estabelecimento: estabelecimentos.nome,
      tpNF: enquadramentosFiscais.tpNf,
      finNFe: enquadramentosFiscais.finNfe,
    }[query.sort];
    const ordem = query.dir === 'desc' ? desc(coluna) : asc(coluna);
    const totalLinha = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(enquadramentosFiscais)
      .innerJoin(operacoes, eq(operacoes.id, enquadramentosFiscais.operacaoId))
      .innerJoin(estabelecimentos, eq(estabelecimentos.id, enquadramentosFiscais.estabelecimentoId))
      .innerJoin(cfops, eq(cfops.id, enquadramentosFiscais.cfopId))
      .innerJoin(produtos, eq(produtos.id, enquadramentosFiscais.produtoId))
      .innerJoin(clientes, eq(clientes.id, enquadramentosFiscais.clienteId))
      .where(where);
    const linhas = await this.db
      .select({
        id: enquadramentosFiscais.id,
        codigo: enquadramentosFiscais.codigo,
        versao: enquadramentosFiscais.versao,
        operacao: operacoes.rotulo,
        cfop: cfops.codigo,
        vigenciaInicio: enquadramentosFiscais.vigenciaInicio,
        estabelecimento: estabelecimentos.nome,
        tpNf: enquadramentosFiscais.tpNf,
        finNfe: enquadramentosFiscais.finNfe,
        situacao: enquadramentosFiscais.situacao,
      })
      .from(enquadramentosFiscais)
      .innerJoin(operacoes, eq(operacoes.id, enquadramentosFiscais.operacaoId))
      .innerJoin(estabelecimentos, eq(estabelecimentos.id, enquadramentosFiscais.estabelecimentoId))
      .innerJoin(cfops, eq(cfops.id, enquadramentosFiscais.cfopId))
      .innerJoin(produtos, eq(produtos.id, enquadramentosFiscais.produtoId))
      .innerJoin(clientes, eq(clientes.id, enquadramentosFiscais.clienteId))
      .where(where)
      .orderBy(ordem, asc(codigoNumerico))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const data = linhas.map((linha) => ({
      id: linha.id,
      codigo: linha.codigo,
      versao: linha.versao,
      operacao: linha.operacao,
      cfop: linha.cfop,
      vigenciaInicio: linha.vigenciaInicio,
      estabelecimento: linha.estabelecimento,
      tpNf: ROTULOS_TP_NF[linha.tpNf] ?? linha.tpNf,
      finNfe: ROTULOS_FIN_NFE[linha.finNfe] ?? linha.finNfe,
      situacao: linha.situacao,
    }));
    return montarPaginado(data, totalLinha[0]?.total ?? 0, query);
  }

  async contagens(query: ListarEnquadramentosQuery) {
    const where = this.whereLista(query);
    const [linha] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        ativas: sql<number>`count(*) filter (where ${enquadramentosFiscais.situacao} = 'ATIVA')::int`,
        inativas: sql<number>`count(*) filter (where ${enquadramentosFiscais.situacao} = 'INATIVA')::int`,
      })
      .from(enquadramentosFiscais)
      .innerJoin(operacoes, eq(operacoes.id, enquadramentosFiscais.operacaoId))
      .innerJoin(estabelecimentos, eq(estabelecimentos.id, enquadramentosFiscais.estabelecimentoId))
      .innerJoin(cfops, eq(cfops.id, enquadramentosFiscais.cfopId))
      .innerJoin(produtos, eq(produtos.id, enquadramentosFiscais.produtoId))
      .innerJoin(clientes, eq(clientes.id, enquadramentosFiscais.clienteId))
      .where(where);
    return { total: linha?.total ?? 0, ativas: linha?.ativas ?? 0, inativas: linha?.inativas ?? 0 };
  }

  async exportar(query: ListarEnquadramentosQuery): Promise<string> {
    const where = this.whereLista(query);
    const linhas = await this.db
      .select({
        codigo: enquadramentosFiscais.codigo,
        operacao: operacoes.rotulo,
        cfop: cfops.codigo,
        vigenciaInicio: enquadramentosFiscais.vigenciaInicio,
        vigenciaFim: enquadramentosFiscais.vigenciaFim,
        estabelecimento: estabelecimentos.nome,
        tpNf: enquadramentosFiscais.tpNf,
        finNfe: enquadramentosFiscais.finNfe,
        situacao: enquadramentosFiscais.situacao,
        responsavel: usuarios.nome,
        produto: produtos.nome,
        clienteNomeFantasia: clientes.nomeFantasia,
        clienteRazao: clientes.razaoSocial,
        ncm: ncms.codigo,
        cest: enquadramentosFiscais.cest,
        prioridade: enquadramentosFiscais.prioridade,
        abrangencia: enquadramentosFiscais.abrangencia,
        tipoProduto: enquadramentosFiscais.tipoProduto,
      })
      .from(enquadramentosFiscais)
      .innerJoin(operacoes, eq(operacoes.id, enquadramentosFiscais.operacaoId))
      .innerJoin(estabelecimentos, eq(estabelecimentos.id, enquadramentosFiscais.estabelecimentoId))
      .innerJoin(cfops, eq(cfops.id, enquadramentosFiscais.cfopId))
      .innerJoin(produtos, eq(produtos.id, enquadramentosFiscais.produtoId))
      .innerJoin(ncms, eq(ncms.id, enquadramentosFiscais.ncmId))
      .innerJoin(clientes, eq(clientes.id, enquadramentosFiscais.clienteId))
      .innerJoin(usuarios, eq(usuarios.id, enquadramentosFiscais.atualizadoPorId))
      .where(where)
      .orderBy(asc(operacoes.rotulo), asc(codigoNumerico));
    return montarCsvEnquadramentos(linhas.map((linha) => ({
      codigo: linha.codigo,
      operacao: linha.operacao,
      cfop: linha.cfop,
      vigenciaInicio: linha.vigenciaInicio,
      vigenciaFim: linha.vigenciaFim,
      estabelecimento: linha.estabelecimento,
      tpNf: linha.tpNf,
      finNfe: linha.finNfe,
      situacao: linha.situacao,
      responsavel: linha.responsavel,
      produto: linha.produto,
      cliente: linha.clienteNomeFantasia?.trim() || linha.clienteRazao,
      ncm: linha.ncm,
      cest: linha.cest,
      prioridade: linha.prioridade,
      abrangencia: linha.abrangencia,
      tipoProduto: linha.tipoProduto,
    })));
  }

  async preCondicoes(id: string) {
    const linha = await this.obter(this.db, id);
    const [estab] = await this.db
      .select({ situacao: estabelecimentos.situacao })
      .from(estabelecimentos)
      .where(eq(estabelecimentos.id, linha.estabelecimentoId));
    const chaveCompleta = [
      linha.estabelecimentoId,
      linha.operacaoId,
      linha.tpNf,
      linha.finNfe,
      linha.cfopId,
      linha.abrangencia,
      linha.tipoProduto,
      linha.produtoId,
      linha.ncmId,
      linha.cest,
      linha.clienteId,
    ].every((valor) => valor.trim() !== '');
    return [
      { codigo: 'ESTABELECIMENTO_APROVADO', atendida: estab?.situacao === 'APPROVED', provisoria: false },
      { codigo: 'VIGENCIA_INFORMADA', atendida: linha.vigenciaInicio.trim() !== '', provisoria: false },
      { codigo: 'CHAVE_COMPLETA', atendida: chaveCompleta, provisoria: false },
      { codigo: 'PRIORIDADE_SEMANTICA', atendida: false, provisoria: true },
      { codigo: 'DESEMPATE_DEFINIDO', atendida: false, provisoria: true },
      { codigo: 'TABELA_OFICIAL_CFOP_NCM', atendida: false, provisoria: true },
      { codigo: 'CEST_VINCULADO_AO_NCM', atendida: false, provisoria: true },
      { codigo: 'DATAS_COMERCIAL_FISCAL_EFETIVA', atendida: false, provisoria: true },
      { codigo: 'DUPLA_APROVACAO', atendida: false, provisoria: true },
    ];
  }

  async detalhar(id: string) {
    const origem = alias(enquadramentosFiscais, 'origem_enquadramento');
    const responsavel = alias(usuarios, 'responsavel_enquadramento');
    const [linha] = await this.db
      .select({
        id: enquadramentosFiscais.id,
        codigo: enquadramentosFiscais.codigo,
        versao: enquadramentosFiscais.versao,
        empresaNome: empresas.razaoSocial,
        estabelecimentoId: enquadramentosFiscais.estabelecimentoId,
        estabelecimentoNome: estabelecimentos.nome,
        operacaoId: enquadramentosFiscais.operacaoId,
        operacaoRotulo: operacoes.rotulo,
        tpNf: enquadramentosFiscais.tpNf,
        finNfe: enquadramentosFiscais.finNfe,
        cfopId: enquadramentosFiscais.cfopId,
        cfopCodigo: cfops.codigo,
        cfopDescricao: cfops.descricao,
        abrangencia: enquadramentosFiscais.abrangencia,
        tipoProduto: enquadramentosFiscais.tipoProduto,
        produtoId: enquadramentosFiscais.produtoId,
        produtoNome: produtos.nome,
        ncmId: enquadramentosFiscais.ncmId,
        ncmCodigo: ncms.codigo,
        ncmDescricao: ncms.descricao,
        cest: enquadramentosFiscais.cest,
        clienteId: enquadramentosFiscais.clienteId,
        clienteNomeFantasia: clientes.nomeFantasia,
        clienteRazao: clientes.razaoSocial,
        vigenciaInicio: enquadramentosFiscais.vigenciaInicio,
        vigenciaFim: enquadramentosFiscais.vigenciaFim,
        prioridade: enquadramentosFiscais.prioridade,
        situacao: enquadramentosFiscais.situacao,
        responsavel: responsavel.nome,
        criadoEm: enquadramentosFiscais.createdAt,
        atualizadoEm: enquadramentosFiscais.updatedAt,
        origemCodigo: origem.codigo,
      })
      .from(enquadramentosFiscais)
      .innerJoin(empresas, eq(empresas.id, enquadramentosFiscais.empresaId))
      .innerJoin(estabelecimentos, eq(estabelecimentos.id, enquadramentosFiscais.estabelecimentoId))
      .innerJoin(operacoes, eq(operacoes.id, enquadramentosFiscais.operacaoId))
      .innerJoin(cfops, eq(cfops.id, enquadramentosFiscais.cfopId))
      .innerJoin(produtos, eq(produtos.id, enquadramentosFiscais.produtoId))
      .innerJoin(ncms, eq(ncms.id, enquadramentosFiscais.ncmId))
      .innerJoin(clientes, eq(clientes.id, enquadramentosFiscais.clienteId))
      .innerJoin(responsavel, eq(responsavel.id, enquadramentosFiscais.atualizadoPorId))
      .leftJoin(origem, eq(origem.id, enquadramentosFiscais.origemEnquadramentoId))
      .where(and(eq(enquadramentosFiscais.id, id), isNull(enquadramentosFiscais.deletedAt)));
    if (!linha) throw new NotFoundException('Enquadramento não encontrado');
    return {
      id: linha.id,
      codigo: linha.codigo,
      versao: linha.versao,
      empresaNome: linha.empresaNome,
      estabelecimentoId: linha.estabelecimentoId,
      estabelecimentoNome: linha.estabelecimentoNome,
      operacaoId: linha.operacaoId,
      operacaoRotulo: linha.operacaoRotulo,
      tpNf: linha.tpNf,
      tipoNota: ROTULOS_TP_NF[linha.tpNf] ?? linha.tpNf,
      finNfe: linha.finNfe,
      finalidade: ROTULOS_FIN_NFE[linha.finNfe] ?? linha.finNfe,
      cfopId: linha.cfopId,
      cfopCodigo: linha.cfopCodigo,
      cfopDescricao: linha.cfopDescricao,
      abrangencia: linha.abrangencia,
      abrangenciaRotulo: ROTULOS_ABRANGENCIA[linha.abrangencia] ?? linha.abrangencia,
      tipoProduto: linha.tipoProduto,
      tipoProdutoRotulo: ROTULOS_TIPO_PRODUTO[linha.tipoProduto] ?? linha.tipoProduto,
      produtoId: linha.produtoId,
      produtoNome: linha.produtoNome,
      ncmId: linha.ncmId,
      ncmCodigo: linha.ncmCodigo,
      ncmDescricao: linha.ncmDescricao,
      cest: linha.cest,
      clienteId: linha.clienteId,
      clienteNome: linha.clienteNomeFantasia?.trim() || linha.clienteRazao,
      vigenciaInicio: linha.vigenciaInicio,
      vigenciaFim: linha.vigenciaFim,
      prioridade: linha.prioridade,
      situacao: linha.situacao,
      situacaoRotulo: linha.situacao === 'ATIVA' ? 'Ativa' : 'Inativa',
      responsavel: linha.responsavel,
      criadoEm: iso(linha.criadoEm),
      atualizadoEm: iso(linha.atualizadoEm),
      origemCodigo: linha.origemCodigo,
    };
  }

  async historico(id: string) {
    await this.obter(this.db, id);
    const linhas = await this.db
      .select({
        operacao: auditoria.operacao,
        dadosAnteriores: auditoria.dadosAnteriores,
        dadosNovos: auditoria.dadosNovos,
        usuarioNome: usuarios.nome,
        criadoEm: auditoria.createdAt,
        justificativa: auditoria.justificativa,
      })
      .from(auditoria)
      .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(and(eq(auditoria.tabela, 'enquadramentos_fiscais'), eq(auditoria.registroId, id)))
      .orderBy(asc(auditoria.createdAt), asc(auditoria.id));
    const resposta = [];
    for (const linha of linhas) {
      const anterior = (linha.dadosAnteriores ?? {}) as { situacao?: string; versao?: number; cfopId?: string };
      const novo = (linha.dadosNovos ?? {}) as {
        situacao?: string;
        versao?: number;
        cfopId?: string;
        origemEnquadramentoId?: string | null;
      };
      resposta.push({
        operacao: linha.operacao,
        situacaoAnterior: anterior.situacao ?? null,
        situacaoNova: novo.situacao ?? null,
        usuarioNome: linha.usuarioNome ?? '',
        criadoEm: iso(linha.criadoEm),
        justificativa: linha.justificativa,
        resumo: await this.resumo(linha.operacao, anterior, novo),
        versao: novo.versao ?? anterior.versao ?? null,
      });
    }
    return resposta;
  }

  async criar(dto: CreateEnquadramentoDto, usuarioId: string) {
    const criada = await this.db.transaction(async (tx) => {
      const estab = await this.travarAprovado(tx, dto.estabelecimentoId);
      await this.exigirPreCondicoes(tx, dto);
      await this.garantirSemSobreposicao(
        tx, estab.id, chaveDe(dto), intervaloDe(dto.vigenciaInicio, dto.vigenciaFim),
      );
      const linha = await this.inserirComCodigo(tx, {
        empresaId: estab.empresaId,
        estabelecimentoId: estab.id,
        ...chaveDe(dto),
        vigenciaInicio: dto.vigenciaInicio,
        vigenciaFim: dto.vigenciaFim ?? null,
        prioridade: dto.prioridade,
        situacao: 'ATIVA',
        criadoPorId: usuarioId,
        atualizadoPorId: usuarioId,
      });
      await this.auditar(tx, 'INSERT', linha.id, usuarioId, null, linha, dto.justificativa);
      return linha;
    });
    this.emitir('criado', criada);
    return this.detalhar(criada.id);
  }

  async atualizar(id: string, dto: UpdateEnquadramentoDto, usuarioId: string) {
    const atualizada = await this.db.transaction(async (tx) => {
      const anterior = await this.obterBloqueado(tx, id);
      if (anterior.situacao !== 'ATIVA') transicaoInvalida(anterior.situacao);
      exigirVersao(anterior.versao, dto.versao);
      await this.travarAprovado(tx, anterior.estabelecimentoId);
      if (!mesmaChave(chaveDe(anterior), chaveDe(dto))) await this.exigirSemRegraVigente(tx, id);
      await this.exigirPreCondicoes(tx, dto);
      await this.garantirSemSobreposicao(
        tx, anterior.estabelecimentoId, chaveDe(dto), intervaloDe(dto.vigenciaInicio, dto.vigenciaFim), id,
      );
      const [linha] = await tx.update(enquadramentosFiscais).set({
        ...chaveDe(dto),
        vigenciaInicio: dto.vigenciaInicio,
        vigenciaFim: dto.vigenciaFim ?? null,
        prioridade: dto.prioridade,
        versao: sql`${enquadramentosFiscais.versao} + 1`,
        atualizadoPorId: usuarioId,
        updatedAt: new Date(),
      }).where(and(
        eq(enquadramentosFiscais.id, id),
        eq(enquadramentosFiscais.versao, dto.versao),
        isNull(enquadramentosFiscais.deletedAt),
      )).returning();
      if (!linha) conflitoConcorrente();
      await this.auditar(tx, 'UPDATE', id, usuarioId, anterior, linha, dto.justificativa);
      return linha;
    });
    this.emitir('atualizado', atualizada);
    return this.detalhar(atualizada.id);
  }

  async duplicar(id: string, dto: DuplicarEnquadramentoDto, usuarioId: string) {
    const copia = await this.db.transaction(async (tx) => {
      const origem = await this.obterBloqueado(tx, id);
      exigirVersao(origem.versao, dto.versao);
      const estab = await this.travarAprovado(tx, origem.estabelecimentoId);
      const chave = chaveDe(origem);
      await this.exigirPreCondicoes(tx, chave);
      const intervalo = intervaloDe(dto.vigenciaInicio, dto.vigenciaFim);
      await this.garantirSemSobreposicao(tx, origem.estabelecimentoId, chave, intervalo);
      const linha = await this.inserirComCodigo(tx, {
        empresaId: estab.empresaId,
        estabelecimentoId: origem.estabelecimentoId,
        ...chave,
        vigenciaInicio: dto.vigenciaInicio,
        vigenciaFim: dto.vigenciaFim ?? null,
        prioridade: dto.prioridade ?? origem.prioridade,
        situacao: 'ATIVA',
        origemEnquadramentoId: origem.id,
        criadoPorId: usuarioId,
        atualizadoPorId: usuarioId,
      });
      await this.auditar(tx, 'INSERT', linha.id, usuarioId, null, linha, dto.justificativa);
      return linha;
    });
    this.emitir('duplicado', copia);
    return this.detalhar(copia.id);
  }

  async inativar(id: string, dto: AcaoSituacaoDto, usuarioId: string) {
    const linha = await this.db.transaction(async (tx) => {
      const anterior = await this.obterBloqueado(tx, id);
      if (anterior.situacao !== 'ATIVA') transicaoInvalida(anterior.situacao);
      exigirVersao(anterior.versao, dto.versao);
      await this.travarAprovado(tx, anterior.estabelecimentoId);
      await this.exigirSemRegraVigente(tx, id);
      const [atualizada] = await tx.update(enquadramentosFiscais).set({
        situacao: 'INATIVA',
        justificativaSituacao: dto.justificativa,
        versao: sql`${enquadramentosFiscais.versao} + 1`,
        atualizadoPorId: usuarioId,
        updatedAt: new Date(),
      }).where(and(eq(enquadramentosFiscais.id, id), eq(enquadramentosFiscais.versao, dto.versao))).returning();
      if (!atualizada) conflitoConcorrente();
      await this.auditar(tx, 'UPDATE', id, usuarioId, anterior, atualizada, dto.justificativa);
      return atualizada;
    });
    this.emitir('inativado', linha);
    return this.detalhar(linha.id);
  }

  async reativar(id: string, dto: AcaoSituacaoDto, usuarioId: string) {
    const linha = await this.db.transaction(async (tx) => {
      const anterior = await this.obterBloqueado(tx, id);
      if (anterior.situacao !== 'INATIVA') transicaoInvalida(anterior.situacao);
      exigirVersao(anterior.versao, dto.versao);
      await this.travarAprovado(tx, anterior.estabelecimentoId);
      const chave = chaveDe(anterior);
      await this.exigirPreCondicoes(tx, chave);
      await this.garantirSemSobreposicao(
        tx, anterior.estabelecimentoId, chave, intervaloDe(anterior.vigenciaInicio, anterior.vigenciaFim), id,
      );
      const [atualizada] = await tx.update(enquadramentosFiscais).set({
        situacao: 'ATIVA',
        justificativaSituacao: dto.justificativa,
        versao: sql`${enquadramentosFiscais.versao} + 1`,
        atualizadoPorId: usuarioId,
        updatedAt: new Date(),
      }).where(and(eq(enquadramentosFiscais.id, id), eq(enquadramentosFiscais.versao, dto.versao))).returning();
      if (!atualizada) conflitoConcorrente();
      await this.auditar(tx, 'UPDATE', id, usuarioId, anterior, atualizada, dto.justificativa);
      return atualizada;
    });
    this.emitir('reativado', linha);
    return this.detalhar(linha.id);
  }

  async consultar(dto: ConsultaEnquadramentoDto) {
    const linhas = await this.db
      .select({
        codigo: enquadramentosFiscais.codigo,
        prioridade: enquadramentosFiscais.prioridade,
        vigenciaInicio: enquadramentosFiscais.vigenciaInicio,
        vigenciaFim: enquadramentosFiscais.vigenciaFim,
      })
      .from(enquadramentosFiscais)
      .where(and(
        eq(enquadramentosFiscais.estabelecimentoId, dto.estabelecimentoId),
        eq(enquadramentosFiscais.situacao, 'ATIVA'),
        isNull(enquadramentosFiscais.deletedAt),
        eq(enquadramentosFiscais.operacaoId, dto.operacaoId),
        eq(enquadramentosFiscais.tpNf, dto.tpNf),
        eq(enquadramentosFiscais.finNfe, dto.finNfe),
        eq(enquadramentosFiscais.cfopId, dto.cfopId),
        eq(enquadramentosFiscais.abrangencia, dto.abrangencia),
        eq(enquadramentosFiscais.tipoProduto, dto.tipoProduto),
        eq(enquadramentosFiscais.produtoId, dto.produtoId),
        eq(enquadramentosFiscais.ncmId, dto.ncmId),
        eq(enquadramentosFiscais.cest, dto.cest),
        eq(enquadramentosFiscais.clienteId, dto.clienteId),
        lte(enquadramentosFiscais.vigenciaInicio, dto.data),
        or(
          isNull(enquadramentosFiscais.vigenciaFim),
          gte(enquadramentosFiscais.vigenciaFim, dto.data),
        ),
      ))
      .orderBy(asc(codigoNumerico));

    const classificacao = classificarEnquadramentos(linhas);
    if (classificacao.tipo === 'empate') {
      regraViolada(
        'EMPATE_ENQUADRAMENTO',
        'Há mais de um enquadramento vigente para este critério. Nenhum foi escolhido.',
        { candidatos: linhas.map((linha) => ({ codigo: linha.codigo, prioridade: linha.prioridade })) },
      );
    }
    if (classificacao.tipo === 'unico') {
      const linha = linhas[0]!;
      regraViolada(
        'REGRA_APROVADA_AUSENTE',
        'O enquadramento foi localizado, mas o tributo não é resolvido nesta tela.',
        {
          enquadramentoLocalizado: {
            codigo: linha.codigo,
            vigenciaInicio: linha.vigenciaInicio,
            vigenciaFim: linha.vigenciaFim,
          },
        },
      );
    }
    regraViolada(
      'REGRA_APROVADA_AUSENTE',
      'Nenhum enquadramento vigente cobre o critério e não há regra tributária aprovada.',
      { enquadramentoLocalizado: null },
    );
  }

  async remover(id: string, dto: RemoverEnquadramentoDto, usuarioId: string) {
    const linha = await this.db.transaction(async (tx) => {
      const anterior = await this.obterBloqueado(tx, id);
      await this.travarAprovado(tx, anterior.estabelecimentoId);
      await this.exigirSemRegraVigente(tx, id);
      const agora = new Date();
      const [removida] = await tx.update(enquadramentosFiscais).set({
        deletedAt: agora,
        versao: sql`${enquadramentosFiscais.versao} + 1`,
        atualizadoPorId: usuarioId,
        updatedAt: agora,
      }).where(eq(enquadramentosFiscais.id, id)).returning();
      if (!removida) throw new NotFoundException('Enquadramento não encontrado');
      await this.auditar(tx, 'DELETE', id, usuarioId, anterior, removida, dto.justificativa);
      return removida;
    });
    this.emitir('removido', linha);
    return { codigo: linha.codigo, situacao: linha.situacao };
  }

  private whereLista(query: ListarEnquadramentosQuery) {
    const filtro = query.search?.trim();
    const termo = filtro ? `%${filtro.replace(/[%_]/g, '')}%` : undefined;
    return and(
      isNull(enquadramentosFiscais.deletedAt),
      query.estabelecimentoId ? eq(enquadramentosFiscais.estabelecimentoId, query.estabelecimentoId) : undefined,
      query.cfopId ? eq(enquadramentosFiscais.cfopId, query.cfopId) : undefined,
      query.produtoId ? eq(enquadramentosFiscais.produtoId, query.produtoId) : undefined,
      query.clienteId ? eq(enquadramentosFiscais.clienteId, query.clienteId) : undefined,
      termo
        ? sql`(
            ${enquadramentosFiscais.codigo} ILIKE ${termo}
            OR ${operacoes.rotulo} ILIKE ${termo}
            OR ${cfops.codigo} ILIKE ${termo}
            OR ${estabelecimentos.nome} ILIKE ${termo}
            OR ${produtos.nome} ILIKE ${termo}
            OR ${clientes.razaoSocial} ILIKE ${termo}
            OR coalesce(${clientes.nomeFantasia}, '') ILIKE ${termo}
          )`
        : undefined,
    );
  }

  /**
   * D9 (T03): regra em RASCUNHO, SUBMETIDA ou APROVADA lê CFOP e operação por este enquadramento. Mudar a chave,
   * inativar ou remover deixaria a regra imutável alterada ou órfã. O enquadramento já está travado
   * (FOR NO KEY UPDATE); as regras, em FOR SHARE, serializam com submeter/aprovar concorrentes.
   */
  private async exigirSemRegraVigente(tx: Tx, enquadramentoId: string) {
    const [regra] = await tx.select({ codigo: regrasTributarias.codigo }).from(regrasTributarias).where(and(
      eq(regrasTributarias.enquadramentoId, enquadramentoId),
      isNull(regrasTributarias.deletedAt),
      inArray(regrasTributarias.situacao, ['RASCUNHO', 'SUBMETIDA', 'APROVADA']),
    )).limit(1).for('share');
    if (regra) {
      conflito(
        'ENQUADRAMENTO_COM_REGRA_ATIVA',
        'Há regra tributária em rascunho, submetida ou aprovada neste enquadramento. Aposente ou remova a regra antes de alterar a chave, inativar ou remover o enquadramento.',
        { regraCodigo: regra.codigo },
      );
    }
  }

  private async travarAprovado(tx: Tx, estabelecimentoId: string) {
    const estab = await travarEstabelecimento(tx, estabelecimentoId);
    if (estab.situacao !== 'APPROVED') {
      regraViolada('ESTABELECIMENTO_NAO_APROVADO', 'O estabelecimento precisa estar aprovado.');
    }
    return estab;
  }

  private async exigirPreCondicoes(tx: Tx, chave: ChaveEnquadramento) {
    const [operacao] = await tx.select({ deletedAt: operacoes.deletedAt }).from(operacoes).where(eq(operacoes.id, chave.operacaoId)).for('share');
    if (!operacao || operacao.deletedAt) {
      regraViolada('OPERACAO_INDISPONIVEL', 'Operação indisponível.');
    }
    const [produto] = await tx.select({ status: produtos.status, deletedAt: produtos.deletedAt }).from(produtos).where(eq(produtos.id, chave.produtoId)).for('share');
    if (!produto || produto.deletedAt || produto.status !== 'ativo') {
      regraViolada('PRODUTO_INATIVO', 'Produto inativo ou removido.');
    }
    const [cliente] = await tx.select({ status: clientes.status, deletedAt: clientes.deletedAt }).from(clientes).where(eq(clientes.id, chave.clienteId)).for('share');
    if (!cliente || cliente.deletedAt || cliente.status !== 'ativo') {
      regraViolada('CLIENTE_INATIVO', 'Cliente inativo ou removido.');
    }
    const [cfop] = await tx.select({ deletedAt: cfops.deletedAt }).from(cfops).where(eq(cfops.id, chave.cfopId)).for('share');
    if (!cfop || cfop.deletedAt) regraViolada('CFOP_INDISPONIVEL', 'CFOP indisponível.');
    const [ncm] = await tx.select({ deletedAt: ncms.deletedAt }).from(ncms).where(eq(ncms.id, chave.ncmId)).for('share');
    if (!ncm || ncm.deletedAt) regraViolada('NCM_INDISPONIVEL', 'NCM indisponível.');
  }

  private async garantirSemSobreposicao(
    tx: Tx,
    estabelecimentoId: string,
    chave: ChaveEnquadramento,
    intervalo: Intervalo,
    ignorarId?: string,
  ) {
    const linhas = await tx.select({
      id: enquadramentosFiscais.id,
      codigo: enquadramentosFiscais.codigo,
      operacaoId: enquadramentosFiscais.operacaoId,
      tpNf: enquadramentosFiscais.tpNf,
      finNfe: enquadramentosFiscais.finNfe,
      cfopId: enquadramentosFiscais.cfopId,
      abrangencia: enquadramentosFiscais.abrangencia,
      tipoProduto: enquadramentosFiscais.tipoProduto,
      produtoId: enquadramentosFiscais.produtoId,
      ncmId: enquadramentosFiscais.ncmId,
      cest: enquadramentosFiscais.cest,
      clienteId: enquadramentosFiscais.clienteId,
      vigenciaInicio: enquadramentosFiscais.vigenciaInicio,
      vigenciaFim: enquadramentosFiscais.vigenciaFim,
      prioridade: enquadramentosFiscais.prioridade,
    }).from(enquadramentosFiscais).where(and(
      eq(enquadramentosFiscais.estabelecimentoId, estabelecimentoId),
      eq(enquadramentosFiscais.situacao, 'ATIVA'),
      isNull(enquadramentosFiscais.deletedAt),
      ignorarId ? ne(enquadramentosFiscais.id, ignorarId) : undefined,
    ));
    for (const linha of linhas) {
      if (!mesmaChave(chave, linha)) continue;
      if (!intervalosSobrepoem(intervalo, { inicio: linha.vigenciaInicio, fim: linha.vigenciaFim })) continue;
      conflito('ENQUADRAMENTO_SOBREPOSTO', 'Há vigência sobreposta para a mesma chave de enquadramento.', {
        conflito: {
          codigo: linha.codigo,
          vigenciaInicio: linha.vigenciaInicio,
          vigenciaFim: linha.vigenciaFim,
          prioridade: linha.prioridade,
        },
      });
    }
  }

  private async inserirComCodigo(tx: Tx, valores: Omit<typeof enquadramentosFiscais.$inferInsert, 'codigo'>): Promise<Linha> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('enquadramentos_fiscais.codigo'))`);
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      await tx.execute(sql`SAVEPOINT enq_codigo`);
      const gerado = await tx.execute(sql`
        SELECT (COALESCE(MAX(codigo::bigint), 0) + 1)::text AS proximo FROM enquadramentos_fiscais
      `);
      const codigo = String((gerado.rows[0] as { proximo: string }).proximo);
      try {
        const [linha] = await tx.insert(enquadramentosFiscais).values({ ...valores, codigo }).returning();
        await tx.execute(sql`RELEASE SAVEPOINT enq_codigo`);
        if (!linha) throw new Error('Falha ao gravar enquadramento');
        return linha;
      } catch (err) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT enq_codigo`);
        if (ehViolacaoUnica(err, 'uq_enquadramentos_codigo') && tentativa === 1) continue;
        if (ehViolacaoUnica(err, 'uq_enquadramentos_codigo')) conflitoConcorrente();
        throw err;
      }
    }
    conflitoConcorrente();
  }

  private async obter(tx: Tx, id: string): Promise<Linha> {
    const [linha] = await tx.select().from(enquadramentosFiscais).where(and(
      eq(enquadramentosFiscais.id, id),
      isNull(enquadramentosFiscais.deletedAt),
    ));
    if (!linha) throw new NotFoundException('Enquadramento não encontrado');
    return linha;
  }

  private async obterBloqueado(tx: Tx, id: string): Promise<Linha> {
    const [linha] = await tx.select().from(enquadramentosFiscais).where(and(
      eq(enquadramentosFiscais.id, id),
      isNull(enquadramentosFiscais.deletedAt),
    )).for('no key update');
    if (!linha) throw new NotFoundException('Enquadramento não encontrado');
    return linha;
  }

  private async auditar(
    tx: Tx,
    operacao: 'INSERT' | 'UPDATE' | 'DELETE',
    registroId: string,
    usuarioId: string,
    anterior: Linha | null,
    novo: Linha,
    justificativa: string,
  ) {
    await this.auditoriaSvc.registrar(tx, {
      tabela: 'enquadramentos_fiscais',
      registroId,
      operacao,
      modulo: MODULO,
      usuarioId,
      dadosAnteriores: anterior,
      dadosNovos: novo,
      justificativa,
    });
  }

  private emitir(acao: AcaoEnquadramentoFiscal, linha: Linha) {
    this.eventos.emit(EVENTOS.ENQUADRAMENTO_FISCAL_ALTERADO, {
      enquadramentoId: linha.id,
      estabelecimentoId: linha.estabelecimentoId,
      empresaId: linha.empresaId,
      acao,
      situacao: linha.situacao,
    });
  }

  private async resumo(
    operacao: string,
    anterior: { situacao?: string; cfopId?: string },
    novo: { situacao?: string; cfopId?: string; origemEnquadramentoId?: string | null },
  ): Promise<string> {
    if (operacao === 'DELETE') return 'Removido';
    if (operacao === 'INSERT' && novo.origemEnquadramentoId) {
      const [origem] = await this.db.select({ codigo: enquadramentosFiscais.codigo })
        .from(enquadramentosFiscais)
        .where(eq(enquadramentosFiscais.id, novo.origemEnquadramentoId));
      return `Perfil duplicado do código ${origem?.codigo ?? ''}`;
    }
    if (operacao === 'INSERT') return 'Enquadramento cadastrado';
    if (anterior.situacao === 'ATIVA' && novo.situacao === 'INATIVA') return 'Inativado';
    if (anterior.situacao === 'INATIVA' && novo.situacao === 'ATIVA') return 'Reativado';
    if (anterior.cfopId && novo.cfopId && anterior.cfopId !== novo.cfopId) return 'CFOP alterado';
    return 'Enquadramento atualizado';
  }
}
