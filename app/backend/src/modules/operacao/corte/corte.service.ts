import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { operacoes,
  associacoesPecaHistorico,
  etiquetasImpressoes,
  pecas,
  recebimentos,
  subitens,
  transformacoes,
 } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { somarQtd, subtrairQtd, ehZero } from '../../../common/crud/decimal';
import { EVENTOS } from '../../../realtime/events/eventos';
import { devolverSaldo, consumirSaldo } from '../pesagem/saldo';
import type { IniciarCorteDto, ConcluirCorteDto } from './dto/corte.dto';

type Tx = NodePgDatabase<typeof schema>;
type Transformacao = typeof transformacoes.$inferSelect;
type Peca = typeof pecas.$inferSelect;

const ESTADOS_ELEGIVEIS = ['pesada', 'associada', 'para_corte'] as const;

@Injectable()
export class CorteService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /**
   * Abre o corte (RF-CT-01/04). Valida elegibilidade. Se a peça estava 'associada',
   * LIBERA a unidade no item de origem (RT-007-06) e zera o vínculo. Peça → 'em_transformacao'.
   */
  async iniciar(pecaId: string, dto: IniciarCorteDto, operadorId: string): Promise<Transformacao> {
    const resultado = await this.db.transaction(async (tx) => {
      const peca = await this.pecaAtiva(tx, pecaId);
      if (!peca) throw new NotFoundException('Peça não encontrada');
      if (!(ESTADOS_ELEGIVEIS as readonly string[]).includes(peca.statusPeca)) {
        throw new ConflictException(`Peça em estado '${peca.statusPeca}' não é elegível para corte`);
      }

      if (peca.statusPeca === 'associada' && peca.pedidoVendaItemId) {
        await devolverSaldo(tx, peca.pedidoVendaItemId);
      }

      primeiroOuFalha(
        await tx
          .update(pecas)
          .set({ statusPeca: 'em_transformacao', pedidoVendaId: null, pedidoVendaItemId: null })
          .where(eq(pecas.id, pecaId))
          .returning(),
      );

      const transf = primeiroOuFalha(
        await tx
          .insert(transformacoes)
          .values({
            pecaOrigemId: pecaId,
            tipoTransformacao: dto.tipoTransformacao,
            motivo: dto.motivo,
            motivoDetalhe: dto.motivoDetalhe,
            operadorResponsavelId: operadorId,
            statusTransformacao: 'aberta',
            pesoOriginal: peca.pesoOriginal,
            observacoes: dto.observacoes,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'transformacoes',
        registroId: transf.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: peca,
        dadosNovos: transf,
      });

      const dataOp = await this.dataOperacaoPorRecebimento(tx, peca.recebimentoId);
      return { transf, dataOperacao: dataOp };
    });

    this.eventEmitter.emit(EVENTOS.CORTE_INICIADO, {
      transformacaoId: resultado.transf.id,
      pecaOrigemId: pecaId,
      dataOperacao: resultado.dataOperacao,
    });
    return resultado.transf;
  }

  /**
   * Conclui o corte. Validações duras antes de marcar 'concluida':
   * - todo subitem ativo: peso + destino + etiqueta válida (RF-CT-24)
   * - Σ pesos vs peso_original: diferença ≠ 0 exige justificativa (RF-CT-09/10)
   * - Peça origem → 'transformada' (invalidação lógica da etiqueta original — RF-CT-17)
   * - Idempotente: se já 'concluida', retorna sem efeito
   */
  async concluir(
    transformacaoId: string,
    dto: ConcluirCorteDto,
    operadorId: string,
  ): Promise<Transformacao> {
    const resultado = await this.db.transaction(async (tx) => {
      const transf = await this.transformacaoAtiva(tx, transformacaoId);
      if (!transf) throw new NotFoundException('Transformação não encontrada');

      if (transf.statusTransformacao === 'concluida') {
        return { transf, dataOperacao: '', jaConcluido: true };
      }
      if (transf.statusTransformacao === 'cancelada') {
        throw new ConflictException('Transformação cancelada não pode ser concluída');
      }

      const lista = await tx
        .select()
        .from(subitens)
        .where(and(eq(subitens.transformacaoId, transformacaoId), isNull(subitens.deletedAt)));
      if (lista.length === 0) throw new ConflictException('Não há subitens para concluir o corte');

      const DESTINOS_OK = ['associado', 'em_sobra', 'em_analise'];
      for (const s of lista) {
        if (!s.peso) throw new ConflictException(`Subitem ${s.id} sem peso`);
        if (!DESTINOS_OK.includes(s.statusSubitem)) {
          throw new ConflictException(`Subitem ${s.id} sem destino definido`);
        }
        if (!s.etiquetaAtual) throw new ConflictException(`Subitem ${s.id} sem etiqueta válida`);
      }

      const total = lista.reduce((acc, s) => somarQtd(acc, s.peso ?? '0'), '0.000');
      const diferenca = subtrairQtd(transf.pesoOriginal, total);
      if (!ehZero(diferenca) && !dto.justificativaDiferenca) {
        throw new ConflictException(
          'Diferença de peso entre original e subitens exige justificativa',
        );
      }

      const atualizada = primeiroOuFalha(
        await tx
          .update(transformacoes)
          .set({
            statusTransformacao: 'concluida',
            dataHoraEncerramento: new Date(),
            pesoSubitensTotal: total,
            diferencaPeso: diferenca,
            justificativaDiferenca: dto.justificativaDiferenca ?? null,
          })
          .where(
            and(
              eq(transformacoes.id, transformacaoId),
              eq(transformacoes.statusTransformacao, transf.statusTransformacao),
            ),
          )
          .returning(),
      );

      await tx
        .update(pecas)
        .set({ statusPeca: 'transformada' })
        .where(eq(pecas.id, transf.pecaOrigemId));

      await this.auditoria.registrar(tx, {
        tabela: 'transformacoes',
        registroId: transformacaoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: transf,
        dadosNovos: atualizada,
      });

      const pecaAtualizada = await this.pecaAtiva(tx, transf.pecaOrigemId);
      const dataOp = pecaAtualizada
        ? await this.dataOperacaoPorRecebimento(tx, pecaAtualizada.recebimentoId)
        : '';
      return { transf: atualizada, dataOperacao: dataOp, jaConcluido: false };
    });

    if (!resultado.jaConcluido) {
      this.eventEmitter.emit(EVENTOS.CORTE_CONCLUIDO, {
        transformacaoId,
        pecaOrigemId: resultado.transf.pecaOrigemId,
        dataOperacao: resultado.dataOperacao,
        pesoOriginal: resultado.transf.pesoOriginal,
        pesoSubitensTotal: resultado.transf.pesoSubitensTotal ?? '0.000',
        diferencaPeso: resultado.transf.diferencaPeso ?? '0.000',
      });
    }
    return resultado.transf;
  }

  /** Cancela o corte (antes de concluído): restaura a peça e descarta subitens. */
  async cancelar(transformacaoId: string, operadorId: string): Promise<Transformacao> {
    return this.db.transaction(async (tx) => {
      const transf = await this.transformacaoAtiva(tx, transformacaoId);
      if (!transf) throw new NotFoundException('Transformação não encontrada');
      if (transf.statusTransformacao === 'concluida') {
        throw new ConflictException('Transformação concluída não pode ser cancelada');
      }
      if (transf.statusTransformacao === 'cancelada') return transf;

      const lista = await tx
        .select()
        .from(subitens)
        .where(and(eq(subitens.transformacaoId, transformacaoId), isNull(subitens.deletedAt)));
      for (const s of lista) {
        if (s.pedidoVendaItemId) await devolverSaldo(tx, s.pedidoVendaItemId);
        await tx.update(subitens).set({ deletedAt: new Date() }).where(eq(subitens.id, s.id));
      }

      // Tenta restaurar a associação original da peça (best-effort, sem invariante dura).
      const histAssoc = await tx
        .select()
        .from(associacoesPecaHistorico)
        .where(eq(associacoesPecaHistorico.pecaId, transf.pecaOrigemId))
        .orderBy(asc(associacoesPecaHistorico.createdAt));
      const ultimoDestino = histAssoc
        .filter((h) => h.acao === 'confirmar' || h.acao === 'redirecionar')
        .at(-1);

      let statusRestaurado = 'pesada';
      if (ultimoDestino?.pedidoItemDestinoId) {
        const reconsumido = await consumirSaldo(tx, ultimoDestino.pedidoItemDestinoId);
        if (reconsumido) {
          statusRestaurado = 'associada';
          await tx
            .update(pecas)
            .set({
              statusPeca: 'associada',
              pedidoVendaId: ultimoDestino.pedidoDestinoId,
              pedidoVendaItemId: ultimoDestino.pedidoItemDestinoId,
            })
            .where(eq(pecas.id, transf.pecaOrigemId));
        }
      }
      if (statusRestaurado === 'pesada') {
        await tx
          .update(pecas)
          .set({ statusPeca: 'pesada' })
          .where(eq(pecas.id, transf.pecaOrigemId));
      }

      const atualizada = primeiroOuFalha(
        await tx
          .update(transformacoes)
          .set({ statusTransformacao: 'cancelada', dataHoraEncerramento: new Date() })
          .where(eq(transformacoes.id, transformacaoId))
          .returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'transformacoes',
        registroId: transformacaoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: transf,
        dadosNovos: atualizada,
      });
      return atualizada;
    });
  }

  /** Detalhe da transformação + subitens ativos. */
  async detalhar(transformacaoId: string) {
    const transf = await this.transformacaoAtiva(this.db, transformacaoId);
    if (!transf) throw new NotFoundException('Transformação não encontrada');
    const lista = await this.db
      .select()
      .from(subitens)
      .where(and(eq(subitens.transformacaoId, transformacaoId), isNull(subitens.deletedAt)))
      .orderBy(asc(subitens.createdAt));
    return { transformacao: transf, subitens: lista };
  }

  /**
   * Rastreabilidade ponta a ponta (RF-CT-19/20). Consultável por peça ou subitem.
   */
  async rastrear(params: { pecaId?: string; subitemId?: string }) {
    let pecaId = params.pecaId ?? null;
    if (!pecaId && params.subitemId) {
      const s = await this.db
        .select()
        .from(subitens)
        .where(eq(subitens.id, params.subitemId))
        .then((r) => r[0] ?? null);
      if (!s) throw new NotFoundException('Subitem não encontrado');
      pecaId = s.pecaOrigemId;
    }
    if (!pecaId) throw new NotFoundException('Informe pecaId ou subitemId');

    const peca = await this.db
      .select()
      .from(pecas)
      .where(eq(pecas.id, pecaId))
      .then((r) => r[0] ?? null);
    if (!peca) throw new NotFoundException('Peça não encontrada');

    const transfs = await this.db
      .select()
      .from(transformacoes)
      .where(eq(transformacoes.pecaOrigemId, pecaId))
      .orderBy(asc(transformacoes.dataHoraAbertura));

    const subs = await this.db
      .select()
      .from(subitens)
      .where(eq(subitens.pecaOrigemId, pecaId))
      .orderBy(asc(subitens.createdAt));

    const etiquetasPeca = await this.db
      .select()
      .from(etiquetasImpressoes)
      .where(eq(etiquetasImpressoes.pecaId, pecaId));

    const subIds = subs.map((s) => s.id);
    const etiquetasSub = subIds.length
      ? await this.db
          .select()
          .from(etiquetasImpressoes)
          .where(inArray(etiquetasImpressoes.subitemId, subIds))
      : [];

    const historico = await this.db
      .select()
      .from(associacoesPecaHistorico)
      .where(eq(associacoesPecaHistorico.pecaId, pecaId))
      .orderBy(asc(associacoesPecaHistorico.createdAt));

    return {
      peca,
      transformacoes: transfs,
      subitens: subs,
      etiquetasPeca,
      etiquetasSubitens: etiquetasSub,
      historico,
    };
  }

  // ── internos ───────────────────────────────────────────────────────────────

  private async transformacaoAtiva(tx: Tx, id: string): Promise<Transformacao | null> {
    return tx
      .select()
      .from(transformacoes)
      .where(and(eq(transformacoes.id, id), isNull(transformacoes.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async pecaAtiva(tx: Tx, id: string): Promise<Peca | null> {
    return tx
      .select()
      .from(pecas)
      .where(and(eq(pecas.id, id), isNull(pecas.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async dataOperacaoPorRecebimento(tx: Tx, recebimentoId: string): Promise<string> {
    const r = await tx
      .select({ dataOperacao: operacoes.data })
      .from(recebimentos)
      .where(eq(recebimentos.id, recebimentoId))
      .then((rows) => rows[0] ?? null);
    return r?.dataOperacao ?? '';
  }
}
