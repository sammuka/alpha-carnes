import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
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
  pedidosFornecedorItens,
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
import {
  buscarNfAtivaDoRecebimento,
  persistirNfDeCamposUiNaTx,
  temCamposNfEstruturados,
} from './nota-fiscal-fornecedor.persistence';
import { pedidoFornecedorPodeReceber } from './pedido-fornecedor.service';

type Tx = NodePgDatabase<typeof schema>;
type Recebimento = typeof recebimentos.$inferSelect;

export interface RecebimentoResumoEnriquecido {
  id: string;
  codigoLote: string;
  compraProgramadaId: string;
  numeroSequencialCompra: number;
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
  pesoPrevisto: string | null;
  unidade: string;
  passaBalanca: boolean;
  origemDescricao: string;
}

export interface PrevisaoRecebimento {
  pedidoFornecedorId: string;
  numeroPedidoFornecedor: string;
  statusPedidoFornecedor: 'enviado' | 'aguardando_recebimento';
  operacaoId: string;
  dataOperacao: string;
  compraProgramadaId: string;
  numeroSequencialCompra: number;
  numeroInternoCompra: string | null;
  fornecedorId: string;
  fornecedorNome: string;
  tipoCarga: string | null;
  observacoesCompra: string | null;
  resumoCompra: string;
  itensOperacionais: PrevisaoItemOperacional[];
}

type IniciarRecebimentoResultado = {
  recebimento: Recebimento;
  jaIniciado: false;
};

type InicioRecebimentoInterno = {
  recebimento: Recebimento;
  nfId: string | null;
};

type ContextoInicioPosCommit = {
  recebimento: Recebimento;
  compraProgramadaId: string;
  dataOperacao: string;
};

type SnapshotPedidoFornecedor = {
  pedido: typeof pedidosFornecedor.$inferSelect;
  fornecedorNome: string;
  dataOperacao: string;
  numeroInternoCompra: string | null;
  numeroSequencialCompra: number;
  observacoesCompra: string | null;
  tipoCarga: string | null;
  resumoCompra: string;
  itens: Array<{
    itemComercialId: string;
    produtoCodigo: string;
    produtoDescricao: string;
    quantidadePrevista: string;
    pesoPrevisto: string | null;
    unidade: string;
    passaBalanca: boolean;
    origemDescricao: string;
  }>;
};

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

function codigoLoteDeSequencial(numeroSequencial: number): string {
  return `Lote ${String(numeroSequencial).padStart(3, '0')}`;
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
          numeroSequencial: comprasProgramadas.numeroSequencial,
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
        codigoLote: codigoLoteDeSequencial(linha.numeroSequencial),
        compraProgramadaId: linha.compraProgramadaId,
        numeroSequencialCompra: linha.numeroSequencial,
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

  async previsaoDoPedidoFornecedor(pedidoFornecedorId: string): Promise<PrevisaoRecebimento> {
    const snapshot = await this.carregarSnapshotPedidoFornecedor(this.db, pedidoFornecedorId);
    return {
      pedidoFornecedorId: snapshot.pedido.id,
      numeroPedidoFornecedor: snapshot.pedido.numero,
      statusPedidoFornecedor: snapshot.pedido.status as 'enviado' | 'aguardando_recebimento',
      operacaoId: snapshot.pedido.operacaoId,
      dataOperacao: snapshot.dataOperacao,
      compraProgramadaId: snapshot.pedido.compraProgramadaId,
      numeroSequencialCompra: snapshot.numeroSequencialCompra,
      numeroInternoCompra: snapshot.numeroInternoCompra,
      fornecedorId: snapshot.pedido.fornecedorId,
      fornecedorNome: snapshot.fornecedorNome,
      tipoCarga: snapshot.tipoCarga,
      observacoesCompra: snapshot.observacoesCompra,
      resumoCompra: snapshot.resumoCompra,
      itensOperacionais: snapshot.itens,
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
    const [compra] = await this.db
      .select({ numeroSequencial: comprasProgramadas.numeroSequencial })
      .from(comprasProgramadas)
      .where(eq(comprasProgramadas.id, recebimento.pedidoFornecedor.compraProgramadaId))
      .limit(1);
    if (!compra) throw new NotFoundException('Compra programada do recebimento não encontrada');
    const tipoCarga = await derivarTipoCarga(this.db, recebimento.pedidoFornecedor.compraProgramadaId);
    const progressoBalanca = await this.calcularProgressoLote(id);
    const nfAtiva = await buscarNfAtivaDoRecebimento(this.db, id);
    const payloadNf = nfAtiva?.payloadJson as { volumes?: number; pesoLiquido?: number } | null;

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
      codigoLote: codigoLoteDeSequencial(compra.numeroSequencial),
      numeroSequencialCompra: compra.numeroSequencial,
      nfeNumero: nfAtiva?.numero ?? recebimento.notaFiscalFornecedor,
      nfeSerie: nfAtiva?.serie ?? null,
      nfeChave: nfAtiva?.chave ?? null,
      nfeDataEmissao: nfAtiva?.dataEmissao ?? null,
      nfePesoBruto: nfAtiva?.pesoTotalDeclarado ?? null,
      nfePesoLiquido:
        payloadNf?.pesoLiquido !== undefined ? formatarQtd(payloadNf.pesoLiquido) : null,
      nfeVolumes: payloadNf?.volumes ?? null,
      itens: itensEnriquecidos,
    };
  }

  async iniciar(
    dto: IniciarRecebimentoDto,
    usuarioId: string,
  ): Promise<IniciarRecebimentoResultado> {
    const interno: InicioRecebimentoInterno = await this.db.transaction(async (tx) => {
      const snapshot = await this.carregarSnapshotPedidoFornecedor(tx, dto.pedidoFornecedorId);
      if (snapshot.itens.length === 0) {
        throw new ConflictException('Pedido ao fornecedor sem itens operacionais previstos');
      }

      const criado = primeiroOuFalha(
        await tx
          .insert(recebimentos)
          .values({
            pedidoFornecedorId: snapshot.pedido.id,
            fornecedorId: snapshot.pedido.fornecedorId,
            operacaoId: snapshot.pedido.operacaoId,
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

      await tx.insert(recebimentosItens).values(
        snapshot.itens.map((item) => {
          const requerBalanca = item.passaBalanca;
          const entradaDireta = !requerBalanca;
          return {
            recebimentoId: criado.id,
            itemComercialId: item.itemComercialId,
            origemDescricao: item.origemDescricao,
            quantidadeEsperada: item.quantidadePrevista,
            quantidadeRecebida: entradaDireta ? item.quantidadePrevista : '0',
            unidadeEsperada: item.unidade,
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

      let nfId: string | null = null;
      if (temCamposNfEstruturados(dto)) {
        const nf = await persistirNfDeCamposUiNaTx(tx, this.auditoria, {
          pedidoFornecedorId: snapshot.pedido.id,
          recebimentoId: criado.id,
          campos: dto,
          usuarioId,
        });
        nfId = nf.id;
      }

      return { recebimento: criado, nfId };
    });

    const contexto = await this.carregarContextoInicioPosCommit(interno.recebimento.id);
    this.eventEmitter.emit(EVENTOS.RECEBIMENTO_INICIADO, {
      recebimentoId: contexto.recebimento.id,
      compraProgramadaId: contexto.compraProgramadaId,
      dataOperacao: contexto.dataOperacao,
    });
    this.eventEmitter.emit(EVENTOS.RECEBIMENTO_ESTADO_ALTERADO, {
      recebimentoId: contexto.recebimento.id,
      statusAnterior: 'novo',
      statusAtual: contexto.recebimento.status,
    });
    if (interno.nfId) {
      this.eventEmitter.emit(EVENTOS.NF_FORNECEDOR_REGISTRADA, {
        nfId: interno.nfId,
        pedidoFornecedorId: contexto.recebimento.pedidoFornecedorId,
        recebimentoId: contexto.recebimento.id,
      });
    }
    return { recebimento: contexto.recebimento, jaIniciado: false };
  }

  async atualizarNfe(recebimentoId: string, dto: AtualizarNfeDto, usuarioId: string): Promise<Recebimento> {
    const { recebimento: atualizado, nfMeta } = await this.db.transaction(async (tx) => {
      const atual = await this.buscarAtivo(tx, recebimentoId);
      if (!atual) throw new NotFoundException('Recebimento não encontrado');
      if ([
        'aguardando_conferencia_final',
        'conferido_sem_divergencia',
        'conferido_com_divergencia',
        'cancelado',
      ].includes(atual.status)) {
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

      const atualizadoRow = primeiroOuFalha(
        await tx.update(recebimentos).set(patch).where(eq(recebimentos.id, recebimentoId)).returning(),
      );

      let nfMeta: { id: string; pedidoFornecedorId: string } | null = null;
      if (temCamposNfEstruturados(dto)) {
        if (!atual.pedidoFornecedorId) {
          throw new ConflictException('Recebimento sem pedido ao fornecedor não pode registrar NF estruturada');
        }
        const nf = await persistirNfDeCamposUiNaTx(tx, this.auditoria, {
          pedidoFornecedorId: atual.pedidoFornecedorId,
          recebimentoId,
          campos: dto,
          usuarioId,
        });
        nfMeta = { id: nf.id, pedidoFornecedorId: atual.pedidoFornecedorId };
      }

      await this.auditoria.registrar(tx, {
        tabela: 'recebimentos',
        registroId: recebimentoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: atual,
        dadosNovos: atualizadoRow,
      });

      return { recebimento: atualizadoRow, nfMeta };
    });

    if (nfMeta) {
      this.eventEmitter.emit(EVENTOS.NF_FORNECEDOR_REGISTRADA, {
        nfId: nfMeta.id,
        pedidoFornecedorId: nfMeta.pedidoFornecedorId,
        recebimentoId,
      });
    }
    return atualizado;
  }

  async cancelar(recebimentoId: string, usuarioId: string): Promise<Recebimento> {
    return this.db.transaction(async (tx) => {
      const atual = await this.buscarAtivo(tx, recebimentoId);
      if (!atual) throw new NotFoundException('Recebimento não encontrado');
      if (![
        'pesagem_em_andamento',
        'aguardando_conclusao_pesagem',
      ].includes(atual.status)) {
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
      if ([
        'aguardando_conferencia_final',
        'conferido_sem_divergencia',
        'conferido_com_divergencia',
        'ocorrencia_administrativa_aberta',
        'tratativa_administrativa_concluida',
        'cancelado',
      ].includes(recebimento.status)) {
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
        // Divergência não encerra a pesagem — permanece em pesagem_em_andamento
        // até concluir() (ou conferência tripla) avançar o lifecycle.
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
          ctx.operacaoId,
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
        .set({
          status: 'aguardando_conferencia_final',
          usuarioConclusaoId: usuarioId,
          dataConclusao: sql`now()`,
        })
        .where(and(
          eq(recebimentos.id, recebimentoId),
          ne(recebimentos.status, 'aguardando_conferencia_final'),
          ne(recebimentos.status, 'conferido_sem_divergencia'),
          ne(recebimentos.status, 'conferido_com_divergencia'),
        ))
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
        const risco = await this.disponibilidade.listarPedidosEmRisco(tx, ctx.operacaoId, it.itemComercialId);
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
      if (atual.status !== 'aguardando_conferencia_final') {
        throw new ConflictException('Somente recebimentos aguardando conferência final podem ser suspensos');
      }

      const suspenso = primeiroOuFalha(
        await tx
          .update(recebimentos)
          .set({ status: 'pesagem_em_andamento' })
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
      if ([
        'aguardando_conferencia_final',
        'conferido_sem_divergencia',
        'conferido_com_divergencia',
        'cancelado',
      ].includes(atual.status)) {
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

  private async carregarSnapshotPedidoFornecedor(
    tx: Tx,
    pedidoFornecedorId: string,
  ): Promise<SnapshotPedidoFornecedor> {
    const cabecalho = await tx
      .select({
        pedido: pedidosFornecedor,
        fornecedorNome: fornecedores.razaoSocial,
        dataOperacao: operacoes.data,
        numeroInternoCompra: comprasProgramadas.numeroInterno,
        numeroSequencialCompra: comprasProgramadas.numeroSequencial,
        observacoesCompra: comprasProgramadas.observacoes,
      })
      .from(pedidosFornecedor)
      .innerJoin(fornecedores, eq(fornecedores.id, pedidosFornecedor.fornecedorId))
      .innerJoin(operacoes, eq(operacoes.id, pedidosFornecedor.operacaoId))
      .innerJoin(
        comprasProgramadas,
        and(
          eq(comprasProgramadas.id, pedidosFornecedor.compraProgramadaId),
          isNull(comprasProgramadas.deletedAt),
        ),
      )
      .where(and(
        eq(pedidosFornecedor.id, pedidoFornecedorId),
        isNull(pedidosFornecedor.deletedAt),
      ))
      .limit(1)
      .then((rows) => rows[0]);
    if (!cabecalho) {
      throw new NotFoundException('Pedido ao fornecedor não encontrado');
    }
    if (!pedidoFornecedorPodeReceber(cabecalho.pedido.status)) {
      throw new ConflictException('Pedido ao fornecedor não está aguardando recebimento');
    }

    const itensSnapshot = await tx
      .select({
        itemComercialId: pedidosFornecedorItens.itemComercialId,
        produtoCodigo: itensComerciais.codigo,
        produtoDescricao: itensComerciais.descricao,
        quantidadePrevista: pedidosFornecedorItens.quantidadePrevista,
        pesoPrevisto: pedidosFornecedorItens.pesoPrevisto,
      })
      .from(pedidosFornecedorItens)
      .innerJoin(
        itensComerciais,
        eq(itensComerciais.id, pedidosFornecedorItens.itemComercialId),
      )
      .where(and(
        eq(pedidosFornecedorItens.pedidoFornecedorId, pedidoFornecedorId),
        isNull(pedidosFornecedorItens.deletedAt),
      ));
    if (itensSnapshot.length === 0) {
      throw new ConflictException('Pedido ao fornecedor sem itens operacionais previstos');
    }

    const metadados = await resolverMetadadosItensPrevistos(
      tx,
      cabecalho.pedido.compraProgramadaId,
      cabecalho.numeroInternoCompra,
      itensSnapshot.map((item) => item.itemComercialId),
    );
    const itens = itensSnapshot.map((item) => {
      const metadado = metadados.get(item.itemComercialId);
      if (!metadado) {
        throw new ConflictException(
          'Pedido ao fornecedor com metadados operacionais incompletos',
        );
      }
      return {
        ...item,
        unidade: metadado.unidadeEsperada,
        passaBalanca: metadado.requerBalanca,
        origemDescricao: metadado.origemDescricao,
      };
    });

    const itensCompraLinhas = await tx
      .select({
        descricao: itensCompra.descricao,
        quantidade: comprasProgramadasItens.quantidadeComprada,
      })
      .from(comprasProgramadasItens)
      .innerJoin(itensCompra, eq(itensCompra.id, comprasProgramadasItens.itemCompraId))
      .where(and(
        eq(comprasProgramadasItens.compraProgramadaId, cabecalho.pedido.compraProgramadaId),
        isNull(comprasProgramadasItens.deletedAt),
      ));

    return {
      ...cabecalho,
      tipoCarga: await derivarTipoCarga(tx, cabecalho.pedido.compraProgramadaId),
      resumoCompra: itensCompraLinhas
        .map((item) => `${item.quantidade} ${item.descricao}`)
        .join(' + '),
      itens,
    };
  }

  private async carregarContextoInicioPosCommit(
    recebimentoId: string,
  ): Promise<ContextoInicioPosCommit> {
    const linha = await this.db
      .select({
        recebimento: recebimentos,
        compraProgramadaId: pedidosFornecedor.compraProgramadaId,
        dataOperacao: operacoes.data,
      })
      .from(recebimentos)
      .innerJoin(
        pedidosFornecedor,
        eq(pedidosFornecedor.id, recebimentos.pedidoFornecedorId),
      )
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(and(
        eq(recebimentos.id, recebimentoId),
        isNull(recebimentos.deletedAt),
      ))
      .limit(1)
      .then((rows) => rows[0]);
    if (!linha) {
      throw new InternalServerErrorException(
        'Contexto canônico do recebimento não encontrado após o commit',
      );
    }
    return linha;
  }

  private async contextoOperacional(
    tx: Tx,
    recebimento: Pick<Recebimento, 'pedidoFornecedorId' | 'operacaoId'>,
  ): Promise<{ compraProgramadaId: string; dataOperacao: string; operacaoId: string }> {
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
    return { ...linha, operacaoId: recebimento.operacaoId };
  }

  private async buscarAtivo(tx: Tx, id: string): Promise<Recebimento | null> {
    return tx
      .select()
      .from(recebimentos)
      .where(and(eq(recebimentos.id, id), isNull(recebimentos.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
