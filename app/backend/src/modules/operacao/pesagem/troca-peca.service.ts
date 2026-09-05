import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  associacoesPecaHistorico,
  operacoes,
  pecas,
  pedidosVenda,
  pedidosVendaItens,
  recebimentos,
  trocasPeca,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { AprovacoesService } from '../../gestao/aprovacoes/aprovacoes.service';
import { EtiquetaService } from './etiqueta.service';
import { buscarCargaAbertaDaPeca, pecaEmCargaFechada } from './carga-fechada';
import type { ExecutarTrocaDto } from './dto/troca-peca.dto';

type Tx = NodePgDatabase<typeof schema>;
type Peca = typeof pecas.$inferSelect;
type Etiqueta = typeof schema.etiquetasImpressoes.$inferSelect;

export interface ResultadoTrocaPeca {
  troca: typeof trocasPeca.$inferSelect;
  pecaRetirada: Peca;
  pecaInserida: Peca;
  etiquetaInvalidada: Etiqueta | null;
  etiquetaEmitida: Etiqueta;
  pendenciaFisicaId: string | null;
}

@Injectable()
export class TrocaPecaService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly etiqueta: EtiquetaService,
    private readonly aprovacoes: AprovacoesService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /**
   * Troca de Peça (v1.1 §6.13): passos 1–9 numa única transação.
   * peso_original das duas peças NUNCA é escrito — a troca altera destinação, não pesagem.
   */
  async executar(dto: ExecutarTrocaDto, operadorId: string): Promise<ResultadoTrocaPeca> {
    const contexto = await this.validarTroca(dto);

    const resultado = await this.db.transaction(async (tx) => {
      // 1 e 2 — revalida sob lock. Ordem determinística de lock evita deadlock com a troca inversa.
      const [primeiroId, segundoId] = [dto.pecaRetiradaId, dto.pecaInseridaId].sort() as [string, string];
      const travadas = new Map<string, Peca>();
      travadas.set(primeiroId, await this.travarPeca(tx, primeiroId));
      travadas.set(segundoId, await this.travarPeca(tx, segundoId));
      const retirada = travadas.get(dto.pecaRetiradaId)!;
      const inserida = travadas.get(dto.pecaInseridaId)!;

      if (retirada.statusPeca !== 'associada' || retirada.pedidoVendaItemId !== dto.pedidoVendaItemId) {
        throw new ConflictException('Peça retirada não está mais associada a este item do pedido');
      }
      if (inserida.statusPeca === 'associada') {
        throw new ConflictException('Peça de entrada já está associada a um pedido');
      }
      if (inserida.produtoBaseId !== retirada.produtoBaseId) {
        throw new ConflictException('Peça de entrada é de outro item comercial');
      }
      // P10 (§16.13, mestre `:261`) — as duas metades da mitigação, mutuamente exclusivas:
      if (await pecaEmCargaFechada(tx, retirada.id)) {
        throw new ConflictException('Peça retirada já está em carga fechada — troca bloqueada');
      }
      // metade 2: carga aberta não bloqueia, mas gera pendência física (registrada após o passo 9,
      // já com o id da troca para referenciar). `null` = peça nunca foi carregada, nada a registrar.
      const cargaAberta = await buscarCargaAbertaDaPeca(tx, retirada.id);

      // Impressão física só DEPOIS de todas as checagens sob lock passarem: um 409 acima nunca
      // deixa etiqueta física impressa sem fato de negócio associado (RA-02). Best-effort — nunca
      // lança; falha vira status_impressao='falha_impressao'. DENTRO da transação — diferente do
      // precedente etiqueta.service.ts:43-55 (impressão FORA da transação) — porque aqui a decisão
      // de imprimir depende de travar as DUAS peças e checar carga fechada antes, o que só existe
      // sob lock; não dá pra imprimir antes de abrir a transação como o precedente faz. Custo hoje
      // é zero: fila-impressora.adapter.ts:19-27 é fake sem I/O real, então os dois `FOR UPDATE`
      // ficam abertos por microssegundos, não pelo tempo de um driver de hardware.
      // ponytail: quando o driver real (ADR-010) substituir o fake, reavaliar se a impressão deve
      // sair da transação (ex.: emitir side-effect pós-commit com fallback e reimpressão manual)
      // para não manter dois FOR UPDATE presos durante I/O de hardware.
      const impressao = await this.etiqueta.imprimirPayload(contexto.payloadEtiqueta);

      // 3 e 4 — desassocia a antiga e a destina (estoque → em_sobra; desossa → para_corte).
      const statusRetirada = dto.destinoRetirada === 'estoque' ? 'em_sobra' : 'para_corte';
      const retiradaAtualizada = primeiroOuFalha(
        await tx
          .update(pecas)
          .set({ statusPeca: statusRetirada, pedidoVendaId: null, pedidoVendaItemId: null })
          .where(eq(pecas.id, retirada.id))
          .returning(),
      );

      // 5 — associa a nova ao MESMO item; a unidade do saldo é a mesma, logo
      // quantidade_atendida permanece intacta (nem consumirSaldo nem devolverSaldo).
      const inseridaAtualizada = primeiroOuFalha(
        await tx
          .update(pecas)
          .set({
            statusPeca: 'associada',
            pedidoVendaId: contexto.pedidoVendaId,
            pedidoVendaItemId: dto.pedidoVendaItemId,
            etiquetaAtual: contexto.codigoNovaEtiqueta,
          })
          .where(eq(pecas.id, inserida.id))
          .returning(),
      );

      // 6 — preservação do peso: nenhum dos dois UPDATE acima toca peso_original.

      // 7 — invalida a etiqueta vigente da peça retirada.
      const etiquetaInvalidada = await this.etiqueta.invalidarPorTrocaNaTx(tx, retirada.id, operadorId);

      // 8 — emite a nova etiqueta da peça inserida.
      const etiquetaEmitida = await this.etiqueta.emitirNaTx(tx, {
        pecaId: inserida.id,
        codigo: contexto.codigoNovaEtiqueta,
        payload: contexto.payloadEtiqueta,
        impressao,
        reimpressao: false,
        operadorId,
      });

      // 9 — histórico completo: 1 linha em trocas_peca + 2 em associacoes_peca_historico.
      const troca = primeiroOuFalha(
        await tx
          .insert(trocasPeca)
          .values({
            recebimentoId: inserida.recebimentoId,
            pedidoVendaId: contexto.pedidoVendaId,
            pedidoVendaItemId: dto.pedidoVendaItemId,
            pecaRetiradaId: retirada.id,
            pecaInseridaId: inserida.id,
            pesoRetirada: retirada.pesoOriginal,
            pesoInserida: inserida.pesoOriginal,
            destinoRetirada: dto.destinoRetirada,
            motivo: dto.motivo,
            observacoes: dto.observacoes ?? null,
            etiquetaInvalidadaId: etiquetaInvalidada?.id ?? null,
            etiquetaEmitidaId: etiquetaEmitida.id,
            operadorId,
          })
          .returning(),
      );

      await tx.insert(associacoesPecaHistorico).values([
        {
          pecaId: retirada.id,
          acao: 'troca_saida',
          pedidoOrigemId: contexto.pedidoVendaId,
          motivo: dto.motivo,
          operadorId,
          statusExpedicaoNoMomento: 'aberta',
          compraProgramadaOrigemId: retirada.compraProgramadaId,
          recebimentoOrigemId: retirada.recebimentoId,
        },
        {
          pecaId: inserida.id,
          acao: 'troca_entrada',
          pedidoDestinoId: contexto.pedidoVendaId,
          pedidoItemDestinoId: dto.pedidoVendaItemId,
          motivo: dto.motivo,
          operadorId,
          statusExpedicaoNoMomento: 'aberta',
          compraProgramadaOrigemId: inserida.compraProgramadaId,
          recebimentoOrigemId: inserida.recebimentoId,
        },
      ]);

      await this.auditoria.registrar(tx, {
        tabela: 'trocas_peca',
        registroId: troca.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: { pecaRetirada: retirada, pecaInserida: inserida },
        dadosNovos: { troca, pecaRetirada: retiradaAtualizada, pecaInserida: inseridaAtualizada },
      });

      // P10, metade 2 (D6.21): carga aberta na peça retirada → pendência física, mesma transação
      // da troca, referenciando trocas_peca.id. Reusa AprovacoesService.abrirNaTx (Onda 5) —
      // nenhuma tabela nova. O gestor resolve pela tela de Gestão › Aprovações já existente.
      const pendenciaFisica = cargaAberta
        ? await this.aprovacoes.abrirNaTx(
            tx,
            {
              operacaoId: contexto.operacaoId,
              tipo: 'pendencia_fisica_etiqueta',
              origem: 'Troca de Peça',
              descricao:
                `Peça ${retirada.etiquetaAtual ?? retirada.id} foi trocada enquanto já carregada ` +
                `no caminhão placa ${cargaAberta.placa} (carga aberta). A etiqueta física impressa ` +
                `em ${retirada.etiquetaAtual ?? '—'} precisa ser substituída manualmente na doca ` +
                `pela nova etiqueta ${contexto.codigoNovaEtiqueta} antes do fechamento da carga.`,
              impacto:
                'Etiqueta física da peça carregada não corresponde mais à peça fisicamente no ' +
                'caminhão até a substituição manual — risco de expedir com etiqueta trocada.',
              referenciaTabela: 'trocas_peca',
              referenciaId: troca.id,
            },
            operadorId,
          )
        : null;

      return {
        troca,
        pecaRetirada: retiradaAtualizada,
        pecaInserida: inseridaAtualizada,
        etiquetaInvalidada,
        etiquetaEmitida,
        pendenciaFisicaId: pendenciaFisica?.id ?? null,
      };
    });

    // PÓS-COMMIT (ADR-004): nada é publicado se a transação falhou.
    this.eventEmitter.emit(EVENTOS.PECA_TROCADA, {
      trocaId: resultado.troca.id,
      dataOperacao: contexto.dataOperacao,
      pedidoVendaId: contexto.pedidoVendaId,
      pedidoVendaItemId: dto.pedidoVendaItemId,
      pecaRetiradaId: resultado.pecaRetirada.id,
      pecaInseridaId: resultado.pecaInserida.id,
      destinoRetirada: dto.destinoRetirada,
      motivo: dto.motivo,
      etiquetaInvalidadaId: resultado.etiquetaInvalidada?.id ?? null,
      etiquetaEmitidaId: resultado.etiquetaEmitida.id,
    });
    if (resultado.etiquetaInvalidada) {
      this.eventEmitter.emit(EVENTOS.ETIQUETA_INVALIDADA, {
        etiquetaId: resultado.etiquetaInvalidada.id,
        pecaId: resultado.pecaRetirada.id,
        dataOperacao: contexto.dataOperacao,
        estado: 'invalidada_por_troca',
        motivo: dto.motivo,
      });
    }
    if (resultado.pendenciaFisicaId) {
      // P10, metade 2: mesmo evento que AprovacoesService.abrir() publicaria — a pendência entra
      // na fila de Gestão › Aprovações em tempo real, sem endpoint novo nem tela nova.
      this.eventEmitter.emit(EVENTOS.APROVACAO_REGISTRADA, {
        aprovacaoId: resultado.pendenciaFisicaId,
        operacaoId: contexto.operacaoId,
        dataOperacao: contexto.dataOperacao,
        tipo: 'pendencia_fisica_etiqueta',
        status: 'pendente',
      });
    }

    return resultado;
  }

  // ── internos ───────────────────────────────────────────────────────────────

  /** Leitura pré-transação: valida o item de destino e monta o payload da nova etiqueta. */
  private async validarTroca(dto: ExecutarTrocaDto) {
    const item = await this.db
      .select({
        id: pedidosVendaItens.id,
        pedidoVendaId: pedidosVendaItens.pedidoVendaId,
        produtoId: pedidosVendaItens.produtoId,
        statusPedido: pedidosVenda.status,
        operacaoId: pedidosVenda.operacaoId,
        deletedAt: pedidosVenda.deletedAt,
      })
      .from(pedidosVendaItens)
      .innerJoin(pedidosVenda, eq(pedidosVendaItens.pedidoVendaId, pedidosVenda.id))
      .where(eq(pedidosVendaItens.id, dto.pedidoVendaItemId))
      .then((r) => r[0] ?? null);
    if (!item || item.deletedAt) throw new NotFoundException('Item de pedido não encontrado');
    if (item.statusPedido === 'cancelado') {
      throw new ConflictException('Pedido cancelado não aceita troca de peça');
    }

    const inserida = await this.buscarAtiva(this.db, dto.pecaInseridaId);
    if (!inserida) throw new NotFoundException('Peça de entrada não encontrada');
    if (inserida.produtoBaseId !== item.produtoId) {
      throw new ConflictException('Peça de entrada incompatível com o item do pedido');
    }

    const { dataOperacao, operacaoId } = await this.dadosOperacaoDaPeca(this.db, inserida);
    if (item.operacaoId !== operacaoId) {
      throw new ConflictException('Pedido pertence a outra operação');
    }
    const codigoNovaEtiqueta = inserida.etiquetaAtual ?? `QR-${inserida.id}`;

    return {
      pedidoVendaId: item.pedidoVendaId,
      dataOperacao,
      operacaoId,
      codigoNovaEtiqueta,
      payloadEtiqueta: {
        pecaId: inserida.id,
        produtoBaseId: inserida.produtoBaseId,
        pesoOriginal: inserida.pesoOriginal,
        pedidoVendaId: item.pedidoVendaId,
        pedidoVendaItemId: item.id,
        qr: codigoNovaEtiqueta,
        dataHoraPesagem: inserida.dataHoraPesagem,
        origemTroca: true,
      } as Record<string, unknown>,
    };
  }

  private async travarPeca(tx: Tx, id: string): Promise<Peca> {
    const peca = await tx
      .select()
      .from(pecas)
      .where(and(eq(pecas.id, id), isNull(pecas.deletedAt)))
      .for('update')
      .then((r) => r[0] ?? null);
    if (!peca) throw new NotFoundException('Peça não encontrada');
    return peca;
  }

  private async buscarAtiva(tx: Tx, id: string): Promise<Peca | null> {
    return tx
      .select()
      .from(pecas)
      .where(and(eq(pecas.id, id), isNull(pecas.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  /** Também devolve operacaoId — necessário para abrir a pendência física de P10 (D6.21). */
  private async dadosOperacaoDaPeca(
    tx: Tx,
    peca: Peca,
  ): Promise<{ dataOperacao: string; operacaoId: string }> {
    const r = await tx
      .select({ dataOperacao: operacoes.data, operacaoId: operacoes.id })
      .from(recebimentos)
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(eq(recebimentos.id, peca.recebimentoId))
      .then((rows) => rows[0] ?? null);
    if (!r) throw new NotFoundException('Operação da peça de entrada não encontrada');
    return r;
  }
}
