import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { regimesTributarios } from '../../../../database/schema';
import { EVENTOS, type AcaoCadastroFiscal } from '../../../../realtime/events/eventos';
import type { AcaoDecisaoDto, RemoverDto } from './dto/comum.dto';
import type { CreateRegimeDto, SubmeterRegimeDto, UpdateRegimeDto } from './dto/regime.dto';
import {
  MODULO_AUDITORIA,
  conflito,
  exigirSegregacao,
  exigirVersao,
  regraViolada,
  transicaoInvalida,
  travarEstabelecimento,
  type Tx,
} from './fiscal-comum';
import { classificarSobreposicao, type IntervaloRegime } from './regimes-vigencia';

type Regime = typeof regimesTributarios.$inferSelect;
type Db = NodePgDatabase<typeof schema>;

/** Regime tributário por vigência do estabelecimento (D8). APPROVED só muda o fim, na troca. */
@Injectable()
export class RegimesService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: Db },
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get db(): Db {
    return this.drizzle.db;
  }

  async criar(estabelecimentoId: string, dto: CreateRegimeDto, usuarioId: string) {
    const criado = await this.db.transaction(async (tx) => {
      const estab = await travarEstabelecimento(tx, estabelecimentoId);
      if (estab.situacao === 'SUSPENDED') transicaoInvalida(estab.situacao);
      const [linha] = await tx
        .insert(regimesTributarios)
        .values({
          estabelecimentoId: estab.id,
          empresaId: estab.empresaId,
          crt: dto.crt,
          vigenciaInicio: dto.vigenciaInicio,
          vigenciaFim: dto.vigenciaFim ?? null,
          situacao: 'DRAFT',
          justificativa: dto.justificativa,
          criadoPorId: usuarioId,
          atualizadoPorId: usuarioId,
        })
        .returning();
      if (!linha) throw new Error('Falha ao gravar regime');
      await this.auditar(tx, 'INSERT', null, linha, usuarioId, dto.justificativa);
      return linha;
    });
    this.emitir(criado, 'criado');
    return this.apresentar(criado);
  }

  async atualizar(estabelecimentoId: string, regimeId: string, dto: UpdateRegimeDto, usuarioId: string) {
    const atualizado = await this.db.transaction(async (tx) => {
      await travarEstabelecimento(tx, estabelecimentoId);
      const atual = await this.carregar(tx, estabelecimentoId, regimeId);
      if (atual.situacao !== 'DRAFT' && atual.situacao !== 'REJECTED') transicaoInvalida(atual.situacao);
      exigirVersao(atual.versao, dto.versao);
      const vigenciaInicio = dto.vigenciaInicio ?? atual.vigenciaInicio;
      const vigenciaFim = dto.vigenciaFim ?? atual.vigenciaFim;
      if (vigenciaFim && vigenciaFim < vigenciaInicio) {
        regraViolada('VIGENCIA_INVALIDA', 'Fim de vigência deve ser igual ou posterior ao início.');
      }
      const [linha] = await tx
        .update(regimesTributarios)
        .set({
          crt: dto.crt ?? atual.crt,
          vigenciaInicio,
          vigenciaFim,
          situacao: 'DRAFT',
          justificativa: dto.justificativa,
          motivoRejeicao: null,
          submetidoPorId: null,
          decididoPorId: null,
          decididoEm: null,
          versao: sql`${regimesTributarios.versao} + 1`,
          atualizadoPorId: usuarioId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(regimesTributarios.id, regimeId),
          eq(regimesTributarios.versao, dto.versao),
          isNull(regimesTributarios.deletedAt),
        ))
        .returning();
      if (!linha) conflito('CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.');
      await this.auditar(tx, 'UPDATE', atual, linha, usuarioId, dto.justificativa);
      return linha;
    });
    this.emitir(atualizado, 'atualizado');
    return this.apresentar(atualizado);
  }

  async submeter(estabelecimentoId: string, regimeId: string, dto: SubmeterRegimeDto, usuarioId: string) {
    const linha = await this.db.transaction(async (tx) => {
      await travarEstabelecimento(tx, estabelecimentoId);
      const atual = await this.carregar(tx, estabelecimentoId, regimeId);
      if (atual.situacao !== 'DRAFT') transicaoInvalida(atual.situacao);
      exigirVersao(atual.versao, dto.versao);
      const classificacao = classificarSobreposicao(
        { vigenciaInicio: atual.vigenciaInicio, vigenciaFim: atual.vigenciaFim },
        await this.vigentes(tx, estabelecimentoId, regimeId),
      );
      if (classificacao.tipo === 'sobreposto') {
        conflito('REGIME_SOBREPOSTO', 'O período informado conflita com outro regime.', {
          conflito: classificacao.conflito,
        });
      }
      if (classificacao.tipo === 'troca' && dto.confirmarTroca !== true) {
        conflito(
          'TROCA_REGIME_CONFIRMACAO_NECESSARIA',
          `Encerrar o regime atual em ${classificacao.fimProposto} e submeter a troca?`,
          {
            regimeAtual: {
              crt: classificacao.regimeAtual.crt,
              vigenciaInicio: classificacao.regimeAtual.vigenciaInicio,
            },
            fimProposto: classificacao.fimProposto,
            semRegimeAPartirDe: classificacao.semRegimeAPartirDe,
          },
        );
      }
      return this.gravar(tx, atual, dto.versao, usuarioId, {
        situacao: 'REVIEW',
        submetidoPorId: usuarioId,
        justificativa: dto.justificativa,
        substituiRegimeId: classificacao.tipo === 'troca' ? classificacao.regimeAtual.id : null,
      }, dto.justificativa, 'ACAO_MANUAL');
    });
    this.emitir(linha, 'submetido');
    return this.apresentar(linha);
  }

  async aprovar(estabelecimentoId: string, regimeId: string, dto: AcaoDecisaoDto, usuarioId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const estab = await travarEstabelecimento(tx, estabelecimentoId);
      const atual = await this.carregar(tx, estabelecimentoId, regimeId);
      if (atual.situacao !== 'REVIEW') transicaoInvalida(atual.situacao);
      exigirVersao(atual.versao, dto.versao);
      exigirSegregacao(atual.submetidoPorId, usuarioId);
      if (estab.situacao !== 'APPROVED') {
        regraViolada('ESTABELECIMENTO_NAO_APROVADO', 'O estabelecimento precisa estar aprovado.');
      }
      const classificacao = classificarSobreposicao(
        { vigenciaInicio: atual.vigenciaInicio, vigenciaFim: atual.vigenciaFim },
        await this.vigentes(tx, estabelecimentoId, regimeId),
      );
      if (classificacao.tipo === 'sobreposto') {
        conflito('REGIME_SOBREPOSTO', 'O período informado conflita com outro regime.', {
          conflito: classificacao.conflito,
        });
      }
      let anterior: Regime | null = null;
      if (classificacao.tipo === 'troca') {
        anterior = await this.encerrar(tx, classificacao.regimeAtual.id, classificacao.fimProposto, usuarioId, dto.justificativa);
      }
      const linha = await this.gravar(tx, atual, dto.versao, usuarioId, {
        situacao: 'APPROVED',
        justificativa: dto.justificativa,
        decididoPorId: usuarioId,
        decididoEm: new Date(),
        substituiRegimeId: classificacao.tipo === 'troca' ? classificacao.regimeAtual.id : atual.substituiRegimeId,
      }, dto.justificativa, 'ACAO_MANUAL');
      return { linha, anterior };
    });
    if (resultado.anterior) this.emitir(resultado.anterior, 'atualizado');
    this.emitir(resultado.linha, 'aprovado');
    return this.apresentar(resultado.linha);
  }

  async rejeitar(estabelecimentoId: string, regimeId: string, dto: AcaoDecisaoDto, usuarioId: string) {
    const linha = await this.db.transaction(async (tx) => {
      await travarEstabelecimento(tx, estabelecimentoId);
      const atual = await this.carregar(tx, estabelecimentoId, regimeId);
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
    this.emitir(linha, 'rejeitado');
    return this.apresentar(linha);
  }

  async remover(estabelecimentoId: string, regimeId: string, dto: RemoverDto, usuarioId: string) {
    const removido = await this.db.transaction(async (tx) => {
      await travarEstabelecimento(tx, estabelecimentoId);
      const atual = await this.carregar(tx, estabelecimentoId, regimeId);
      if (atual.situacao !== 'DRAFT' && atual.situacao !== 'REJECTED') transicaoInvalida(atual.situacao);
      const [linha] = await tx
        .update(regimesTributarios)
        .set({
          deletedAt: new Date(),
          atualizadoPorId: usuarioId,
          updatedAt: new Date(),
          versao: sql`${regimesTributarios.versao} + 1`,
        })
        .where(eq(regimesTributarios.id, regimeId))
        .returning();
      if (!linha) throw new Error('Falha ao remover regime');
      await this.auditar(tx, 'DELETE', atual, linha, usuarioId, dto.justificativa);
      return linha;
    });
    this.emitir(removido, 'removido');
    return { id: removido.id };
  }

  private apresentar(linha: Regime) {
    return {
      id: linha.id,
      estabelecimentoId: linha.estabelecimentoId,
      crt: linha.crt,
      vigenciaInicio: linha.vigenciaInicio,
      vigenciaFim: linha.vigenciaFim,
      situacao: linha.situacao,
      versao: linha.versao,
      substituiRegimeId: linha.substituiRegimeId,
    };
  }

  private async carregar(tx: Tx, estabelecimentoId: string, regimeId: string): Promise<Regime> {
    const [linha] = await tx
      .select()
      .from(regimesTributarios)
      .where(and(
        eq(regimesTributarios.id, regimeId),
        eq(regimesTributarios.estabelecimentoId, estabelecimentoId),
        isNull(regimesTributarios.deletedAt),
      ))
      .for('no key update');
    if (!linha) throw new NotFoundException('Regime não encontrado');
    return linha;
  }

  private async vigentes(tx: Tx, estabelecimentoId: string, excetoId: string): Promise<IntervaloRegime[]> {
    return tx
      .select({
        id: regimesTributarios.id,
        crt: regimesTributarios.crt,
        vigenciaInicio: regimesTributarios.vigenciaInicio,
        vigenciaFim: regimesTributarios.vigenciaFim,
        situacao: regimesTributarios.situacao,
      })
      .from(regimesTributarios)
      .where(and(
        eq(regimesTributarios.estabelecimentoId, estabelecimentoId),
        isNull(regimesTributarios.deletedAt),
        inArray(regimesTributarios.situacao, ['REVIEW', 'APPROVED']),
        ne(regimesTributarios.id, excetoId),
      ));
  }

  /** Encurta só um APPROVED aberto. O fim já decidido não é alterado. */
  private async encerrar(tx: Tx, regimeId: string, fim: string, usuarioId: string, justificativa: string) {
    const [atual] = await tx
      .select()
      .from(regimesTributarios)
      .where(and(eq(regimesTributarios.id, regimeId), isNull(regimesTributarios.deletedAt)))
      .for('no key update');
    if (!atual || atual.situacao !== 'APPROVED' || atual.vigenciaFim !== null) {
      conflito('REGIME_SOBREPOSTO', 'O período informado conflita com outro regime.');
    }
    const [linha] = await tx
      .update(regimesTributarios)
      .set({
        vigenciaFim: fim,
        versao: sql`${regimesTributarios.versao} + 1`,
        atualizadoPorId: usuarioId,
        updatedAt: new Date(),
      })
      .where(and(eq(regimesTributarios.id, regimeId), isNull(regimesTributarios.vigenciaFim)))
      .returning();
    if (!linha) conflito('REGIME_SOBREPOSTO', 'O período informado conflita com outro regime.');
    await this.auditar(tx, 'UPDATE', atual, linha, usuarioId, justificativa);
    return linha;
  }

  private async gravar(
    tx: Tx,
    atual: Regime,
    versao: number,
    usuarioId: string,
    extras: Partial<typeof regimesTributarios.$inferInsert>,
    justificativa: string,
    operacao: 'UPDATE' | 'ACAO_MANUAL',
  ) {
    const [linha] = await tx
      .update(regimesTributarios)
      .set({
        ...extras,
        versao: sql`${regimesTributarios.versao} + 1`,
        atualizadoPorId: usuarioId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(regimesTributarios.id, atual.id),
        eq(regimesTributarios.versao, versao),
        isNull(regimesTributarios.deletedAt),
      ))
      .returning();
    if (!linha) conflito('CONFLITO_CONCORRENTE', 'O registro foi alterado por outro usuário. Recarregue para continuar.');
    await this.auditar(tx, operacao, atual, linha, usuarioId, justificativa);
    return linha;
  }

  private async auditar(
    tx: Tx,
    operacao: 'INSERT' | 'UPDATE' | 'DELETE' | 'ACAO_MANUAL',
    anterior: Regime | null,
    novo: Regime,
    usuarioId: string,
    justificativa: string,
  ) {
    await this.auditoria.registrar(tx, {
      tabela: 'regimes_tributarios',
      registroId: novo.id,
      operacao,
      modulo: MODULO_AUDITORIA,
      usuarioId,
      dadosAnteriores: anterior ?? undefined,
      dadosNovos: novo,
      justificativa,
    });
  }

  private emitir(linha: Regime, acao: AcaoCadastroFiscal) {
    this.eventos.emit(EVENTOS.REGIME_TRIBUTARIO_ALTERADO, {
      empresaId: linha.empresaId,
      estabelecimentoId: linha.estabelecimentoId,
      regimeId: linha.id,
      acao,
      situacao: linha.situacao,
    });
  }
}
