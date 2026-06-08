import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { etiquetasImpressoes, pecas, subitens } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { IMPRESSORA_GATEWAY, LEITOR_GATEWAY, type ImpressoraGateway, type LeitorGateway } from '../../../hardware/hardware.types';
import type { ResolverQrDto } from './dto/etiqueta.dto';

type Tx = NodePgDatabase<typeof schema>;
type Peca = typeof pecas.$inferSelect;
type Etiqueta = typeof etiquetasImpressoes.$inferSelect;
type Subitem = typeof subitens.$inferSelect;

export interface ResultadoEtiqueta {
  peca: Peca;
  etiqueta: Etiqueta;
}

@Injectable()
export class EtiquetaService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    @Inject(IMPRESSORA_GATEWAY) private readonly impressora: ImpressoraGateway,
    @Inject(LEITOR_GATEWAY) private readonly leitor: LeitorGateway,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /**
   * Emite a etiqueta da peça (RF-PS-23: só após confirmação da associação).
   * REFINO 1: a etiqueta LÓGICA é o fato de negócio — atribui o QR à peça e grava
   * o registro de impressão SEMPRE, na transação. A impressão FÍSICA é best-effort
   * observável: impressora indisponível → status_impressao='falha_impressao' (não
   * aborta, não perde o QR; permite reimpressão quando a impressora voltar).
   */
  async emitir(pecaId: string, operadorId: string): Promise<ResultadoEtiqueta> {
    const peca = await this.buscarAtiva(this.db, pecaId);
    if (!peca) throw new NotFoundException('Peça não encontrada');
    if (peca.statusPeca !== 'associada') {
      throw new ConflictException('Etiqueta só pode ser emitida após a confirmação da associação');
    }

    const codigoEtiqueta = peca.etiquetaAtual ?? `QR-${peca.id}`;
    const payloadBase = this.montarPayload(peca, codigoEtiqueta);

    // Impressão física FORA da transação (best-effort; nunca lança — adapter/fake).
    const impressao = await this.impressora.imprimir(payloadBase);
    const statusImpressao = impressao.impresso ? 'impressa' : 'falha_impressao';

    return this.db.transaction(async (tx) => {
      const atualizada = primeiroOuFalha(
        await tx.update(pecas).set({ etiquetaAtual: codigoEtiqueta }).where(eq(pecas.id, pecaId)).returning(),
      );

      const etiqueta = primeiroOuFalha(
        await tx
          .insert(etiquetasImpressoes)
          .values({
            pecaId,
            payload: { ...payloadBase, jobId: impressao.jobId, erro: impressao.erro ?? null, gateway_status: impressao.saude },
            statusImpressao,
            reimpressao: false,
            operadorId,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'etiquetas_impressoes',
        registroId: etiqueta.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: etiqueta,
      });

      return { peca: atualizada, etiqueta };
    });
  }

  /**
   * Reimpressão auditada (RF-PS-24). Reaproveita a etiqueta lógica já atribuída —
   * serve também para imprimir de fato um job antes 'falha_impressao'/'pendente'.
   */
  async reimprimir(pecaId: string, operadorId: string): Promise<ResultadoEtiqueta> {
    const peca = await this.buscarAtiva(this.db, pecaId);
    if (!peca) throw new NotFoundException('Peça não encontrada');
    if (!peca.etiquetaAtual) {
      throw new ConflictException('Peça ainda não teve etiqueta emitida');
    }

    const payloadBase = this.montarPayload(peca, peca.etiquetaAtual);
    const impressao = await this.impressora.imprimir(payloadBase);
    const statusImpressao = impressao.impresso ? 'impressa' : 'falha_impressao';

    return this.db.transaction(async (tx) => {
      const etiqueta = primeiroOuFalha(
        await tx
          .insert(etiquetasImpressoes)
          .values({
            pecaId,
            payload: { ...payloadBase, jobId: impressao.jobId, erro: impressao.erro ?? null, gateway_status: impressao.saude },
            statusImpressao,
            reimpressao: true,
            operadorId,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'etiquetas_impressoes',
        registroId: etiqueta.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: etiqueta,
      });

      return { peca, etiqueta };
    });
  }

  /** Emite etiqueta de subitem (RF-CT-15/16, RF-RT-04). Payload referencia a peça original. */
  async emitirSubitem(subitemId: string, operadorId: string): Promise<{ subitem: Subitem; etiqueta: Etiqueta }> {
    const subitem = await this.buscarSubitemAtivo(subitemId);
    if (!subitem) throw new NotFoundException('Subitem não encontrado');
    const DESTINOS_COM_ETIQUETA = ['associado', 'em_sobra', 'em_analise'];
    if (!DESTINOS_COM_ETIQUETA.includes(subitem.statusSubitem)) {
      throw new ConflictException('Etiqueta do subitem só pode ser emitida após pesagem e destinação (associado, sobra ou análise)');
    }

    const codigoEtiqueta = subitem.etiquetaAtual ?? `QR-SUB-${subitem.id}`;
    const payloadBase = this.montarPayloadSubitem(subitem, codigoEtiqueta);

    const impressao = await this.impressora.imprimir(payloadBase);
    const statusImpressao = impressao.impresso ? 'impressa' : 'falha_impressao';

    return this.db.transaction(async (tx) => {
      const atualizado = primeiroOuFalha(
        await tx.update(subitens).set({ etiquetaAtual: codigoEtiqueta }).where(eq(subitens.id, subitemId)).returning(),
      );
      const etiqueta = primeiroOuFalha(
        await tx
          .insert(etiquetasImpressoes)
          .values({
            subitemId,
            payload: { ...payloadBase, jobId: impressao.jobId, erro: impressao.erro ?? null, gateway_status: impressao.saude },
            statusImpressao,
            reimpressao: false,
            operadorId,
          })
          .returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'etiquetas_impressoes',
        registroId: etiqueta.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: etiqueta,
      });
      return { subitem: atualizado, etiqueta };
    });
  }

  /** Reimpressão auditada da etiqueta do subitem (RF-CT-18). */
  async reimprimirSubitem(subitemId: string, operadorId: string): Promise<{ subitem: Subitem; etiqueta: Etiqueta }> {
    const subitem = await this.buscarSubitemAtivo(subitemId);
    if (!subitem) throw new NotFoundException('Subitem não encontrado');
    if (!subitem.etiquetaAtual) throw new ConflictException('Subitem ainda não teve etiqueta emitida');

    const payloadBase = this.montarPayloadSubitem(subitem, subitem.etiquetaAtual);
    const impressao = await this.impressora.imprimir(payloadBase);
    const statusImpressao = impressao.impresso ? 'impressa' : 'falha_impressao';

    return this.db.transaction(async (tx) => {
      const etiqueta = primeiroOuFalha(
        await tx
          .insert(etiquetasImpressoes)
          .values({
            subitemId,
            payload: { ...payloadBase, jobId: impressao.jobId, erro: impressao.erro ?? null, gateway_status: impressao.saude },
            statusImpressao,
            reimpressao: true,
            operadorId,
          })
          .returning(),
      );
      await this.auditoria.registrar(tx, {
        tabela: 'etiquetas_impressoes',
        registroId: etiqueta.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: etiqueta,
      });
      return { subitem, etiqueta };
    });
  }

  /** Resolve um QR num subitem real (mesmo contrato de resolverQr). */
  async resolverQrSubitem(dto: ResolverQrDto): Promise<Subitem> {
    let codigo: string;
    if (dto.modoCaptura === 'automatico') {
      codigo = await this.leitor.ler();
    } else {
      codigo = dto.codigo!;
    }
    const limpo = codigo.trim();
    if (limpo) {
      const porEtiqueta = await this.db
        .select()
        .from(subitens)
        .where(and(eq(subitens.etiquetaAtual, limpo), isNull(subitens.deletedAt)))
        .then((r) => r[0] ?? null);
      if (porEtiqueta) return porEtiqueta;
      const id = limpo.startsWith('QR-SUB-') ? limpo.slice(7) : limpo;
      if (/^[0-9a-fA-F-]{36}$/.test(id)) {
        const porId = await this.db
          .select()
          .from(subitens)
          .where(and(eq(subitens.id, id), isNull(subitens.deletedAt)))
          .then((r) => r[0] ?? null);
        if (porId) return porId;
      }
    }
    throw new NotFoundException('Código não corresponde a nenhum subitem');
  }

  /**
   * Resolve um QR numa peça real (ADR-009). Automático lê do gateway; manual usa o
   * código digitado (controller exige LEITURA_MANUAL). Em ambos, o código DEVE
   * bater numa peça — inválido → erro explícito, sem inventar vínculo.
   */
  async resolverQr(dto: ResolverQrDto): Promise<Peca> {
    let codigo: string;
    if (dto.modoCaptura === 'automatico') {
      codigo = await this.leitor.ler();
    } else {
      codigo = dto.codigo!; // garantido pelo DTO
    }
    const peca = await this.resolverPorCodigo(codigo);
    if (!peca) throw new NotFoundException('Código não corresponde a nenhuma peça');
    return peca;
  }

  private async resolverPorCodigo(codigo: string): Promise<Peca | null> {
    const limpo = codigo.trim();
    if (!limpo) return null;
    // Resolve por etiqueta_atual; também aceita o formato QR-<id> ou o próprio id.
    const porEtiqueta = await this.db
      .select()
      .from(pecas)
      .where(and(eq(pecas.etiquetaAtual, limpo), isNull(pecas.deletedAt)))
      .then((r) => r[0] ?? null);
    if (porEtiqueta) return porEtiqueta;

    const id = limpo.startsWith('QR-') ? limpo.slice(3) : limpo;
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return null;
    return this.db
      .select()
      .from(pecas)
      .where(and(eq(pecas.id, id), isNull(pecas.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private montarPayload(peca: Peca, codigo: string): Record<string, unknown> {
    return {
      pecaId: peca.id,
      itemComercialBaseId: peca.itemComercialBaseId,
      pesoOriginal: peca.pesoOriginal,
      pedidoVendaId: peca.pedidoVendaId,
      pedidoVendaItemId: peca.pedidoVendaItemId,
      qr: codigo,
      dataHoraPesagem: peca.dataHoraPesagem,
    };
  }

  private async buscarAtiva(tx: Tx, id: string): Promise<Peca | null> {
    return tx
      .select()
      .from(pecas)
      .where(and(eq(pecas.id, id), isNull(pecas.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private montarPayloadSubitem(subitem: Subitem, codigo: string): Record<string, unknown> {
    return {
      subitemId: subitem.id,
      pecaOrigemId: subitem.pecaOrigemId,
      transformacaoId: subitem.transformacaoId,
      itemComercialId: subitem.itemComercialId,
      peso: subitem.peso,
      pedidoVendaId: subitem.pedidoVendaId,
      pedidoVendaItemId: subitem.pedidoVendaItemId,
      qr: codigo,
    };
  }

  private async buscarSubitemAtivo(id: string): Promise<Subitem | null> {
    return this.db
      .select()
      .from(subitens)
      .where(and(eq(subitens.id, id), isNull(subitens.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
