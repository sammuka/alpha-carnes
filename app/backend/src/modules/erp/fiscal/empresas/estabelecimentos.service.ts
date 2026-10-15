import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { montarPaginado } from '../../../../common/crud/paginacao';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  auditoria,
  empresas,
  estabelecimentoAlteracaoCnaes,
  estabelecimentoAlteracoes,
  estabelecimentoCnaes,
  estabelecimentos,
  regimesTributarios,
  usuarios,
} from '../../../../database/schema';
import {
  EVENTOS,
  type AcaoCadastroFiscal,
} from '../../../../realtime/events/eventos';
import { substituirCnaes } from './cnaes.service';
import { montarCsvEstabelecimentos } from './exportacao-csv';
import type { AcaoDecisaoDto, RemoverDto } from './dto/comum.dto';
import type {
  CreateEstabelecimentoDto,
  ListarEstabelecimentosQuery,
  SubstituirCnaesDto,
  UpdateEstabelecimentoDto,
} from './dto/estabelecimento.dto';
import {
  conflito,
  ehViolacaoUnica,
  exigirSegregacao,
  exigirVersao,
  MODULO_AUDITORIA,
  regraViolada,
  transicaoInvalida,
  travarEstabelecimento,
  type Estabelecimento,
  type Tx,
} from './fiscal-comum';

type Db = NodePgDatabase<typeof schema>;

const OBJETOS: Record<string, string> = {
  empresas: 'empresa',
  estabelecimentos: 'estabelecimento',
  estabelecimento_cnaes: 'cnae',
  estabelecimento_alteracoes: 'alteracao',
  estabelecimento_alteracao_cnaes: 'cnae',
  regimes_tributarios: 'regime',
};

@Injectable()
export class EstabelecimentosService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async listar(query: ListarEstabelecimentosQuery) {
    await this.validarFiltroEmpresa(query.empresaId, query.estabelecimentoId);
    const where = this.whereLista(query);
    const ordem = query.dir === 'desc' ? sql`DESC` : sql`ASC`;
    const coluna = {
      estabelecimento: sql`e.nome`,
      cnpj: sql`e.cnpj`,
      regime: sql`regime.crt`,
      uf: sql`e.uf`,
      empresa: sql`emp.razao_social`,
    }[query.sort];
    const total = await this.db.execute(sql`
      SELECT count(*)::int AS total
      FROM estabelecimentos e
      INNER JOIN empresas emp ON emp.id = e.empresa_id AND emp.deleted_at IS NULL
      WHERE ${where}
    `);
    const linhas = await this.db.execute(sql`
      SELECT e.id, e.empresa_id AS "empresaId", e.nome, e.cnpj, e.uf, e.situacao, e.versao,
             emp.razao_social AS "razaoSocial",
             regime.crt AS "regimeCrt",
             regime.vigencia_inicio AS "vigenciaInicio",
             regime.vigencia_fim AS "vigenciaFim"
      FROM estabelecimentos e
      INNER JOIN empresas emp ON emp.id = e.empresa_id AND emp.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT r.crt, r.vigencia_inicio, r.vigencia_fim
        FROM regimes_tributarios r
        WHERE r.estabelecimento_id = e.id
          AND r.deleted_at IS NULL
          AND r.situacao = 'APPROVED'
          AND r.vigencia_inicio <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
          AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
        ORDER BY r.vigencia_inicio DESC
        LIMIT 1
      ) regime ON true
      WHERE ${where}
      ORDER BY ${coluna} ${ordem} NULLS LAST, e.nome ASC
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
    `);
    const data = linhas.rows.map((raw) => {
      const linha = raw as Record<string, unknown>;
      return {
        id: linha.id,
        empresaId: linha.empresaId,
        nome: linha.nome,
        cnpj: linha.cnpj,
        uf: linha.uf,
        situacao: linha.situacao,
        versao: linha.versao,
        empresa: { razaoSocial: linha.razaoSocial },
        regime: linha.regimeCrt
          ? { crt: linha.regimeCrt, vigenciaInicio: linha.vigenciaInicio, vigenciaFim: linha.vigenciaFim }
          : null,
      };
    });
    return montarPaginado(data, Number((total.rows[0] as { total?: number } | undefined)?.total ?? 0), query);
  }

  async exportar(query: ListarEstabelecimentosQuery): Promise<string> {
    await this.validarFiltroEmpresa(query.empresaId, query.estabelecimentoId);
    const where = this.whereLista(query);
    const linhas = await this.db.execute(sql`
      SELECT e.nome, e.cnpj, e.uf, e.situacao,
             emp.razao_social AS "razaoSocial",
             regime.crt AS "regimeCrt"
      FROM estabelecimentos e
      INNER JOIN empresas emp ON emp.id = e.empresa_id AND emp.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT r.crt
        FROM regimes_tributarios r
        WHERE r.estabelecimento_id = e.id
          AND r.deleted_at IS NULL
          AND r.situacao = 'APPROVED'
          AND r.vigencia_inicio <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
          AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
        ORDER BY r.vigencia_inicio DESC
        LIMIT 1
      ) regime ON true
      WHERE ${where}
      ORDER BY e.nome ASC
    `);
    return montarCsvEstabelecimentos(linhas.rows.map((raw) => {
      const linha = raw as {
        nome: string;
        cnpj: string;
        uf: string;
        situacao: string;
        razaoSocial: string;
        regimeCrt: string | null;
      };
      return {
        nome: linha.nome,
        cnpj: linha.cnpj,
        crt: linha.regimeCrt,
        uf: linha.uf,
        situacao: linha.situacao,
        empresa: linha.razaoSocial,
      };
    }));
  }

  async contagens(query: ListarEstabelecimentosQuery) {
    await this.validarFiltroEmpresa(query.empresaId, query.estabelecimentoId);
    const where = this.whereLista(query);
    const resultado = await this.db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE e.situacao = 'REVIEW')::int AS "emRevisaoEstab",
        count(*) FILTER (WHERE e.situacao = 'SUSPENDED')::int AS suspensos,
        (
          SELECT count(*)::int FROM estabelecimento_alteracoes a
          INNER JOIN estabelecimentos e ON e.id = a.estabelecimento_id
          INNER JOIN empresas emp ON emp.id = e.empresa_id AND emp.deleted_at IS NULL
          WHERE a.deleted_at IS NULL AND a.situacao = 'REVIEW' AND ${where}
        ) AS "emRevisaoAlteracao"
      FROM estabelecimentos e
      INNER JOIN empresas emp ON emp.id = e.empresa_id AND emp.deleted_at IS NULL
      WHERE ${where}
    `);
    const linha = (resultado.rows[0] ?? {}) as {
      total?: number;
      emRevisaoEstab?: number;
      suspensos?: number;
      emRevisaoAlteracao?: number;
    };
    return {
      total: Number(linha.total ?? 0),
      emRevisao: Number(linha.emRevisaoEstab ?? 0) + Number(linha.emRevisaoAlteracao ?? 0),
      suspensos: Number(linha.suspensos ?? 0),
    };
  }

  async detalhar(id: string) {
    const estab = await this.obter(this.db, id);
    const [empresa] = await this.db
      .select({ id: empresas.id, razaoSocial: empresas.razaoSocial, cnpjRaiz: empresas.cnpjRaiz })
      .from(empresas)
      .where(eq(empresas.id, estab.empresaId));
    const cnaes = await this.db
      .select({
        id: estabelecimentoCnaes.id,
        codigo: estabelecimentoCnaes.codigo,
        descricao: estabelecimentoCnaes.descricao,
        tipo: estabelecimentoCnaes.tipo,
      })
      .from(estabelecimentoCnaes)
      .where(and(eq(estabelecimentoCnaes.estabelecimentoId, id), isNull(estabelecimentoCnaes.deletedAt)));
    const regimes = await this.db
      .select()
      .from(regimesTributarios)
      .where(and(eq(regimesTributarios.estabelecimentoId, id), isNull(regimesTributarios.deletedAt)));
    const [aberta] = await this.db
      .select()
      .from(estabelecimentoAlteracoes)
      .where(and(
        eq(estabelecimentoAlteracoes.estabelecimentoId, id),
        isNull(estabelecimentoAlteracoes.deletedAt),
        inArray(estabelecimentoAlteracoes.situacao, ['DRAFT', 'REVIEW']),
      ));
    const cnaesAlteracao = aberta
      ? await this.db
        .select({
          codigo: estabelecimentoAlteracaoCnaes.codigo,
          descricao: estabelecimentoAlteracaoCnaes.descricao,
          tipo: estabelecimentoAlteracaoCnaes.tipo,
        })
        .from(estabelecimentoAlteracaoCnaes)
        .where(and(
          eq(estabelecimentoAlteracaoCnaes.alteracaoId, aberta.id),
          isNull(estabelecimentoAlteracaoCnaes.deletedAt),
        ))
      : [];
    const responsavelId = estab.decididoPorId ?? estab.submetidoPorId ?? estab.criadoPorId;
    const [responsavel] = await this.db
      .select({ nome: usuarios.nome })
      .from(usuarios)
      .where(eq(usuarios.id, responsavelId));
    return {
      id: estab.id,
      empresaId: estab.empresaId,
      nome: estab.nome,
      cnpj: estab.cnpj,
      inscricaoEstadual: estab.inscricaoEstadual,
      inscricaoMunicipal: estab.inscricaoMunicipal,
      uf: estab.uf,
      municipioIbgeCodigo: estab.municipioIbgeCodigo,
      situacao: estab.situacao,
      versao: estab.versao,
      justificativaSituacao: estab.justificativaSituacao,
      empresa: empresa ?? null,
      cnaes,
      regimes: regimes.map((regime) => ({
        id: regime.id,
        crt: regime.crt,
        vigenciaInicio: regime.vigenciaInicio,
        vigenciaFim: regime.vigenciaFim,
        situacao: regime.situacao,
        versao: regime.versao,
      })),
      alteracaoAberta: aberta
        ? {
          id: aberta.id,
          nome: aberta.nome,
          inscricaoEstadual: aberta.inscricaoEstadual,
          inscricaoMunicipal: aberta.inscricaoMunicipal,
          uf: aberta.uf,
          situacao: aberta.situacao,
          versao: aberta.versao,
          versaoBase: aberta.versaoBase,
          cnaes: cnaesAlteracao,
        }
        : null,
      responsavel: { nome: responsavel?.nome ?? '' },
    };
  }

  async historico(id: string) {
    const estab = await this.obter(this.db, id);
    const cnaes = await this.db
      .select({ id: estabelecimentoCnaes.id })
      .from(estabelecimentoCnaes)
      .where(eq(estabelecimentoCnaes.estabelecimentoId, id));
    const alteracoes = await this.db
      .select({ id: estabelecimentoAlteracoes.id })
      .from(estabelecimentoAlteracoes)
      .where(eq(estabelecimentoAlteracoes.estabelecimentoId, id));
    const altIds = alteracoes.map((linha) => linha.id);
    const cnaesAlt = altIds.length
      ? await this.db
        .select({ id: estabelecimentoAlteracaoCnaes.id })
        .from(estabelecimentoAlteracaoCnaes)
        .where(inArray(estabelecimentoAlteracaoCnaes.alteracaoId, altIds))
      : [];
    const regimes = await this.db
      .select({ id: regimesTributarios.id })
      .from(regimesTributarios)
      .where(eq(regimesTributarios.estabelecimentoId, id));
    const condicoes = [
      and(eq(auditoria.tabela, 'empresas'), eq(auditoria.registroId, estab.empresaId)),
      and(eq(auditoria.tabela, 'estabelecimentos'), eq(auditoria.registroId, id)),
    ];
    const cnaeIds = cnaes.map((linha) => linha.id);
    if (cnaeIds.length) condicoes.push(and(eq(auditoria.tabela, 'estabelecimento_cnaes'), inArray(auditoria.registroId, cnaeIds)));
    if (altIds.length) condicoes.push(and(eq(auditoria.tabela, 'estabelecimento_alteracoes'), inArray(auditoria.registroId, altIds)));
    const altCnaeIds = cnaesAlt.map((linha) => linha.id);
    if (altCnaeIds.length) {
      condicoes.push(and(eq(auditoria.tabela, 'estabelecimento_alteracao_cnaes'), inArray(auditoria.registroId, altCnaeIds)));
    }
    const regimeIds = regimes.map((linha) => linha.id);
    if (regimeIds.length) condicoes.push(and(eq(auditoria.tabela, 'regimes_tributarios'), inArray(auditoria.registroId, regimeIds)));
    const linhas = await this.db
      .select({
        tabela: auditoria.tabela,
        operacao: auditoria.operacao,
        dadosAnteriores: auditoria.dadosAnteriores,
        dadosNovos: auditoria.dadosNovos,
        justificativa: auditoria.justificativa,
        criadoEm: auditoria.createdAt,
        usuarioNome: usuarios.nome,
      })
      .from(auditoria)
      .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(or(...condicoes))
      .orderBy(desc(auditoria.createdAt), desc(auditoria.id));
    return linhas.map((linha) => {
      const antes = linha.dadosAnteriores as { situacao?: string };
      const depois = linha.dadosNovos as { situacao?: string };
      const objeto = OBJETOS[linha.tabela] ?? 'cadastro';
      return {
        objeto,
        operacao: linha.operacao,
        situacaoAnterior: antes?.situacao ?? null,
        situacaoNova: depois?.situacao ?? null,
        usuarioNome: linha.usuarioNome ?? '',
        criadoEm: linha.criadoEm,
        justificativa: linha.justificativa,
        resumo: `${linha.operacao} ${objeto}`,
      };
    });
  }

  async preCondicoes(id: string) {
    const detalhe = await this.detalhar(id);
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const regimeVigente = detalhe.regimes.some((regime) =>
      regime.situacao === 'APPROVED'
      && regime.vigenciaInicio <= hoje
      && (regime.vigenciaFim === null || regime.vigenciaFim >= hoje));
    return [
      { codigo: 'ESTABELECIMENTO_APROVADO', atendida: detalhe.situacao === 'APPROVED', provisoria: false },
      { codigo: 'REGIME_VIGENTE_APROVADO', atendida: regimeVigente, provisoria: false },
      { codigo: 'CNAE_PRINCIPAL_INFORMADO', atendida: detalhe.cnaes.some((cnae) => cnae.tipo === 'PRINCIPAL'), provisoria: false },
      { codigo: 'MUNICIPIO_INFORMADO', atendida: detalhe.municipioIbgeCodigo !== null, provisoria: true },
      { codigo: 'CERTIFICADO_VINCULADO', atendida: false, provisoria: true },
    ];
  }

  async criar(dto: CreateEstabelecimentoDto, usuarioId: string) {
    try {
      const criado = await this.db.transaction(async (tx) => {
        const [empresa] = await tx
          .select()
          .from(empresas)
          .where(and(eq(empresas.id, dto.empresaId), isNull(empresas.deletedAt)))
          .for('update'); // serializa com remover empresa (a FK só toma KEY SHARE)
        if (!empresa) throw new NotFoundException('Empresa não encontrada');
        if (dto.cnpj.slice(0, 8) !== empresa.cnpjRaiz) {
          regraViolada('CNPJ_RAIZ_DIVERGENTE', 'A raiz do CNPJ do estabelecimento difere da empresa.');
        }
        const [linha] = await tx
          .insert(estabelecimentos)
          .values({
            empresaId: empresa.id,
            nome: dto.nome,
            cnpj: dto.cnpj,
            inscricaoEstadual: dto.inscricaoEstadual,
            inscricaoMunicipal: dto.inscricaoMunicipal,
            uf: dto.uf,
            criadoPorId: usuarioId,
            atualizadoPorId: usuarioId,
          })
          .returning();
        if (!linha) throw new Error('Falha ao gravar estabelecimento');
        await this.auditoria.registrar(tx, {
          tabela: 'estabelecimentos',
          registroId: linha.id,
          operacao: 'INSERT',
          modulo: MODULO_AUDITORIA,
          usuarioId,
          dadosNovos: linha,
          justificativa: dto.justificativa,
        });
        if (dto.cnaes?.length) {
          await substituirCnaes(
            tx, this.auditoria,
            { estabelecimentoId: linha.id, empresaId: empresa.id },
            dto.cnaes, usuarioId, dto.justificativa,
          );
        }
        return linha;
      });
      this.emitir(criado.empresaId, criado.id, 'criado', criado.situacao);
      return this.detalhar(criado.id);
    } catch (err) {
      if (ehViolacaoUnica(err, 'uq_estabelecimentos_cnpj')) {
        conflito('CNPJ_DUPLICADO', 'Já existe estabelecimento com este CNPJ.');
      }
      throw err;
    }
  }

  async atualizar(id: string, dto: UpdateEstabelecimentoDto, usuarioId: string) {
    const atualizado = await this.db.transaction(async (tx) => {
      const atual = await travarEstabelecimento(tx, id);
      this.exigirEditavel(atual);
      exigirVersao(atual.versao, dto.versao);
      const [linha] = await tx
        .update(estabelecimentos)
        .set({
          nome: dto.nome ?? atual.nome,
          inscricaoEstadual: dto.inscricaoEstadual ?? atual.inscricaoEstadual,
          inscricaoMunicipal: dto.inscricaoMunicipal ?? atual.inscricaoMunicipal,
          uf: dto.uf ?? atual.uf,
          situacao: 'DRAFT',
          justificativaSituacao: null,
          versao: sql`${estabelecimentos.versao} + 1`,
          atualizadoPorId: usuarioId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(estabelecimentos.id, id),
          eq(estabelecimentos.versao, dto.versao),
          isNull(estabelecimentos.deletedAt),
        ))
        .returning();
      if (!linha) conflito('CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.');
      await this.auditar(tx, 'UPDATE', atual, linha, usuarioId, dto.justificativa);
      return linha;
    });
    this.emitir(atualizado.empresaId, atualizado.id, 'atualizado', atualizado.situacao);
    return this.detalhar(id);
  }

  async substituirListaCnaes(id: string, dto: SubstituirCnaesDto, usuarioId: string) {
    const atualizado = await this.db.transaction(async (tx) => {
      const atual = await travarEstabelecimento(tx, id);
      if (atual.situacao === 'APPROVED') {
        conflito('ALTERACAO_EXIGIDA', 'Estabelecimento aprovado só muda por uma alteração.');
      }
      if (atual.situacao !== 'DRAFT' && atual.situacao !== 'REJECTED') transicaoInvalida(atual.situacao);
      exigirVersao(atual.versao, dto.versao);
      await substituirCnaes(
        tx, this.auditoria,
        { estabelecimentoId: atual.id, empresaId: atual.empresaId },
        dto.cnaes, usuarioId, dto.justificativa,
      );
      const [linha] = await tx
        .update(estabelecimentos)
        .set({
          situacao: 'DRAFT',
          justificativaSituacao: null,
          versao: sql`${estabelecimentos.versao} + 1`,
          atualizadoPorId: usuarioId,
          updatedAt: new Date(),
        })
        .where(and(eq(estabelecimentos.id, id), eq(estabelecimentos.versao, dto.versao), isNull(estabelecimentos.deletedAt)))
        .returning();
      if (!linha) conflito('CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.');
      await this.auditar(tx, 'UPDATE', atual, linha, usuarioId, dto.justificativa);
      return linha;
    });
    this.emitir(atualizado.empresaId, atualizado.id, 'cnaes_atualizados', atualizado.situacao);
    return this.detalhar(id);
  }

  async submeter(id: string, dto: AcaoDecisaoDto, usuarioId: string) {
    return this.transitar(id, dto, usuarioId, 'DRAFT', 'REVIEW', 'submetido', {
      submetidoPorId: usuarioId,
      justificativaSituacao: null,
    });
  }

  async aprovar(id: string, dto: AcaoDecisaoDto, usuarioId: string) {
    const linha = await this.db.transaction(async (tx) => {
      const atual = await travarEstabelecimento(tx, id);
      if (atual.situacao !== 'REVIEW') transicaoInvalida(atual.situacao);
      exigirVersao(atual.versao, dto.versao);
      exigirSegregacao(atual.submetidoPorId, usuarioId);
      const principais = await tx
        .select({ id: estabelecimentoCnaes.id })
        .from(estabelecimentoCnaes)
        .where(and(
          eq(estabelecimentoCnaes.estabelecimentoId, id),
          eq(estabelecimentoCnaes.tipo, 'PRINCIPAL'),
          isNull(estabelecimentoCnaes.deletedAt),
        ));
      if (principais.length !== 1) {
        regraViolada('CNAE_PRINCIPAL_AUSENTE', 'A aprovação exige exatamente um CNAE principal.');
      }
      return this.gravarSituacao(tx, atual, dto.versao, usuarioId, {
        situacao: 'APPROVED',
        justificativaSituacao: null,
        decididoPorId: usuarioId,
        decididoEm: new Date(),
      }, dto.justificativa, 'ACAO_MANUAL');
    });
    this.emitir(linha.empresaId, linha.id, 'aprovado', linha.situacao);
    return this.detalhar(id);
  }

  async rejeitar(id: string, dto: AcaoDecisaoDto, usuarioId: string) {
    return this.transitar(id, dto, usuarioId, 'REVIEW', 'REJECTED', 'rejeitado', {
      justificativaSituacao: dto.justificativa,
      decididoPorId: usuarioId,
      decididoEm: new Date(),
    }, true);
  }

  async suspender(id: string, dto: AcaoDecisaoDto, usuarioId: string) {
    return this.transitar(id, dto, usuarioId, 'APPROVED', 'SUSPENDED', 'suspenso', {
      justificativaSituacao: dto.justificativa,
      decididoPorId: usuarioId,
      decididoEm: new Date(),
    });
  }

  async reativar(id: string, dto: AcaoDecisaoDto, usuarioId: string) {
    return this.transitar(id, dto, usuarioId, 'SUSPENDED', 'REVIEW', 'reativado', {
      submetidoPorId: usuarioId,
      justificativaSituacao: null,
    });
  }

  async remover(id: string, dto: RemoverDto, usuarioId: string) {
    const removido = await this.db.transaction(async (tx) => {
      const atual = await travarEstabelecimento(tx, id);
      if (atual.situacao !== 'DRAFT' && atual.situacao !== 'REJECTED') transicaoInvalida(atual.situacao);
      const regimes = await tx
        .select()
        .from(regimesTributarios)
        .where(and(eq(regimesTributarios.estabelecimentoId, id), isNull(regimesTributarios.deletedAt)));
      if (regimes.some((regime) => regime.situacao === 'REVIEW' || regime.situacao === 'APPROVED')) {
        conflito('ESTABELECIMENTO_COM_REGIME_ATIVO', 'Estabelecimento com regime em revisão ou aprovado não pode ser removido.');
      }
      const agora = new Date();
      for (const regime of regimes) {
        await this.apagarLinha(tx, regimesTributarios, regime, 'regimes_tributarios', usuarioId, dto.justificativa, agora);
      }
      const cnaes = await tx
        .select()
        .from(estabelecimentoCnaes)
        .where(and(eq(estabelecimentoCnaes.estabelecimentoId, id), isNull(estabelecimentoCnaes.deletedAt)));
      for (const cnae of cnaes) {
        await this.apagarLinha(tx, estabelecimentoCnaes, cnae, 'estabelecimento_cnaes', usuarioId, dto.justificativa, agora);
      }
      const abertas = await tx
        .select()
        .from(estabelecimentoAlteracoes)
        .where(and(
          eq(estabelecimentoAlteracoes.estabelecimentoId, id),
          isNull(estabelecimentoAlteracoes.deletedAt),
          inArray(estabelecimentoAlteracoes.situacao, ['DRAFT', 'REVIEW']),
        ));
      for (const alteracao of abertas) {
        const propostos = await tx
          .select()
          .from(estabelecimentoAlteracaoCnaes)
          .where(and(
            eq(estabelecimentoAlteracaoCnaes.alteracaoId, alteracao.id),
            isNull(estabelecimentoAlteracaoCnaes.deletedAt),
          ));
        for (const proposto of propostos) {
          await this.apagarLinha(
            tx, estabelecimentoAlteracaoCnaes, proposto, 'estabelecimento_alteracao_cnaes',
            usuarioId, dto.justificativa, agora,
          );
        }
        await this.apagarLinha(tx, estabelecimentoAlteracoes, alteracao, 'estabelecimento_alteracoes', usuarioId, dto.justificativa, agora);
      }
      const [linha] = await tx
        .update(estabelecimentos)
        .set({ deletedAt: agora, atualizadoPorId: usuarioId, updatedAt: agora, versao: sql`${estabelecimentos.versao} + 1` })
        .where(eq(estabelecimentos.id, id))
        .returning();
      if (!linha) throw new Error('Falha ao remover estabelecimento');
      await this.auditar(tx, 'DELETE', atual, linha, usuarioId, dto.justificativa);
      return linha;
    });
    this.emitir(removido.empresaId, removido.id, 'removido', removido.situacao);
    return { id: removido.id };
  }

  /** D16: leitura fiscal dos valores aprovados. Sem aprovação de estabelecimento e regime vigente, null. */
  async dadosFiscaisVigentes(db: Db | Tx, estabelecimentoId: string, dataIso: string) {
    const [estab] = await db
      .select()
      .from(estabelecimentos)
      .where(and(
        eq(estabelecimentos.id, estabelecimentoId),
        eq(estabelecimentos.situacao, 'APPROVED'),
        isNull(estabelecimentos.deletedAt),
      ));
    if (!estab) return null;
    const [regime] = await db
      .select()
      .from(regimesTributarios)
      .where(and(
        eq(regimesTributarios.estabelecimentoId, estabelecimentoId),
        eq(regimesTributarios.situacao, 'APPROVED'),
        isNull(regimesTributarios.deletedAt),
        sql`${regimesTributarios.vigenciaInicio} <= ${dataIso}`,
        sql`(${regimesTributarios.vigenciaFim} IS NULL OR ${regimesTributarios.vigenciaFim} >= ${dataIso})`,
      ))
      .limit(1);
    if (!regime) return null;
    const [cnae] = await db
      .select()
      .from(estabelecimentoCnaes)
      .where(and(
        eq(estabelecimentoCnaes.estabelecimentoId, estabelecimentoId),
        eq(estabelecimentoCnaes.tipo, 'PRINCIPAL'),
        isNull(estabelecimentoCnaes.deletedAt),
      ))
      .limit(1);
    if (!cnae) return null;
    return {
      cnpj: estab.cnpj,
      inscricaoEstadual: estab.inscricaoEstadual,
      uf: estab.uf,
      crt: regime.crt,
      cnaePrincipal: cnae.codigo,
    };
  }

  private async transitar(
    id: string,
    dto: AcaoDecisaoDto,
    usuarioId: string,
    de: Estabelecimento['situacao'],
    para: Estabelecimento['situacao'],
    acao: AcaoCadastroFiscal,
    extras: Partial<Estabelecimento>,
    segregar = false,
  ) {
    const linha = await this.db.transaction(async (tx) => {
      const atual = await travarEstabelecimento(tx, id);
      if (atual.situacao !== de) transicaoInvalida(atual.situacao);
      exigirVersao(atual.versao, dto.versao);
      if (segregar) exigirSegregacao(atual.submetidoPorId, usuarioId);
      return this.gravarSituacao(tx, atual, dto.versao, usuarioId, { situacao: para, ...extras }, dto.justificativa, 'ACAO_MANUAL');
    });
    this.emitir(linha.empresaId, linha.id, acao, linha.situacao);
    return this.detalhar(id);
  }

  private async gravarSituacao(
    tx: Tx,
    atual: Estabelecimento,
    versao: number,
    usuarioId: string,
    extras: Partial<typeof estabelecimentos.$inferInsert>,
    justificativa: string,
    operacao: 'UPDATE' | 'ACAO_MANUAL',
  ) {
    const [linha] = await tx
      .update(estabelecimentos)
      .set({
        ...extras,
        versao: sql`${estabelecimentos.versao} + 1`,
        atualizadoPorId: usuarioId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(estabelecimentos.id, atual.id),
        eq(estabelecimentos.versao, versao),
        isNull(estabelecimentos.deletedAt),
      ))
      .returning();
    if (!linha) conflito('CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.');
    await this.auditar(tx, operacao, atual, linha, usuarioId, justificativa);
    return linha;
  }

  private exigirEditavel(atual: Estabelecimento): void {
    if (atual.situacao === 'APPROVED') {
      conflito('ALTERACAO_EXIGIDA', 'Estabelecimento aprovado só muda por uma alteração.');
    }
    if (atual.situacao !== 'DRAFT' && atual.situacao !== 'REJECTED') transicaoInvalida(atual.situacao);
  }

  private async obter(db: Db | Tx, id: string) {
    const [linha] = await db
      .select()
      .from(estabelecimentos)
      .where(and(eq(estabelecimentos.id, id), isNull(estabelecimentos.deletedAt)));
    if (!linha) throw new NotFoundException('Estabelecimento não encontrado');
    return linha;
  }

  private async validarFiltroEmpresa(empresaId?: string, estabelecimentoId?: string) {
    if (!empresaId || !estabelecimentoId) return;
    const [linha] = await this.db
      .select({ empresaId: estabelecimentos.empresaId })
      .from(estabelecimentos)
      .where(eq(estabelecimentos.id, estabelecimentoId));
    if (!linha) throw new NotFoundException('Estabelecimento não encontrado');
    if (linha.empresaId !== empresaId) {
      regraViolada('ESTABELECIMENTO_DE_OUTRA_EMPRESA', 'O estabelecimento não pertence à empresa informada.');
    }
  }

  private whereLista(query: ListarEstabelecimentosQuery) {
    const like = query.search ? `%${query.search.replace(/[%_]/g, '')}%` : null;
    // CNPJ é gravado sem máscara: a busca pelo formato exibido na grade (12.345.678/0001-95) remove . / - e espaços.
    const cnpjTermo = query.search ? query.search.replace(/[%_./\-\s]/g, '') : '';
    return sql`
      e.deleted_at IS NULL
      ${query.empresaId ? sql`AND e.empresa_id = ${query.empresaId}` : sql``}
      ${query.estabelecimentoId ? sql`AND e.id = ${query.estabelecimentoId}` : sql``}
      ${query.situacao ? sql`AND e.situacao = ${query.situacao}` : sql``}
      ${like ? sql`AND (e.nome ILIKE ${like} ${cnpjTermo ? sql`OR e.cnpj ILIKE ${`%${cnpjTermo}%`}` : sql``} OR emp.razao_social ILIKE ${like})` : sql``}
    `;
  }

  private async apagarLinha(
    tx: Tx,
    tabela: typeof regimesTributarios | typeof estabelecimentoCnaes | typeof estabelecimentoAlteracoes | typeof estabelecimentoAlteracaoCnaes,
    anterior: { id: string },
    nome: string,
    usuarioId: string,
    justificativa: string,
    agora: Date,
  ) {
    const [linha] = await tx
      .update(tabela)
      .set({ deletedAt: agora, atualizadoPorId: usuarioId, updatedAt: agora })
      .where(eq(tabela.id, anterior.id))
      .returning();
    await this.auditoria.registrar(tx, {
      tabela: nome,
      registroId: anterior.id,
      operacao: 'DELETE',
      modulo: MODULO_AUDITORIA,
      usuarioId,
      dadosAnteriores: anterior,
      dadosNovos: linha,
      justificativa,
    });
  }

  private async auditar(
    tx: Tx,
    operacao: 'INSERT' | 'UPDATE' | 'DELETE' | 'ACAO_MANUAL',
    anterior: Estabelecimento,
    novo: Estabelecimento,
    usuarioId: string,
    justificativa: string,
  ) {
    await this.auditoria.registrar(tx, {
      tabela: 'estabelecimentos',
      registroId: anterior.id,
      operacao,
      modulo: MODULO_AUDITORIA,
      usuarioId,
      dadosAnteriores: anterior,
      dadosNovos: novo,
      justificativa,
    });
  }

  private emitir(empresaId: string, estabelecimentoId: string, acao: AcaoCadastroFiscal, situacao?: string) {
    this.eventos.emit(EVENTOS.ESTABELECIMENTO_FISCAL_ALTERADO, {
      empresaId,
      estabelecimentoId,
      acao,
      situacao,
    });
  }
}
