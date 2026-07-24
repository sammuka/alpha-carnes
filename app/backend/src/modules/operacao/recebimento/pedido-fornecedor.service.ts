import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { formatarQtd } from '../../../common/crud/decimal';
import { montarPaginado, primeiroOuFalha, type Paginado } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  comprasProgramadas,
  disponibilidadesVirtuais,
  notasFiscaisFornecedor,
  notasFiscaisFornecedorItens,
  pedidosFornecedor,
  pedidosFornecedorItens,
  recebimentos,
} from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import type {
  CriarPedidoFornecedorDto,
  ListarPedidosFornecedorDto,
  RegistrarNfDto,
} from './dto/pedido-fornecedor.dto';

type PedidoFornecedor = typeof pedidosFornecedor.$inferSelect;

@Injectable()
export class PedidoFornecedorService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarPedidosFornecedorDto): Promise<Paginado<PedidoFornecedor>> {
    const page = query.pagina;
    const pageSize = query.limite;
    const filtros = [
      eq(pedidosFornecedor.operacaoId, query.operacaoId),
      isNull(pedidosFornecedor.deletedAt),
    ];
    if (query.status) filtros.push(eq(pedidosFornecedor.status, query.status));
    const where = and(...filtros);
    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(pedidosFornecedor).where(where)
        .orderBy(desc(pedidosFornecedor.createdAt))
        .limit(pageSize).offset((page - 1) * pageSize),
      this.db.select({ total: sql<number>`count(*)::int` }).from(pedidosFornecedor).where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0, { page, pageSize });
  }

  async detalhar(id: string) {
    const pedido = await this.db.select().from(pedidosFornecedor)
      .where(and(eq(pedidosFornecedor.id, id), isNull(pedidosFornecedor.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!pedido) throw new NotFoundException('Pedido ao fornecedor não encontrado');
    const itens = await this.db.select().from(pedidosFornecedorItens)
      .where(and(
        eq(pedidosFornecedorItens.pedidoFornecedorId, id),
        isNull(pedidosFornecedorItens.deletedAt),
      ));
    return { ...pedido, itens };
  }

  async criar(dto: CriarPedidoFornecedorDto, usuarioId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const compra = await tx.query.comprasProgramadas.findFirst({
        where: and(
          eq(comprasProgramadas.id, dto.compraProgramadaId),
          isNull(comprasProgramadas.deletedAt),
        ),
      });
      if (!compra) throw new NotFoundException('Compra programada não encontrada');
      if (compra.status !== 'confirmada') {
        throw new ConflictException('Compra programada não confirmada');
      }
      if (!compra.operacaoId) {
        throw new ConflictException('Compra confirmada sem operação associada');
      }

      const itens = await tx.select({
        itemComercialId: disponibilidadesVirtuais.itemComercialId,
        quantidadePrevista: disponibilidadesVirtuais.quantidadeTotalGerada,
      }).from(disponibilidadesVirtuais)
        .where(eq(disponibilidadesVirtuais.compraProgramadaId, compra.id));
      if (!itens.length) {
        throw new ConflictException('Compra confirmada sem disponibilidade gerada');
      }

      const numero = `PF-${compra.numeroInterno}-${Date.now()}`;
      const pedido = primeiroOuFalha(await tx.insert(pedidosFornecedor).values({
        numero,
        fornecedorId: compra.fornecedorId,
        operacaoId: compra.operacaoId,
        compraProgramadaId: compra.id,
        status: 'rascunho',
      }).returning());

      await tx.insert(pedidosFornecedorItens).values(
        itens.map((item) => ({
          pedidoFornecedorId: pedido.id,
          itemComercialId: item.itemComercialId,
          quantidadePrevista: item.quantidadePrevista,
        })),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'pedidos_fornecedor',
        registroId: pedido.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: pedido,
      });

      return pedido;
    });

    this.eventEmitter.emit(EVENTOS.PEDIDO_FORNECEDOR_CRIADO, {
      pedidoFornecedorId: resultado.id,
      operacaoId: resultado.operacaoId,
    });
    return resultado;
  }

  /** Transição rascunho → aguardando_recebimento (libera iniciar recebimento). */
  async enviar(id: string, usuarioId: string) {
    return this.db.transaction(async (tx) => {
      const atual = await tx.select().from(pedidosFornecedor)
        .where(and(eq(pedidosFornecedor.id, id), isNull(pedidosFornecedor.deletedAt)))
        .then((r) => r[0] ?? null);
      if (!atual) throw new NotFoundException('Pedido ao fornecedor não encontrado');
      if (atual.status !== 'rascunho' && atual.status !== 'enviado') {
        throw new ConflictException(`Pedido em status ${atual.status} não pode ser enviado`);
      }
      const atualizado = primeiroOuFalha(await tx.update(pedidosFornecedor)
        .set({ status: 'aguardando_recebimento', updatedAt: new Date() })
        .where(eq(pedidosFornecedor.id, id))
        .returning());
      await this.auditoria.registrar(tx, {
        tabela: 'pedidos_fornecedor',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: atual,
        dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async registrarNf(pedidoId: string, dto: RegistrarNfDto, usuarioId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const pedido = await tx.select().from(pedidosFornecedor)
        .where(and(eq(pedidosFornecedor.id, pedidoId), isNull(pedidosFornecedor.deletedAt)))
        .then((r) => r[0] ?? null);
      if (!pedido) throw new NotFoundException('Pedido ao fornecedor não encontrado');

      let recebimentoId = dto.recebimentoId;
      if (recebimentoId) {
        const rec = await tx.select().from(recebimentos)
          .where(and(
            eq(recebimentos.id, recebimentoId),
            eq(recebimentos.pedidoFornecedorId, pedidoId),
            isNull(recebimentos.deletedAt),
          ))
          .then((r) => r[0] ?? null);
        if (!rec) throw new NotFoundException('Recebimento não encontrado para este pedido');
      } else {
        const rec = await tx.select().from(recebimentos)
          .where(and(
            eq(recebimentos.pedidoFornecedorId, pedidoId),
            isNull(recebimentos.deletedAt),
          ))
          .orderBy(desc(recebimentos.createdAt))
          .limit(1)
          .then((r) => r[0] ?? null);
        if (!rec) {
          throw new ConflictException('Inicie um recebimento antes de registrar a NF');
        }
        recebimentoId = rec.id;
      }

      const nf = primeiroOuFalha(await tx.insert(notasFiscaisFornecedor).values({
        pedidoFornecedorId: pedido.id,
        recebimentoId,
        numero: dto.numero,
        serie: dto.serie,
        chave: dto.chave,
        dataEmissao: dto.dataEmissao,
        pesoTotalDeclarado: dto.pesoTotalDeclarado === undefined
          ? null
          : formatarQtd(dto.pesoTotalDeclarado),
        payloadJson: dto.payload ?? {},
      }).returning());

      await tx.insert(notasFiscaisFornecedorItens).values(dto.itens.map((item) => ({
        nfId: nf.id,
        itemComercialId: item.itemComercialId,
        quantidadeDeclarada: formatarQtd(item.quantidadeDeclarada),
        pesoDeclarado: item.pesoDeclarado === undefined ? null : formatarQtd(item.pesoDeclarado),
      })));

      await this.auditoria.registrar(tx, {
        tabela: 'notas_fiscais_fornecedor',
        registroId: nf.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: nf,
      });

      return { nf, recebimentoId };
    });

    this.eventEmitter.emit(EVENTOS.NF_FORNECEDOR_REGISTRADA, {
      nfId: resultado.nf.id,
      pedidoFornecedorId: pedidoId,
      recebimentoId: resultado.recebimentoId,
    });
    return resultado.nf;
  }
}
