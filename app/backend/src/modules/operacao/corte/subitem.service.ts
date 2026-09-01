import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  operacoes,
  pecas,
  produtos,
  recebimentos,
  recebimentosItens,
  regrasTransformacaoSaidas,
  subitens,
  transformacoes,
  comprasProgramadas,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { BALANCA_GATEWAY, type BalancaGateway } from '../../../hardware/hardware.types';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { resolverCaptura } from '../pesagem/captura';
import { consumirSaldo, devolverSaldo } from '../pesagem/saldo';
import { calcularCompativeisItem } from '../pesagem/compatibilidade';
import { EtiquetaService } from '../pesagem/etiqueta.service';
import { DivergenciaRecebimentoService } from '../recebimento/divergencia/divergencia-recebimento.service';
import type { AdicionarSubitemDto, AssociarSubitemDto, PesarSubitemDto, RedirecionarSubitemDto, SemCoberturaSubitemDto } from './dto/subitem.dto';

type Tx = NodePgDatabase<typeof schema>;
type Subitem = typeof subitens.$inferSelect;
type Transformacao = typeof transformacoes.$inferSelect;

@Injectable()
export class SubitemService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(BALANCA_GATEWAY) private readonly balanca: BalancaGateway,
    private readonly etiqueta: EtiquetaService,
    private readonly divergencias: DivergenciaRecebimentoService,
  ) {}

  private get db() { return this.drizzle.db; }

  async adicionar(transformacaoId: string, dto: AdicionarSubitemDto, operadorId: string): Promise<Subitem> {
    const resultado = await this.db.transaction(async (tx) => {
      const transf = await this.transformacaoEditavel(tx, transformacaoId);
      if (!transf.regraTransformacaoId) {
        throw new ConflictException({
          codigo: 'REGRA_TRANSFORMACAO_OBRIGATORIA',
          mensagem: 'Defina a regra de transformação antes de gerar produtos',
        });
      }
      const saidas = await tx
        .select({
          legado: produtos.legadoItemComercialId,
        })
        .from(regrasTransformacaoSaidas)
        .innerJoin(produtos, eq(produtos.id, regrasTransformacaoSaidas.produtoId))
        .where(eq(regrasTransformacaoSaidas.regraId, transf.regraTransformacaoId));
      const permitido = new Set(saidas.map((s) => s.legado).filter(Boolean) as string[]);
      if (!permitido.has(dto.itemComercialId)) {
        throw new ConflictException({
          codigo: 'SAIDA_FORA_DA_REGRA',
          mensagem: 'Produto incompatível com a regra escolhida para este TZ',
        });
      }
      const criado = primeiroOuFalha(
        await tx
          .insert(subitens)
          .values({
            transformacaoId,
            pecaOrigemId: transf.pecaOrigemId,
            itemComercialId: dto.itemComercialId,
            classificacao: dto.classificacao,
            quantidade: dto.quantidade !== undefined ? String(dto.quantidade) : '1',
            statusSubitem: 'gerado',
            observacoes: dto.observacoes,
          })
          .returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'subitens',
        registroId: criado.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: criado,
      });
      return { subitem: criado, dataOperacao: await this.dataOperacao(tx, transf.pecaOrigemId) };
    });

    this.eventEmitter.emit(EVENTOS.SUBITEM_GERADO, {
      transformacaoId,
      subitemId: resultado.subitem.id,
      dataOperacao: resultado.dataOperacao,
    });
    return resultado.subitem;
  }

  async remover(subitemId: string, operadorId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const subitem = await this.subitemAtivo(tx, subitemId);
      if (!subitem) throw new NotFoundException('Subitem não encontrado');
      await this.transformacaoEditavel(tx, subitem.transformacaoId);
      if (subitem.statusSubitem !== 'gerado') {
        throw new ConflictException('Só é possível remover subitem ainda não pesado/associado');
      }
      const removido = primeiroOuFalha(
        await tx.update(subitens).set({ deletedAt: new Date() }).where(eq(subitens.id, subitemId)).returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'subitens',
        registroId: subitemId,
        operacao: 'DELETE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: subitem,
        dadosNovos: removido,
      });
    });
  }

  async pesar(subitemId: string, dto: PesarSubitemDto, user: CurrentUserPayload): Promise<Subitem> {
    const subitemAtual = await this.subitemAtivo(this.db, subitemId);
    if (!subitemAtual) throw new NotFoundException('Subitem não encontrado');
    const transf = await this.transformacaoEditavel(this.db, subitemAtual.transformacaoId);
    const dataOperacao = await this.dataOperacao(this.db, transf.pecaOrigemId);

    const { peso, capturaMeta } = await resolverCaptura(this.balanca, dto, user, (saude) =>
      this.eventEmitter.emit(EVENTOS.DISPOSITIVO_STATUS_ALTERADO, {
        dataOperacao,
        dispositivo: 'balanca',
        dispositivoId: saude.dispositivoId,
        status: saude.status,
        heartbeatEm: saude.heartbeatEm,
      }),
    );

    const atualizado = await this.db.transaction(async (tx) => {
      const s = primeiroOuFalha(
        await tx
          .update(subitens)
          .set({ peso, modoCapturaPeso: dto.modoCaptura, capturaMeta, statusSubitem: 'pesado' })
          .where(and(eq(subitens.id, subitemId), isNull(subitens.deletedAt)))
          .returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'subitens',
        registroId: subitemId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: user.sub,
        dadosAnteriores: subitemAtual,
        dadosNovos: s,
      });
      return s;
    });

    this.eventEmitter.emit(EVENTOS.SUBITEM_PESADO, {
      transformacaoId: subitemAtual.transformacaoId,
      subitemId,
      dataOperacao,
      modoCaptura: dto.modoCaptura,
      peso,
    });
    return atualizado;
  }

  async associar(subitemId: string, dto: AssociarSubitemDto, operadorId: string): Promise<Subitem> {
    const resultado = await this.db.transaction(async (tx) => {
      const subitem = await this.subitemAtivo(tx, subitemId);
      if (!subitem) throw new NotFoundException('Subitem não encontrado');
      await this.transformacaoEditavel(tx, subitem.transformacaoId);
      if (subitem.statusSubitem !== 'pesado') {
        throw new ConflictException('Subitem precisa estar pesado antes de associar');
      }
      const item = await this.itemCompativel(tx, subitem, dto.pedidoVendaItemId);
      const consumido = await consumirSaldo(tx, dto.pedidoVendaItemId);
      if (!consumido) throw new ConflictException('Item do pedido já está completo');

      const atualizado = primeiroOuFalha(
        await tx
          .update(subitens)
          .set({ statusSubitem: 'associado', pedidoVendaId: item.pedidoVendaId, pedidoVendaItemId: item.id })
          .where(eq(subitens.id, subitemId))
          .returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'subitens',
        registroId: subitemId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: subitem,
        dadosNovos: atualizado,
      });
      return { subitem: atualizado, dataOperacao: await this.dataOperacao(tx, subitem.pecaOrigemId) };
    });

    this.emitAssociado(resultado.subitem, resultado.dataOperacao);
    this.eventEmitter.emit(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, {
      dataOperacao: resultado.dataOperacao,
      motivo: 'subitem_associado',
    });
    return resultado.subitem;
  }

  async redirecionar(subitemId: string, dto: RedirecionarSubitemDto, operadorId: string): Promise<Subitem> {
    const resultado = await this.db.transaction(async (tx) => {
      const subitem = await this.subitemAtivo(tx, subitemId);
      if (!subitem) throw new NotFoundException('Subitem não encontrado');
      await this.transformacaoEditavel(tx, subitem.transformacaoId);
      if (subitem.statusSubitem !== 'associado' || !subitem.pedidoVendaItemId) {
        throw new ConflictException('Só é possível redirecionar subitem já associado');
      }
      if (subitem.pedidoVendaItemId === dto.pedidoVendaItemId) {
        throw new ConflictException('Subitem já está neste item do pedido');
      }
      const destino = await this.itemCompativel(tx, subitem, dto.pedidoVendaItemId);
      const consumido = await consumirSaldo(tx, dto.pedidoVendaItemId);
      if (!consumido) throw new ConflictException('Item de destino já está completo');
      await devolverSaldo(tx, subitem.pedidoVendaItemId);

      const atualizado = primeiroOuFalha(
        await tx
          .update(subitens)
          .set({ pedidoVendaId: destino.pedidoVendaId, pedidoVendaItemId: destino.id, observacoes: dto.motivo })
          .where(eq(subitens.id, subitemId))
          .returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'subitens',
        registroId: subitemId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: subitem,
        dadosNovos: atualizado,
      });
      return { subitem: atualizado, dataOperacao: await this.dataOperacao(tx, subitem.pecaOrigemId) };
    });

    this.emitAssociado(resultado.subitem, resultado.dataOperacao);
    return resultado.subitem;
  }

  async semCobertura(subitemId: string, dto: SemCoberturaSubitemDto, operadorId: string): Promise<Subitem> {
    const mapaStatus = { sobra: 'em_sobra', analise: 'em_analise', divergencia: 'em_analise' } as const;
    const resultado = await this.db.transaction(async (tx) => {
      const subitem = await this.subitemAtivo(tx, subitemId);
      if (!subitem) throw new NotFoundException('Subitem não encontrado');
      await this.transformacaoEditavel(tx, subitem.transformacaoId);

      if (subitem.pedidoVendaItemId) await devolverSaldo(tx, subitem.pedidoVendaItemId);

      const atualizado = primeiroOuFalha(
        await tx
          .update(subitens)
          .set({
            statusSubitem: mapaStatus[dto.destino],
            pedidoVendaId: null,
            pedidoVendaItemId: null,
            observacoes: dto.motivo ?? subitem.observacoes,
          })
          .where(eq(subitens.id, subitemId))
          .returning(),
      );

      if (dto.destino === 'divergencia' && dto.divergencia) {
        const recItem = await this.recebimentoItemDaPeca(tx, subitem.pecaOrigemId);
        await this.divergencias.abrirNaTx(
          tx,
          { recebimentoId: recItem.recebimentoId, recebimentoItemId: recItem.id, ...dto.divergencia },
          operadorId,
        );
      }

      await this.auditoria.registrar(tx, {
        tabela: 'subitens',
        registroId: subitemId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: subitem,
        dadosNovos: atualizado,
      });
      return { subitem: atualizado, dataOperacao: await this.dataOperacao(tx, subitem.pecaOrigemId) };
    });

    this.emitAssociado(resultado.subitem, resultado.dataOperacao);
    return resultado.subitem;
  }

  async sugerir(subitemId: string) {
    const subitem = await this.subitemAtivo(this.db, subitemId);
    if (!subitem) throw new NotFoundException('Subitem não encontrado');
    const compativeis = await this.compativeis(this.db, subitem);
    return { subitemId, sugestao: compativeis[0] ?? null, compativeis };
  }

  async reetiquetar(subitemId: string, operadorId: string) {
    return this.etiqueta.emitirSubitem(subitemId, operadorId);
  }

  async reimprimir(subitemId: string, operadorId: string) {
    return this.etiqueta.reimprimirSubitem(subitemId, operadorId);
  }

  // ── internos ───────────────────────────────────────────────────────────────

  private emitAssociado(subitem: Subitem, dataOperacao: string): void {
    this.eventEmitter.emit(EVENTOS.SUBITEM_ASSOCIADO, {
      transformacaoId: subitem.transformacaoId,
      subitemId: subitem.id,
      dataOperacao,
      pedidoVendaId: subitem.pedidoVendaId,
      pedidoVendaItemId: subitem.pedidoVendaItemId,
      statusSubitem: subitem.statusSubitem,
    });
  }

  private async compativeis(tx: Tx, subitem: Subitem) {
    const peca = await tx
      .select({
        compraProgramadaId: pecas.compraProgramadaId,
        operacaoId: comprasProgramadas.operacaoId,
      })
      .from(pecas)
      .innerJoin(comprasProgramadas, eq(comprasProgramadas.id, pecas.compraProgramadaId))
      .where(eq(pecas.id, subitem.pecaOrigemId))
      .then((r) => r[0] ?? null);
    if (!peca) throw new NotFoundException('Peça de origem não encontrada');
    return calcularCompativeisItem(tx, {
      operacaoId: peca.operacaoId,
      compraProgramadaOrigemId: peca.compraProgramadaId,
      itemComercialId: subitem.itemComercialId,
      peso: subitem.peso ?? '0',
    });
  }

  private async itemCompativel(tx: Tx, subitem: Subitem, pedidoVendaItemId: string) {
    const peca = await tx
      .select()
      .from(pecas)
      .where(eq(pecas.id, subitem.pecaOrigemId))
      .then((r) => r[0] ?? null);
    if (!peca) throw new NotFoundException('Peça de origem não encontrada');

    const item = await tx
      .select({
        id: schema.pedidosVendaItens.id,
        pedidoVendaId: schema.pedidosVendaItens.pedidoVendaId,
        itemComercialId: schema.pedidosVendaItens.itemComercialId,
        operacaoId: schema.pedidosVenda.operacaoId,
        pecaOperacaoId: sql<string>`(
          select cp.operacao_id from compras_programadas cp where cp.id = ${peca.compraProgramadaId}
        )`,
        statusPedido: schema.pedidosVenda.status,
        deletedAt: schema.pedidosVenda.deletedAt,
      })
      .from(schema.pedidosVendaItens)
      .innerJoin(schema.pedidosVenda, eq(schema.pedidosVendaItens.pedidoVendaId, schema.pedidosVenda.id))
      .where(eq(schema.pedidosVendaItens.id, pedidoVendaItemId))
      .then((r) => r[0] ?? null);
    if (!item || item.deletedAt) throw new NotFoundException('Item de pedido não encontrado');
    if (item.statusPedido === 'cancelado') throw new ConflictException('Pedido cancelado não aceita associação');
    if (item.itemComercialId !== subitem.itemComercialId) throw new ConflictException('Item de pedido incompatível com o subitem');
    if (item.operacaoId !== item.pecaOperacaoId) throw new ConflictException('Pedido pertence a outra operação');
    return item;
  }

  private async recebimentoItemDaPeca(tx: Tx, pecaId: string) {
    const peca = await tx
      .select()
      .from(pecas)
      .where(eq(pecas.id, pecaId))
      .then((r) => r[0] ?? null);
    if (!peca) throw new NotFoundException('Peça não encontrada');
    const item = await tx
      .select()
      .from(recebimentosItens)
      .where(
        and(
          eq(recebimentosItens.recebimentoId, peca.recebimentoId),
          eq(recebimentosItens.itemComercialId, peca.itemComercialBaseId),
        ),
      )
      .then((r) => r[0] ?? null);
    if (!item) throw new ConflictException('Item de recebimento não encontrado para abrir divergência');
    return item;
  }

  private async transformacaoEditavel(tx: Tx, transformacaoId: string): Promise<Transformacao> {
    const transf = await tx
      .select()
      .from(transformacoes)
      .where(and(eq(transformacoes.id, transformacaoId), isNull(transformacoes.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!transf) throw new NotFoundException('Transformação não encontrada');
    if (transf.statusTransformacao === 'concluida' || transf.statusTransformacao === 'cancelada') {
      throw new ConflictException('Transformação encerrada não aceita alterações');
    }
    return transf;
  }

  private async subitemAtivo(tx: Tx, id: string): Promise<Subitem | null> {
    return tx
      .select()
      .from(subitens)
      .where(and(eq(subitens.id, id), isNull(subitens.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async dataOperacao(tx: Tx, pecaId: string): Promise<string> {
    const r = await tx
      .select({ dataOperacao: operacoes.data })
      .from(pecas)
      .innerJoin(recebimentos, eq(pecas.recebimentoId, recebimentos.id))
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(eq(pecas.id, pecaId))
      .then((rows) => rows[0] ?? null);
    return r?.dataOperacao ?? '';
  }
}
