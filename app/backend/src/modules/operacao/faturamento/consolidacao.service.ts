import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  caminhoes,
  cargaItens,
  faturamentos,
  notasFiscais,
  pecas,
  subitens,
  pedidosVenda,
  clientes,
} from '../../../database/schema';
import { avaliarBloqueios } from './bloqueios';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';

@Injectable()
export class ConsolidacaoService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() { return this.drizzle.db; }

  /**
   * Consolida a carga de um caminhão fechado para faturamento.
   * Idempotente: cria faturamentos se não existe, ou retorna o existente.
   * Agrega apenas carga_itens não-removidos.
   */
  async consolidar(caminhaoId: string, usuarioId: string) {
    // 1. Verificar caminhão
    const caminhao = await this.db.select().from(caminhoes)
      .where(and(eq(caminhoes.id, caminhaoId), isNull(caminhoes.deletedAt)))
      .then(r => r[0] ?? null);

    if (!caminhao) throw new ConflictException('Caminhão não encontrado');
    if (
      caminhao.statusCaminhao !== 'fechado' &&
      caminhao.statusCaminhao !== 'liberado_faturamento' &&
      caminhao.statusCaminhao !== 'faturado'
    ) {
      throw new ConflictException(
        `Faturamento só permitido para caminhão 'fechado'. Status atual: ${caminhao.statusCaminhao}`
      );
    }

    // 2. Buscar itens não-removidos da carga
    const itens = await this.db.select({
      cargaItem: cargaItens,
      pedido: pedidosVenda,
      cliente: clientes,
    })
      .from(cargaItens)
      .innerJoin(pedidosVenda, eq(cargaItens.pedidoVendaId, pedidosVenda.id))
      .innerJoin(clientes, eq(pedidosVenda.clienteId, clientes.id))
      .where(and(
        eq(cargaItens.caminhaoId, caminhaoId),
        ne(cargaItens.statusCargaItem, 'removido'),
        isNull(cargaItens.deletedAt),
      ));

    // 3. Agregar por pedido (com pesos)
    const porPedido = new Map<string, {
      pedidoVendaId: string;
      clienteId: string;
      clienteRazaoSocial: string;
      clienteDocumentoFiscal: string;
      clienteDadosFiscaisJson: Record<string, unknown>;
      itensCount: number;
      pesoTotalKg: number;
    }>();

    for (const { cargaItem, pedido, cliente } of itens) {
      const key = pedido.id;
      if (!porPedido.has(key)) {
        porPedido.set(key, {
          pedidoVendaId: pedido.id,
          clienteId: cliente.id,
          clienteRazaoSocial: cliente.razaoSocial,
          clienteDocumentoFiscal: cliente.documentoFiscal,
          clienteDadosFiscaisJson: cliente.dadosFiscaisJson as Record<string, unknown>,
          itensCount: 0,
          pesoTotalKg: 0,
        });
      }
      const agg = porPedido.get(key)!;
      agg.itensCount++;

      // Buscar peso da peça/subitem
      if (cargaItem.tipoOrigem === 'peca' && cargaItem.pecaId) {
        const peca = await this.db.select({ peso: pecas.pesoOriginal })
          .from(pecas).where(eq(pecas.id, cargaItem.pecaId)).then(r => r[0]);
        if (peca?.peso) agg.pesoTotalKg += parseFloat(String(peca.peso));
      } else if (cargaItem.tipoOrigem === 'subitem' && cargaItem.subitemId) {
        const sub = await this.db.select({ peso: subitens.peso })
          .from(subitens).where(eq(subitens.id, cargaItem.subitemId)).then(r => r[0]);
        if (sub?.peso) agg.pesoTotalKg += parseFloat(String(sub.peso));
      }
    }

    // 4. Avaliar bloqueios
    const bloqueios = avaliarBloqueios({
      statusCaminhao: caminhao.statusCaminhao,
      itensCarregados: Array.from(porPedido.values()).map(p => ({
        pedidoVendaId: p.pedidoVendaId,
        cliente: {
          razaoSocial: p.clienteRazaoSocial,
          documentoFiscal: p.clienteDocumentoFiscal,
          dadosFiscaisJson: p.clienteDadosFiscaisJson,
        },
      })),
      temDivergenciaCriticaNaoTratada: false, // TODO F6b: consultar divergencias_recebimento quando F6b implementar a tela
      temPecaSemRastreabilidade: itens.some(i =>
        !i.cargaItem.pedidoVendaId
      ),
    });

    // 5. Criar/recuperar faturamento (idempotente)
    let faturamento = await this.db.select().from(faturamentos)
      .where(and(eq(faturamentos.caminhaoId, caminhaoId), isNull(faturamentos.deletedAt)))
      .then(r => r[0] ?? null);

    if (!faturamento) {
      if (!caminhao.operacaoId) {
        throw new ConflictException('Caminhão sem operação associada');
      }
      faturamento = await this.db.transaction(async (tx) => {
        const [fat] = await tx.insert(faturamentos).values({
          caminhaoId,
          statusFaturamento: 'em_consolidacao',
          dataOperacao: caminhao.dataOperacao,
          operacaoId: caminhao.operacaoId,
          responsavelId: usuarioId,
        }).returning();
        if (!fat) throw new Error('Falha ao criar faturamento');

        await this.auditoria.registrar(tx, {
          tabela: 'faturamentos',
          registroId: fat.id,
          operacao: 'INSERT',
          modulo: 'faturamento',
          usuarioId,
          dadosNovos: fat,
        });

        return fat;
      });
    }

    // 6. Buscar NFs existentes
    const nfsExistentes = await this.db.select().from(notasFiscais)
      .where(and(eq(notasFiscais.faturamentoId, faturamento!.id), isNull(notasFiscais.deletedAt)));

    return {
      faturamento: faturamento!,
      caminhao,
      pedidos: Array.from(porPedido.values()),
      notasFiscais: nfsExistentes,
      bloqueios,
      totalItens: itens.length,
    };
  }
}
