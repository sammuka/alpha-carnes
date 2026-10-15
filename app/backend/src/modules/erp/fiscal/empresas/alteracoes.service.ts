import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  estabelecimentoAlteracaoCnaes,
  estabelecimentoAlteracoes,
  estabelecimentos,
} from '../../../../database/schema';
import { EVENTOS, type AcaoCadastroFiscal } from '../../../../realtime/events/eventos';
import { substituirCnaes, validarListaCnaes } from './cnaes.service';
import type { CnaeItemDto } from './dto/cnae.dto';
import type { AcaoDecisaoDto, RemoverDto } from './dto/comum.dto';
import type { CreateAlteracaoDto, UpdateAlteracaoDto } from './dto/alteracao.dto';
import {
  MODULO_AUDITORIA,
  conflito,
  ehViolacaoUnica,
  exigirSegregacao,
  exigirVersao,
  regraViolada,
  transicaoInvalida,
  travarEstabelecimento,
  type Tx,
} from './fiscal-comum';

type Alteracao = typeof estabelecimentoAlteracoes.$inferSelect;
type Db = NodePgDatabase<typeof schema>;

/**
 * Proposta de mudança de estabelecimento já aprovado (D22).
 * Os valores aprovados só mudam na aprovação da proposta.
 */
@Injectable()
export class AlteracoesService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async criar(estabelecimentoId: string, dto: CreateAlteracaoDto, usuarioId: string) {
    validarListaCnaes(dto.cnaes);
    try {
      const criada = await this.db.transaction(async (tx) => {
        const estab = await travarEstabelecimento(tx, estabelecimentoId);
        if (estab.situacao !== 'APPROVED') transicaoInvalida(estab.situacao);
        exigirVersao(estab.versao, dto.versao);
        const [linha] = await tx
          .insert(estabelecimentoAlteracoes)
          .values({
            estabelecimentoId: estab.id,
            empresaId: estab.empresaId,
            nome: dto.nome,
            inscricaoEstadual: dto.inscricaoEstadual,
            inscricaoMunicipal: dto.inscricaoMunicipal,
            uf: dto.uf,
            versaoBase: estab.versao,
            situacao: 'DRAFT',
            justificativa: dto.justificativa,
            criadoPorId: usuarioId,
            atualizadoPorId: usuarioId,
          })
          .returning();
        if (!linha) throw new Error('Falha ao gravar alteração');
        await this.auditar(tx, 'INSERT', linha, linha, usuarioId, dto.justificativa);
        await this.substituirPropostos(tx, linha.id, dto.cnaes, usuarioId, dto.justificativa);
        return linha;
      });
      this.emitir(criada, 'alteracao_criada');
      return this.apresentar(criada.id);
    } catch (err) {
      if (ehViolacaoUnica(err, 'uq_estab_alteracoes_aberta')) {
        conflito('ALTERACAO_EM_ABERTO', 'Já existe alteração em aberto para este estabelecimento.');
      }
      throw err;
    }
  }

  async atualizar(estabelecimentoId: string, altId: string, dto: UpdateAlteracaoDto, usuarioId: string) {
    if (dto.cnaes) validarListaCnaes(dto.cnaes);
    const atualizada = await this.db.transaction(async (tx) => {
      await travarEstabelecimento(tx, estabelecimentoId);
      const atual = await this.carregar(tx, estabelecimentoId, altId);
      if (atual.situacao !== 'DRAFT') transicaoInvalida(atual.situacao);
      exigirVersao(atual.versao, dto.versao);
      const [linha] = await tx
        .update(estabelecimentoAlteracoes)
        .set({
          nome: dto.nome ?? atual.nome,
          inscricaoEstadual: dto.inscricaoEstadual ?? atual.inscricaoEstadual,
          inscricaoMunicipal: dto.inscricaoMunicipal ?? atual.inscricaoMunicipal,
          uf: dto.uf ?? atual.uf,
          justificativa: dto.justificativa,
          versao: sql`${estabelecimentoAlteracoes.versao} + 1`,
          atualizadoPorId: usuarioId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(estabelecimentoAlteracoes.id, altId),
          eq(estabelecimentoAlteracoes.versao, dto.versao),
          isNull(estabelecimentoAlteracoes.deletedAt),
        ))
        .returning();
      if (!linha) conflito('CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.');
      await this.auditar(tx, 'UPDATE', atual, linha, usuarioId, dto.justificativa);
      if (dto.cnaes) await this.substituirPropostos(tx, altId, dto.cnaes, usuarioId, dto.justificativa);
      return linha;
    });
    this.emitir(atualizada, 'atualizado');
    return this.apresentar(atualizada.id);
  }

  async submeter(estabelecimentoId: string, altId: string, dto: AcaoDecisaoDto, usuarioId: string) {
    const linha = await this.db.transaction(async (tx) => {
      await travarEstabelecimento(tx, estabelecimentoId);
      const atual = await this.carregar(tx, estabelecimentoId, altId);
      if (atual.situacao !== 'DRAFT') transicaoInvalida(atual.situacao);
      exigirVersao(atual.versao, dto.versao);
      await this.exigirPrincipal(tx, altId);
      return this.gravar(tx, atual, dto.versao, usuarioId, {
        situacao: 'REVIEW',
        submetidoPorId: usuarioId,
        justificativa: dto.justificativa,
      }, dto.justificativa, 'ACAO_MANUAL');
    });
    this.emitir(linha, 'alteracao_submetida');
    return this.apresentar(linha.id);
  }

  async aprovar(estabelecimentoId: string, altId: string, dto: AcaoDecisaoDto, usuarioId: string) {
    const linha = await this.db.transaction(async (tx) => {
      const estab = await travarEstabelecimento(tx, estabelecimentoId);
      const atual = await this.carregar(tx, estabelecimentoId, altId);
      if (atual.situacao !== 'REVIEW') transicaoInvalida(atual.situacao);
      exigirVersao(atual.versao, dto.versao);
      exigirSegregacao(atual.submetidoPorId, usuarioId);
      if (estab.situacao !== 'APPROVED' || estab.versao !== atual.versaoBase) {
        conflito(
          'ALTERACAO_DESATUALIZADA',
          'O cadastro mudou depois desta proposta. Descarte o rascunho ou rejeite a revisão e crie uma nova.',
        );
      }
      const [aplicado] = await tx
        .update(estabelecimentos)
        .set({
          nome: atual.nome,
          inscricaoEstadual: atual.inscricaoEstadual,
          inscricaoMunicipal: atual.inscricaoMunicipal,
          uf: atual.uf,
          versao: sql`${estabelecimentos.versao} + 1`,
          atualizadoPorId: usuarioId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(estabelecimentos.id, estab.id),
          eq(estabelecimentos.versao, estab.versao),
          isNull(estabelecimentos.deletedAt),
        ))
        .returning();
      if (!aplicado) conflito('CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.');
      await this.auditoria.registrar(tx, {
        tabela: 'estabelecimentos',
        registroId: estab.id,
        operacao: 'UPDATE',
        modulo: MODULO_AUDITORIA,
        usuarioId,
        dadosAnteriores: estab,
        dadosNovos: aplicado,
        justificativa: dto.justificativa,
      });
      const propostos = await this.listarPropostos(tx, altId);
      await substituirCnaes(
        tx,
        this.auditoria,
        { estabelecimentoId: estab.id, empresaId: estab.empresaId },
        propostos,
        usuarioId,
        dto.justificativa,
      );
      return this.gravar(tx, atual, dto.versao, usuarioId, {
        situacao: 'APPROVED',
        justificativa: dto.justificativa,
        decididoPorId: usuarioId,
        decididoEm: new Date(),
      }, dto.justificativa, 'ACAO_MANUAL');
    });
    this.emitir(linha, 'alteracao_aprovada');
    return this.apresentar(linha.id);
  }

  async rejeitar(estabelecimentoId: string, altId: string, dto: AcaoDecisaoDto, usuarioId: string) {
    const linha = await this.db.transaction(async (tx) => {
      await travarEstabelecimento(tx, estabelecimentoId);
      const atual = await this.carregar(tx, estabelecimentoId, altId);
      if (atual.situacao !== 'REVIEW') transicaoInvalida(atual.situacao);
      exigirVersao(atual.versao, dto.versao);
      exigirSegregacao(atual.submetidoPorId, usuarioId);
      return this.gravar(tx, atual, dto.versao, usuarioId, {
        situacao: 'REJECTED',
        justificativa: dto.justificativa,
        motivoRejeicao: dto.justificativa,
        decididoPorId: usuarioId,
        decididoEm: new Date(),
      }, dto.justificativa, 'ACAO_MANUAL');
    });
    this.emitir(linha, 'alteracao_rejeitada');
    return this.apresentar(linha.id);
  }

  async descartar(estabelecimentoId: string, altId: string, dto: RemoverDto, usuarioId: string) {
    const removida = await this.db.transaction(async (tx) => {
      await travarEstabelecimento(tx, estabelecimentoId);
      const atual = await this.carregar(tx, estabelecimentoId, altId);
      if (atual.situacao !== 'DRAFT') transicaoInvalida(atual.situacao);
      const agora = new Date();
      const propostos = await tx
        .select()
        .from(estabelecimentoAlteracaoCnaes)
        .where(and(
          eq(estabelecimentoAlteracaoCnaes.alteracaoId, altId),
          isNull(estabelecimentoAlteracaoCnaes.deletedAt),
        ));
      for (const proposto of propostos) {
        await this.apagar(tx, proposto, usuarioId, dto.justificativa, agora);
      }
      const [linha] = await tx
        .update(estabelecimentoAlteracoes)
        .set({ deletedAt: agora, atualizadoPorId: usuarioId, updatedAt: agora, versao: sql`${estabelecimentoAlteracoes.versao} + 1` })
        .where(eq(estabelecimentoAlteracoes.id, altId))
        .returning();
      if (!linha) throw new Error('Falha ao descartar alteração');
      await this.auditar(tx, 'DELETE', atual, linha, usuarioId, dto.justificativa);
      return linha;
    });
    this.emitir(removida, 'alteracao_descartada');
    return { id: removida.id };
  }

  private async apresentar(id: string) {
    const [alt] = await this.db
      .select()
      .from(estabelecimentoAlteracoes)
      .where(eq(estabelecimentoAlteracoes.id, id));
    if (!alt) throw new NotFoundException('Alteração não encontrada');
    const cnaes = await this.listarPropostos(this.db, id);
    return {
      id: alt.id,
      estabelecimentoId: alt.estabelecimentoId,
      nome: alt.nome,
      inscricaoEstadual: alt.inscricaoEstadual,
      inscricaoMunicipal: alt.inscricaoMunicipal,
      uf: alt.uf,
      situacao: alt.situacao,
      versao: alt.versao,
      versaoBase: alt.versaoBase,
      cnaes,
    };
  }

  private async carregar(tx: Tx, estabelecimentoId: string, altId: string): Promise<Alteracao> {
    const [linha] = await tx
      .select()
      .from(estabelecimentoAlteracoes)
      .where(and(
        eq(estabelecimentoAlteracoes.id, altId),
        eq(estabelecimentoAlteracoes.estabelecimentoId, estabelecimentoId),
        isNull(estabelecimentoAlteracoes.deletedAt),
      ))
      .for('no key update');
    if (!linha) throw new NotFoundException('Alteração não encontrada');
    return linha;
  }

  private async exigirPrincipal(tx: Tx, altId: string) {
    const principais = await this.listarPropostos(tx, altId);
    if (principais.filter((item) => item.tipo === 'PRINCIPAL').length !== 1) {
      regraViolada('CNAE_PRINCIPAL_AUSENTE', 'A aprovação exige exatamente um CNAE principal.');
    }
  }

  private async listarPropostos(tx: Tx | Db, altId: string): Promise<CnaeItemDto[]> {
    const linhas = await tx
      .select({
        codigo: estabelecimentoAlteracaoCnaes.codigo,
        descricao: estabelecimentoAlteracaoCnaes.descricao,
        tipo: estabelecimentoAlteracaoCnaes.tipo,
      })
      .from(estabelecimentoAlteracaoCnaes)
      .where(and(
        eq(estabelecimentoAlteracaoCnaes.alteracaoId, altId),
        isNull(estabelecimentoAlteracaoCnaes.deletedAt),
      ));
    return linhas.map((linha) => ({ ...linha, tipo: linha.tipo as CnaeItemDto['tipo'] }));
  }

  /** Mesma diferença da lista vigente, na tabela da proposta. */
  private async substituirPropostos(
    tx: Tx,
    altId: string,
    lista: CnaeItemDto[],
    usuarioId: string,
    justificativa: string,
  ) {
    const vigentes = await tx
      .select()
      .from(estabelecimentoAlteracaoCnaes)
      .where(and(
        eq(estabelecimentoAlteracaoCnaes.alteracaoId, altId),
        isNull(estabelecimentoAlteracaoCnaes.deletedAt),
      ));
    const chave = (item: { codigo: string; tipo: string; descricao: string }) =>
      `${item.codigo}|${item.tipo}|${item.descricao}`;
    const desejadas = new Set(lista.map(chave));
    const agora = new Date();
    for (const vigente of vigentes) {
      if (desejadas.has(chave(vigente))) continue;
      await this.apagar(tx, vigente, usuarioId, justificativa, agora);
    }
    const mantidas = new Set(vigentes.filter((vigente) => desejadas.has(chave(vigente))).map(chave));
    for (const item of lista) {
      if (mantidas.has(chave(item))) continue;
      const [criada] = await tx
        .insert(estabelecimentoAlteracaoCnaes)
        .values({
          alteracaoId: altId,
          codigo: item.codigo,
          descricao: item.descricao,
          tipo: item.tipo,
          criadoPorId: usuarioId,
          atualizadoPorId: usuarioId,
        })
        .returning();
      if (!criada) throw new Error('Falha ao gravar CNAE da alteração');
      await this.auditoria.registrar(tx, {
        tabela: 'estabelecimento_alteracao_cnaes',
        registroId: criada.id,
        operacao: 'INSERT',
        modulo: MODULO_AUDITORIA,
        usuarioId,
        dadosNovos: criada,
        justificativa,
      });
    }
  }

  private async gravar(
    tx: Tx,
    atual: Alteracao,
    versao: number,
    usuarioId: string,
    extras: Partial<typeof estabelecimentoAlteracoes.$inferInsert>,
    justificativa: string,
    operacao: 'UPDATE' | 'ACAO_MANUAL',
  ) {
    const [linha] = await tx
      .update(estabelecimentoAlteracoes)
      .set({
        ...extras,
        versao: sql`${estabelecimentoAlteracoes.versao} + 1`,
        atualizadoPorId: usuarioId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(estabelecimentoAlteracoes.id, atual.id),
        eq(estabelecimentoAlteracoes.versao, versao),
        isNull(estabelecimentoAlteracoes.deletedAt),
      ))
      .returning();
    if (!linha) conflito('CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.');
    await this.auditar(tx, operacao, atual, linha, usuarioId, justificativa);
    return linha;
  }

  private async apagar(
    tx: Tx,
    anterior: { id: string },
    usuarioId: string,
    justificativa: string,
    agora: Date,
  ) {
    const [linha] = await tx
      .update(estabelecimentoAlteracaoCnaes)
      .set({ deletedAt: agora, atualizadoPorId: usuarioId, updatedAt: agora })
      .where(eq(estabelecimentoAlteracaoCnaes.id, anterior.id))
      .returning();
    await this.auditoria.registrar(tx, {
      tabela: 'estabelecimento_alteracao_cnaes',
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
    anterior: Alteracao,
    novo: Alteracao,
    usuarioId: string,
    justificativa: string,
  ) {
    await this.auditoria.registrar(tx, {
      tabela: 'estabelecimento_alteracoes',
      registroId: anterior.id,
      operacao,
      modulo: MODULO_AUDITORIA,
      usuarioId,
      dadosAnteriores: anterior,
      dadosNovos: novo,
      justificativa,
    });
  }

  private emitir(linha: { empresaId: string; estabelecimentoId: string; situacao: string }, acao: AcaoCadastroFiscal) {
    this.eventos.emit(EVENTOS.ESTABELECIMENTO_FISCAL_ALTERADO, {
      empresaId: linha.empresaId,
      estabelecimentoId: linha.estabelecimentoId,
      acao,
      situacao: linha.situacao,
    });
  }
}
