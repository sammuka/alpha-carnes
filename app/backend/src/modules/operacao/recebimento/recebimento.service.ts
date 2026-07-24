import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { notasFiscaisFornecedor, operacoes,
  clientes,
  comprasProgramadas,
  comprasProgramadasItens,
  fornecedores,
  itensComerciais,
  itensCompra,
  pecas,
  pedidosFornecedor,
  pedidosVenda,
  recebimentos,
  recebimentosItens,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  calcularRange,
  montarPaginado,
  primeiroOuFalha,
  type ListarQuery,
  type Paginado,
} from '../../../common/crud/paginacao';
import { compararQtd, ehZero, formatarQtd, subtrairQtd } from '../../../common/crud/decimal';
import { EVENTOS } from '../../../realtime/events/eventos';
import { DisponibilidadeService, type PedidoEmRisco } from '../../comercial/disponibilidade/disponibilidade.service';
import { OperacoesService } from '../../operacoes/operacoes.service';
import { DivergenciaRecebimentoService } from './divergencia/divergencia-recebimento.service';
import type { AtualizarMetadadosLoteDto, AtualizarNfeDto, IniciarRecebimentoDto, RegistrarItemDto } from './dto/recebimento.dto';
import {
  calcularProgressoBalanca,
  contarPecasPorItem,
  derivarTipoCarga,
  resolverMetadadosItensPrevistos,
} from './recebimento-metadados.helper';

type Tx = NodePgDatabase<typeof schema>;
type Recebimento = typeof recebimentos.$inferSelect;

export interface RecebimentoResumoEnriquecido {
  id: string;
  codigoLote: string;
  compraProgramadaId: string;
  numeroInternoCompra: string | null;
  fornecedorId: string;
  fornecedorNome: string;
  dataOperacao: string;
  status: string;
  nfeNumero: string | null;
  romaneio: string | null;
  tipoCarga: string | null;
  progressoBalanca: number;
}

export interface PrevisaoItemOperacional {
  itemComercialId: string;
  produtoCodigo: string;
  produtoDescricao: string;
  quantidadePrevista: string;
  unidade: string;
  passaBalanca: boolean;
  origemDescricao: string;
}

export interface PrevisaoRecebimento {
  compraProgramadaId: string;
  numeroInterno: string | null;
  fornecedorId: string;
  fornecedorNome: string;
  tipoCarga: string | null;
  observacoesCompra: string | null;
  resumoCompra: string;
  itensOperacionais: PrevisaoItemOperacional[];
  jaPossuiRecebimento: boolean;
}

export interface AcaoLote {
  id: string;
  hora: string;
  produtoCodigo: string | null;
  produtoDescricao: string | null;
  peso: string | null;
  destino: string;
  clientePedido: string | null;
  etiqueta: string | null;
  operadorNome: string | null;
  statusPeca: string | null;
  acao: string;
}

@Injectable()
export class RecebimentoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly disponibilidade: DisponibilidadeService,
    private readonly divergencias: DivergenciaRecebimentoService,
    private readonly operacoes: OperacoesService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<RecebimentoResumoEnriquecido>> {
    const { limit, offset } = calcularRange(query);
    const where = query.incluirRemovidos ? undefined : isNull(recebimentos.deletedAt);

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select({
          recebimento: recebimentos,
          numeroInterno: comprasProgramadas.numeroInterno,
          compraProgramadaId: pedidosFornecedor.compraProgramadaId,
          fornecedorNome: fornecedores.razaoSocial,
          dataOperacao: operacoes.data,
          nfeNumero: notasFiscaisFornecedor.numero,
        })
        .from(recebimentos)
        .innerJoin(pedidosFornecedor, eq(pedidosFornecedor.id, recebimentos.pedidoFornecedorId))
        .innerJoin(comprasProgramadas, eq(comprasProgramadas.id, pedidosFornecedor.compraProgramadaId))
        .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
        .innerJoin(fornecedores, eq(fornecedores.id, recebimentos.fornecedorId))
        .leftJoin(
          notasFiscaisFornecedor,
          and(
            eq(notasFiscaisFornecedor.pedidoFornecedorId, recebimentos.pedidoFornecedorId),
            isNull(notasFiscaisFornecedor.deletedAt),
          ),
        )
        .where(where)
        .orderBy(desc(recebimentos.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(recebimentos).where(where),
    ]);

    const enriquecidos: RecebimentoResumoEnriquecido[] = [];
    for (const linha of linhas) {
      const progresso = await this.calcularProgressoLote(linha.recebimento.id);
      const tipoCarga = await derivarTipoCarga(this.db, linha.compraProgramadaId);
      enriquecidos.push({
        id: linha.recebimento.id,
        codigoLote: linha.recebimento.id.slice(0, 8).toUpperCase(),
        compraProgramadaId: linha.compraProgramadaId,
        numeroInternoCompra: linha.numeroInterno,
        fornecedorId: linha.recebimento.fornecedorId,
        fornecedorNome: linha.fornecedorNome,
        dataOperacao: linha.dataOperacao,
        status: linha.recebimento.status,
        nfeNumero: linha.nfeNumero,
        romaneio: linha.recebimento.romaneio,
        tipoCarga,
        progressoBalanca: progresso,
      });
    }

    return montarPaginado(enriquecidos, totalRow[0]?.total ?? 0, query);
  }

  async previsaoDaCompra(compraProgramadaId: string): Promise<PrevisaoRecebimento> {
    const compra = await this.db.query.comprasProgramadas.findFirst({
      where: and(eq(comprasProgramadas.id, compraProgramadaId), isNull(comprasProgramadas.deletedAt)),
      with: { fornecedor: true },
    });
    if (!compra) throw new NotFoundException('Compra programada não encontrada');
    if (compra.status !== 'confirmada') {
      throw new ConflictException('Somente compras confirmadas podem abrir recebimento');
    }

    const existente = await this.db
      .select({ id: recebimentos.id })
      .from(recebimentos)
      .innerJoin(pedidosFornecedor, eq(pedidosFornecedor.id, recebimentos.pedidoFornecedorId))
      .where(and(
        eq(pedidosFornecedor.compraProgramadaId, compraProgramadaId),
        isNull(recebimentos.deletedAt),
      ))
      .then((r) => r[0] ?? null);

    const esperados = await this.disponibilidade.listarEsperadoDaCompra(this.db, compraProgramadaId);
    const ids = esperados.map((e) => e.itemComercialId);
    const metadados = await resolverMetadadosItensPrevistos(this.db, compraProgramadaId, compra.numeroInterno, ids);

    const comerciais = ids.length
      ? await this.db
          .select()
          .from(itensComerciais)
          .where(inArray(itensComerciais.id, ids))
      : [];

    const comercialMap = new Map(comerciais.map((c) => [c.id, c]));

    const itensCompraLinhas = await this.db
      .select({
        descricao: itensCompra.descricao,
        quantidade: comprasProgramadasItens.quantidadeComprada,
        unidade: itensCompra.unidadeCompra,
      })
      .from(comprasProgramadasItens)
      .innerJoin(itensCompra, eq(itensCompra.id, comprasProgramadasItens.itemCompraId))
      .where(and(eq(comprasProgramadasItens.compraProgramadaId, compraProgramadaId), isNull(comprasProgramadasItens.deletedAt)));

    const resumoCompra = itensCompraLinhas
      .map((i) => `${i.quantidade} ${i.descricao}`)
      .join(' + ');

    const tipoCarga = await derivarTipoCarga(this.db, compraProgramadaId);

    return {
      compraProgramadaId: compra.id,
      numeroInterno: compra.numeroInterno,
      fornecedorId: compra.fornecedorId,
      fornecedorNome: compra.fornecedor.razaoSocial,
      tipoCarga,
      observacoesCompra: compra.observacoes,
      resumoCompra,
      itensOperacionais: esperados.map((e) => {
        const meta = metadados.get(e.itemComercialId);
        const ic = comercialMap.get(e.itemComercialId);
        return {
          itemComercialId: e.itemComercialId,
          produtoCodigo: ic?.codigo ?? '',
          produtoDescricao: ic?.descricao ?? '',
          quantidadePrevista: e.quantidadeTotalGerada,
          unidade: meta?.unidadeEsperada ?? ic?.unidadeComercial ?? 'unidade',
          passaBalanca: meta?.requerBalanca ?? true,
          origemDescricao: meta?.origemDescricao ?? compra.numeroInterno ?? 'Compra',
        };
      }),
      jaPossuiRecebimento: Boolean(existente),
    };
  }

  async detalhar(id: string) {
    const recebimento = await this.db.query.recebimentos.findFirst({
      where: and(eq(recebimentos.id, id), isNull(recebimentos.deletedAt)),
      with: {
        fornecedor: true,
        pedidoFornecedor: true,
        operacao: true,
        itens: { with: { itemComercial: true } },
        divergencias: true,
      },
    });
    if (!recebimento) throw new NotFoundException('Recebimento não encontrado');

    const pecasMap = await contarPecasPorItem(this.db, id);
    const tipoCarga = await derivarTipoCarga(this.db, recebimento.pedidoFornecedor.compraProgramadaId);
    const progressoBalanca = await this.calcularProgressoLote(id);

    const itensEnriquecidos = recebimento.itens.map((item) => {
      const apurado = pecasMap.get(item.itemComercialId);
      const qtdApurada =
        item.requerBalanca === false
          ? item.quantidadeRecebida
          : String(apurado?.quantidade ?? Number(item.quantidadeRecebida));
      return {
        ...item,
        quantidadeApurada: qtdApurada,
        pesoApurado: item.requerBalanca === false ? null : (apurado?.pesoTotal ?? item.pesoTotalApurado),
      };
    });

    return {
      ...recebimento,
      tipoCarga,
      progressoBalanca,
      codigoLote: recebimento.id.slice(0, 8).toUpperCase(),
      itens: itensEnriquecidos,
    };
  }

  async iniciar(dto: IniciarRecebimentoDto, usuarioId: string): Promise<{ recebimento: Recebimento; jaIniciado: boolean }> {
    const resultado = await this.db.transaction(async (tx) => {
      const pedido = await tx.select().from(pedidosFornecedor)
        .where(and(
          eq(pedidosFornecedor.id, dto.pedidoFornecedorId),
          isNull(pedidosFornecedor.deletedAt),
        ))
        .then((r) => r[0] ?? null);
      if (!pedido) throw new NotFoundException('Pedido ao fornecedor não encontrado');
      if (!['enviado', 'aguardando_recebimento'].includes(pedido.status)) {
        throw new ConflictException('Pedido ao fornecedor não está aguardando recebimento');
      }

      const compra = await tx
        .select()
        .from(comprasProgramadas)
        .where(and(
          eq(comprasProgramadas.id, pedido.compraProgramadaId),
          isNull(comprasProgramadas.deletedAt),
        ))
        .then((r) => r[0] ?? null);
      if (!compra) throw new NotFoundException('Compra programada não encontrada');

      const esperados = await this.disponibilidade.listarEsperadoDaCompra(tx, compra.id);
      if (esperados.length === 0) {
        throw new ConflictException('Compra confirmada sem itens operacionais previstos');
      }

      const criado = primeiroOuFalha(
        await tx
          .insert(recebimentos)
          .values({
            pedidoFornecedorId: pedido.id,
            fornecedorId: pedido.fornecedorId,
            operacaoId: pedido.operacaoId,
            dataHoraChegada: dto.dataHoraChegada ? new Date(dto.dataHoraChegada) : undefined,
            notaFiscalFornecedor: dto.nfeNumero,
            romaneio: dto.romaneio,
            placaVeiculo: dto.placaVeiculo,
            motorista: dto.motorista,
            doca: dto.doca,
            observacoes: dto.observacoes,
            responsavelRecebimentoId: usuarioId,
            status: 'pesagem_em_andamento',
          })
          .returning(),
      );

      const ids = esperados.map((e) => e.itemComercialId);
      const metadados = await resolverMetadadosItensPrevistos(tx, compra.id, compra.numeroInterno, ids);

      await tx.insert(recebimentosItens).values(
        esperados.map((e) => {
          const meta = metadados.get(e.itemComercialId);
          const requerBalanca = meta?.requerBalanca ?? true;
          const entradaDireta = !requerBalanca;
          return {
            recebimentoId: criado.id,
            itemComercialId: e.itemComercialId,
            origemDescricao: meta?.origemDescricao,
            quantidadeEsperada: e.quantidadeTotalGerada,
            quantidadeRecebida: entradaDireta ? e.quantidadeTotalGerada : '0',
            unidadeEsperada: meta?.unidadeEsperada,
            requerBalanca,
            statusApuracao: entradaDireta ? ('entrada_direta' as const) : ('aguardando' as const),
          };
        }),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos',
        registroId: criado.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: criado,
      });

      return { recebimento: criado, jaIniciado: false };
    });

    const dataOperacao = await this.db
      .select({ data: operacoes.data })
      .from(operacoes)
      .where(eq(operacoes.id, resultado.recebimento.operacaoId))
      .then((r) => r[0]?.data ?? '');
    const compraProgramadaId = await this.db
      .select({ id: pedidosFornecedor.compraProgramadaId })
      .from(pedidosFornecedor)
      .where(eq(pedidosFornecedor.id, resultado.recebimento.pedidoFornecedorId))
      .then((r) => r[0]?.id ?? '');
    this.eventEmitter.emit(EVENTOS.RECEBIMENTO_INICIADO, {
      recebimentoId: resultado.recebimento.id,
      compraProgramadaId,
      dataOperacao,
    });
    this.eventEmitter.emit(EVENTOS.RECEBIMENTO_ESTADO_ALTERADO, {
      recebimentoId: resultado.recebimento.id,
      statusAnterior: 'novo',
      statusAtual: resultado.recebimento.status,
    });
    return resultado;
  }

  async atualizarNfe(recebimentoId: string, dto: AtualizarNfeDto, usuarioId: string): Promise<Recebimento> {
    return this.db.transaction(async (tx) => {
      const atual = await this.buscarAtivo(tx, recebimentoId);
      if (!atual) throw new NotFoundException('Recebimento não encontrado');
      if (atual.status === 'finalizado' || atual.status === 'cancelado') {
        throw new ConflictException('Recebimento finalizado ou cancelado não pode ser alterado');
      }

      const patch: Partial<typeof recebimentos.$inferInsert> = {};
      // Cache nfe_* removido no contract 0014; número exibido fica em notaFiscalFornecedor.
      // NF estruturada vive em notas_fiscais_fornecedor (POST dedicado).
      if (dto.nfeNumero !== undefined) patch.notaFiscalFornecedor = dto.nfeNumero;
      if (dto.romaneio !== undefined) patch.romaneio = dto.romaneio;
      if (dto.placaVeiculo !== undefined) patch.placaVeiculo = dto.placaVeiculo;
      if (dto.motorista !== undefined) patch.motorista = dto.motorista;
      if (dto.doca !== undefined) patch.doca = dto.doca;
      if (dto.observacoes !== undefined) patch.observacoes = dto.observacoes;

      const atualizado = primeiroOuFalha(
        await tx.update(recebimentos).set(patch).where(eq(recebimentos.id, recebimentoId)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos',
        registroId: recebimentoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: atual,
        dadosNovos: atualizado,
      });

      return atualizado;
    });
  }

  async cancelar(recebimentoId: string, usuarioId: string): Promise<Recebimento> {
    return this.db.transaction(async (tx) => {
      const atual = await this.buscarAtivo(tx, recebimentoId);
      if (!atual) throw new NotFoundException('Recebimento não encontrado');
      if (!['aguardando_conferencia', 'em_conferencia'].includes(atual.status)) {
        throw new ConflictException('Somente lotes em aberto podem ser cancelados');
      }

      const pecasCount = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(pecas)
        .where(and(eq(pecas.recebimentoId, recebimentoId), isNull(pecas.deletedAt)))
        .then((r) => r[0]?.total ?? 0);
      if (pecasCount > 0) {
        throw new ConflictException('Não é permitido cancelar lote com pesagem registrada');
      }

      const cancelado = primeiroOuFalha(
        await tx
          .update(recebimentos)
          .set({ status: 'cancelado' })
          .where(eq(recebimentos.id, recebimentoId))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos',
        registroId: recebimentoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: atual,
        dadosNovos: cancelado,
      });

      return cancelado;
    });
  }

  async registrarItem(recebimentoId: string, dto: RegistrarItemDto, usuarioId: string): Promise<{ itemId: string }> {
    const resultado = await this.db.transaction(async (tx) => {
      const recebimento = await this.buscarAtivo(tx, recebimentoId);
      if (!recebimento) throw new NotFoundException('Recebimento não encontrado');
      if (['conferido_sem_divergencia', 'conferido_com_divergencia', 'cancelado', 'finalizado'].includes(recebimento.status)) {
        throw new ConflictException('Recebimento finalizado ou cancelado é imutável');
      }
      const ctx = await this.contextoOperacional(tx, recebimento);

      const recebido = formatarQtd(dto.quantidadeRecebida);

      let item = await tx
        .select()
        .from(recebimentosItens)
        .where(
          and(
            eq(recebimentosItens.recebimentoId, recebimentoId),
            eq(recebimentosItens.itemComercialId, dto.itemComercialId),
          ),
        )
        .then((r) => r[0] ?? null);

      const ehExcedente = !item;
      if (!item) {
        item = primeiroOuFalha(
          await tx
            .insert(recebimentosItens)
            .values({
              recebimentoId,
              itemComercialId: dto.itemComercialId,
              quantidadeEsperada: '0',
              quantidadeRecebida: '0',
              statusApuracao: 'aguardando',
            })
            .returning(),
        );
      }

      const recebidaAnterior = item.quantidadeRecebida;
      const divergenteAnterior =
        item.statusApuracao === 'divergente' ? this.calcularDivergente(item.quantidadeEsperada, recebidaAnterior) : '0';
      const diff = subtrairQtd(item.quantidadeEsperada, recebido);
      const temDiferenca = ehExcedente || !ehZero(diff);

      if (temDiferenca && !dto.divergencia) {
        throw new ConflictException('Diferença esperado×recebido exige registro formal de divergência');
      }

      const statusApuracao = temDiferenca ? 'divergente' : 'conferido';
      const atualizado = primeiroOuFalha(
        await tx
          .update(recebimentosItens)
          .set({
            quantidadeRecebida: recebido,
            pesoTotalApurado: dto.pesoTotalApurado !== undefined ? formatarQtd(dto.pesoTotalApurado) : item.pesoTotalApurado,
            statusApuracao,
            observacoes: dto.observacoes ?? item.observacoes,
          })
          .where(eq(recebimentosItens.id, item.id))
          .returning(),
      );

      let divergenciaAberta: { id: string; tipo: string } | null = null;
      if (temDiferenca && dto.divergencia) {
        const divergencia = await this.divergencias.abrirNaTx(
          tx,
          {
            recebimentoId,
            recebimentoItemId: atualizado.id,
            ...dto.divergencia,
          },
          usuarioId,
        );
        divergenciaAberta = { id: divergencia.id, tipo: divergencia.tipo };
        await tx
          .update(recebimentos)
          .set({ status: 'em_conferencia' })
          .where(and(eq(recebimentos.id, recebimentoId), ne(recebimentos.status, 'finalizado')));
      }

      const divergenteNovo = this.calcularDivergente(atualizado.quantidadeEsperada, recebido);
      const deltaRecebido = subtrairQtd(recebido, recebidaAnterior);
      const deltaComDivergencia = subtrairQtd(divergenteNovo, divergenteAnterior);
      if (!ehExcedente) {
        await this.disponibilidade.aplicarRecebimentoDelta(
          tx,
          {
            compraProgramadaId: ctx.compraProgramadaId,
            itemComercialId: dto.itemComercialId,
            deltaRecebido,
            deltaComDivergencia,
          },
          usuarioId,
        );
      }

      let pedidosEmRisco: PedidoEmRisco[] = [];
      if (divergenciaAberta && !ehExcedente) {
        pedidosEmRisco = await this.disponibilidade.listarPedidosEmRisco(
          tx,
          ctx.compraProgramadaId,
          dto.itemComercialId,
        );
      }

      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos_itens',
        registroId: atualizado.id,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: item,
        dadosNovos: atualizado,
      });

      return {
        itemId: atualizado.id,
        dataOperacao: ctx.dataOperacao,
        itemComercialId: dto.itemComercialId,
        divergenciaAberta,
        pedidosEmRisco,
      };
    });

    this.eventEmitter.emit(EVENTOS.RECEBIMENTO_REGISTRADO, {
      recebimentoId,
      dataOperacao: resultado.dataOperacao,
      etapa: 'item' as const,
      itemComercialId: resultado.itemComercialId,
    });
    if (resultado.divergenciaAberta) {
      this.eventEmitter.emit(EVENTOS.DIVERGENCIA_RECEBIMENTO_ABERTA, {
        divergenciaId: resultado.divergenciaAberta.id,
        recebimentoId,
        dataOperacao: resultado.dataOperacao,
        tipo: resultado.divergenciaAberta.tipo,
        status: 'aberta',
      });
    }
    if (resultado.pedidosEmRisco.length > 0) {
      this.eventEmitter.emit(EVENTOS.PEDIDO_EM_RISCO, {
        dataOperacao: resultado.dataOperacao,
        origem: 'recebimento' as const,
        pedidos: resultado.pedidosEmRisco,
      });
    }

    return { itemId: resultado.itemId };
  }

  async concluir(recebimentoId: string, usuarioId: string): Promise<{ recebimento: Recebimento; jaConcluido: boolean }> {
    const resultado = await this.db.transaction(async (tx) => {
      const atual = await this.buscarAtivo(tx, recebimentoId);
      if (!atual) throw new NotFoundException('Recebimento não encontrado');

      const abertas = await this.divergencias.contarAbertasSemTratativa(tx, recebimentoId);
      if (abertas > 0) {
        throw new ConflictException('Não é permitido concluir com divergência sem tratativa registrada');
      }

      const concluido = await tx
        .update(recebimentos)
        .set({ status: 'finalizado', usuarioConclusaoId: usuarioId, dataConclusao: sql`now()` })
        .where(and(eq(recebimentos.id, recebimentoId), ne(recebimentos.status, 'finalizado')))
        .returning()
        .then((r) => r[0] ?? null);

      const ctx = await this.contextoOperacional(tx, atual);
      if (!concluido) {
        const jaConcluido = primeiroOuFalha(await this.buscarAtivo(tx, recebimentoId).then((r) => (r ? [r] : [])));
        return { recebimento: jaConcluido, jaConcluido: true, dataOperacao: ctx.dataOperacao, pedidosEmRisco: [] as PedidoEmRisco[] };
      }

      const itens = await tx
        .select({ itemComercialId: recebimentosItens.itemComercialId })
        .from(recebimentosItens)
        .where(eq(recebimentosItens.recebimentoId, recebimentoId));
      const pedidosEmRisco: PedidoEmRisco[] = [];
      for (const it of itens) {
        const risco = await this.disponibilidade.listarPedidosEmRisco(tx, ctx.compraProgramadaId, it.itemComercialId);
        pedidosEmRisco.push(...risco);
      }

      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos',
        registroId: recebimentoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: atual,
        dadosNovos: concluido,
      });

      return { recebimento: concluido, jaConcluido: false, dataOperacao: ctx.dataOperacao, pedidosEmRisco };
    });

    if (!resultado.jaConcluido) {
      this.eventEmitter.emit(EVENTOS.RECEBIMENTO_REGISTRADO, {
        recebimentoId,
        dataOperacao: resultado.dataOperacao,
        etapa: 'conclusao' as const,
      });
      if (resultado.pedidosEmRisco.length > 0) {
        this.eventEmitter.emit(EVENTOS.PEDIDO_EM_RISCO, {
          dataOperacao: resultado.dataOperacao,
          origem: 'conclusao' as const,
          pedidos: resultado.pedidosEmRisco,
        });
      }
    }

    return { recebimento: resultado.recebimento, jaConcluido: resultado.jaConcluido };
  }

  async suspender(recebimentoId: string, usuarioId: string): Promise<Recebimento> {
    return this.db.transaction(async (tx) => {
      const atual = await this.buscarAtivo(tx, recebimentoId);
      if (!atual) throw new NotFoundException('Recebimento não encontrado');
      if (atual.status !== 'em_conferencia') {
        throw new ConflictException('Somente recebimentos em conferência podem ser suspensos');
      }

      const suspenso = primeiroOuFalha(
        await tx
          .update(recebimentos)
          .set({ status: 'aguardando_conferencia' })
          .where(eq(recebimentos.id, recebimentoId))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos',
        registroId: recebimentoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: atual,
        dadosNovos: suspenso,
      });

      return suspenso;
    });
  }

  async atualizarMetadados(
    recebimentoId: string,
    dto: AtualizarMetadadosLoteDto,
    usuarioId: string,
  ): Promise<Recebimento> {
    return this.db.transaction(async (tx) => {
      const atual = await this.buscarAtivo(tx, recebimentoId);
      if (!atual) throw new NotFoundException('Recebimento não encontrado');
      if (atual.status === 'finalizado' || atual.status === 'cancelado') {
        throw new ConflictException('Recebimento finalizado ou cancelado não pode ser alterado');
      }

      const patch: Partial<typeof recebimentos.$inferInsert> = {};
      if (dto.placaVeiculo !== undefined) patch.placaVeiculo = dto.placaVeiculo;
      if (dto.motorista !== undefined) patch.motorista = dto.motorista;
      if (dto.doca !== undefined) patch.doca = dto.doca;
      if (dto.observacoes !== undefined) patch.observacoes = dto.observacoes;

      const atualizado = primeiroOuFalha(
        await tx.update(recebimentos).set(patch).where(eq(recebimentos.id, recebimentoId)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos',
        registroId: recebimentoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: atual,
        dadosNovos: atualizado,
      });

      return atualizado;
    });
  }

  /** Ações/peças realizadas no lote (para tabela operacional de pesagem). */
  async listarAcoes(recebimentoId: string): Promise<AcaoLote[]> {
    const lote = await this.buscarAtivo(this.db, recebimentoId);
    if (!lote) throw new NotFoundException('Recebimento não encontrado');

    const linhas = await this.db
      .select({
        peca: pecas,
        produtoCodigo: itensComerciais.codigo,
        produtoDescricao: itensComerciais.descricao,
        clienteNome: clientes.nomeFantasia,
        clienteRazao: clientes.razaoSocial,
      })
      .from(pecas)
      .innerJoin(itensComerciais, eq(itensComerciais.id, pecas.itemComercialBaseId))
      .leftJoin(pedidosVenda, eq(pedidosVenda.id, pecas.pedidoVendaId))
      .leftJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .where(and(eq(pecas.recebimentoId, recebimentoId), isNull(pecas.deletedAt)))
      .orderBy(desc(pecas.dataHoraPesagem));

    const destinoPorStatus: Record<string, string> = {
      associada: 'Pedido',
      em_sobra: 'Estoque',
      para_corte: 'Desossa',
      pesada: 'Aguardando destino',
      em_analise: 'Análise',
      divergente: 'Divergência',
    };

    return linhas.map((l) => {
      const meta = l.peca.capturaMeta as { operador?: string } | null;
      const cliente =
        l.clienteNome ?? l.clienteRazao ?? (l.peca.pedidoVendaId ? l.peca.pedidoVendaId.slice(0, 8) : null);
      return {
        id: l.peca.id,
        hora: l.peca.dataHoraPesagem.toISOString(),
        produtoCodigo: l.produtoCodigo,
        produtoDescricao: l.produtoDescricao,
        peso: l.peca.pesoOriginal,
        destino: destinoPorStatus[l.peca.statusPeca] ?? l.peca.statusPeca,
        clientePedido: cliente,
        etiqueta: l.peca.etiquetaAtual,
        operadorNome: meta?.operador ?? null,
        statusPeca: l.peca.statusPeca,
        acao: l.peca.statusPeca,
      };
    });
  }

  private async calcularProgressoLote(recebimentoId: string): Promise<number> {
    const itens = await this.db
      .select()
      .from(recebimentosItens)
      .where(eq(recebimentosItens.recebimentoId, recebimentoId));
    const pecasMap = await contarPecasPorItem(this.db, recebimentoId);
    return calcularProgressoBalanca(
      itens.map((item) => ({
        quantidadeEsperada: item.quantidadeEsperada,
        requerBalanca: item.requerBalanca,
        quantidadeApurada: pecasMap.get(item.itemComercialId)?.quantidade ?? Number(item.quantidadeRecebida),
      })),
    );
  }

  private calcularDivergente(esperada: string, recebida: string): string {
    const diff = subtrairQtd(esperada, recebida);
    return compararQtd(diff, '0') < 0 ? subtrairQtd('0', diff) : diff;
  }

  private async contextoOperacional(
    tx: Tx,
    recebimento: Pick<Recebimento, 'pedidoFornecedorId' | 'operacaoId'>,
  ): Promise<{ compraProgramadaId: string; dataOperacao: string }> {
    const linha = await tx
      .select({
        compraProgramadaId: pedidosFornecedor.compraProgramadaId,
        dataOperacao: operacoes.data,
      })
      .from(pedidosFornecedor)
      .innerJoin(operacoes, eq(operacoes.id, recebimento.operacaoId))
      .where(eq(pedidosFornecedor.id, recebimento.pedidoFornecedorId))
      .then((r) => r[0] ?? null);
    if (!linha) throw new NotFoundException('Contexto operacional do recebimento não encontrado');
    return linha;
  }

  private async buscarAtivo(tx: Tx, id: string): Promise<Recebimento | null> {
    return tx
      .select()
      .from(recebimentos)
      .where(and(eq(recebimentos.id, id), isNull(recebimentos.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
