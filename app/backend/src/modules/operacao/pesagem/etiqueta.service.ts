import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  clientes,
  etiquetasImpressoes,
  fornecedores,
  produtos,
  operacoes,
  pecas,
  pedidosVenda,
  recebimentos,
  representantes,
  subitens,
  usuarios,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { montarPaginado, primeiroOuFalha, type Paginado } from '../../../common/crud/paginacao';
import {
  IMPRESSORA_GATEWAY,
  LEITOR_GATEWAY,
  type ImpressoraGateway,
  type LeitorGateway,
  type ResultadoImpressao,
} from '../../../hardware/hardware.types';
import { EVENTOS } from '../../../realtime/events/eventos';
import { buscarNfAtivaDoRecebimento } from '../recebimento/nota-fiscal-fornecedor.persistence';
import { etiquetaBloqueadaSql, pecaEmCargaFechada } from './carga-fechada';
import type {
  CancelarEtiquetaDto,
  EstadoEtiqueta,
  ListarEtiquetasDto,
  ResolverQrDto,
} from './dto/etiqueta.dto';

type Tx = NodePgDatabase<typeof schema>;
type Peca = typeof pecas.$inferSelect;
type Etiqueta = typeof etiquetasImpressoes.$inferSelect;
type Subitem = typeof subitens.$inferSelect;

export interface ResultadoEtiqueta {
  peca: Peca;
  etiqueta: Etiqueta;
}

export interface ParametrosEmissaoNaTx {
  pecaId: string;
  codigo: string;
  payload: Record<string, unknown>;
  impressao: ResultadoImpressao;
  reimpressao: boolean;
  operadorId: string;
}

export interface EtiquetaListada {
  id: string;
  pecaId: string;
  codigo: string | null;
  estado: EstadoEtiqueta;
  statusImpressao: string;
  reimpressao: boolean;
  motivoCancelamento: string | null;
  invalidadaEm: string | null;
  bloqueada: boolean;
  pesoOriginal: string;
  statusPeca: string;
  recebimentoId: string;
  pedidoVendaId: string | null;
  operadorId: string;
  operadorNome: string;
  createdAt: string;
  produtoCodigo: string;
  produtoDescricao: string;
  caracteristicas: string[];
  nfNumero: string | null;
  frigorifico: string;
  romaneio: string | null;
  placaVeiculo: string | null;
  motorista: string | null;
  clienteNome: string | null;
  representanteNome: string | null;
  rotaPrevista: string | null;
  localEstoquePrevisto: { valor: string | null; provisorio: true } | null;
  historico: Array<{
    id: string;
    estado: string;
    statusImpressao: string;
    reimpressao: boolean;
    motivoCancelamento: string | null;
    operadorId: string;
    createdAt: string;
  }>;
}

/** Linha bruta da consulta — mesmo shape de `EtiquetaListada`, sem o array de histórico. */
type LinhaEtiqueta = Omit<EtiquetaListada, 'historico'>;

/**
 * Agrupa linhas (peça × etiqueta) por peça. `linhas` já vem ordenada por `createdAt DESC` pela
 * consulta de `listar()`, então a primeira ocorrência de cada `pecaId` é a etiqueta vigente
 * (D6.2) e as demais compõem o histórico completo.
 */
export function agruparPorPeca(linhas: LinhaEtiqueta[]): EtiquetaListada[] {
  const porPeca = new Map<string, EtiquetaListada>();
  for (const linha of linhas) {
    const vigente = porPeca.get(linha.pecaId);
    if (!vigente) {
      porPeca.set(linha.pecaId, { ...linha, historico: [] });
      continue;
    }
    vigente.historico.push({
      id: linha.id,
      estado: linha.estado,
      statusImpressao: linha.statusImpressao,
      reimpressao: linha.reimpressao,
      motivoCancelamento: linha.motivoCancelamento,
      operadorId: linha.operadorId,
      createdAt: linha.createdAt,
    });
  }
  return [...porPeca.values()];
}

/**
 * Pagina um array já pronto em memória. `recebimentoId` é obrigatório em `listarEtiquetasSchema`.
 */
export function paginarEmMemoria<T>(itens: T[], page: number, pageSize: number): Paginado<T> {
  const inicio = (page - 1) * pageSize;
  return montarPaginado(itens.slice(inicio, inicio + pageSize), itens.length, { page, pageSize });
}

@Injectable()
export class EtiquetaService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(IMPRESSORA_GATEWAY) private readonly impressora: ImpressoraGateway,
    @Inject(LEITOR_GATEWAY) private readonly leitor: LeitorGateway,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /** Impressão física isolada — best-effort, nunca lança (ADR-010). Usada também pela troca. */
  async imprimirPayload(payload: Record<string, unknown>): Promise<ResultadoImpressao> {
    return this.impressora.imprimir(payload);
  }

  /**
   * Persiste a etiqueta LÓGICA dentro de uma transação existente. Estado inicial conforme
   * v1.1 §10.4: 'ativa' quando o gateway confirmou a impressão, 'emitida' caso contrário;
   * reimpressão confirmada nasce 'reimpressa'.
   */
  async emitirNaTx(tx: Tx, p: ParametrosEmissaoNaTx): Promise<Etiqueta> {
    const estado = p.impressao.impresso ? (p.reimpressao ? 'reimpressa' : 'ativa') : 'emitida';

    await tx.update(pecas).set({ etiquetaAtual: p.codigo }).where(eq(pecas.id, p.pecaId));

    const etiqueta = primeiroOuFalha(
      await tx
        .insert(etiquetasImpressoes)
        .values({
          pecaId: p.pecaId,
          payload: {
            ...p.payload,
            jobId: p.impressao.jobId,
            erro: p.impressao.erro ?? null,
            gateway_status: p.impressao.saude,
          },
          statusImpressao: p.impressao.impresso ? 'impressa' : 'falha_impressao',
          reimpressao: p.reimpressao,
          estado,
          operadorId: p.operadorId,
        })
        .returning(),
    );

    await this.auditoria.registrar(tx, {
      tabela: 'etiquetas_impressoes',
      registroId: etiqueta.id,
      operacao: 'INSERT',
      modulo: 'operacao',
      usuarioId: p.operadorId,
      dadosAnteriores: {},
      dadosNovos: etiqueta,
    });

    return etiqueta;
  }

  /** Etiqueta vigente da peça: última linha ainda não terminal. */
  private async buscarVigenteNaTx(tx: Tx, pecaId: string): Promise<Etiqueta | null> {
    return tx
      .select()
      .from(etiquetasImpressoes)
      .where(
        and(
          eq(etiquetasImpressoes.pecaId, pecaId),
          notInArray(etiquetasImpressoes.estado, ['cancelada', 'invalidada_por_troca']),
        ),
      )
      .orderBy(desc(etiquetasImpressoes.createdAt))
      .limit(1)
      .for('update')
      .then((r) => r[0] ?? null);
  }

  /** Passo 7 de §6.13: a etiqueta da peça retirada deixa de valer por causa da troca. */
  async invalidarPorTrocaNaTx(tx: Tx, pecaId: string, operadorId: string): Promise<Etiqueta | null> {
    const vigente = await this.buscarVigenteNaTx(tx, pecaId);
    if (!vigente) return null;
    return this.encerrarNaTx(tx, vigente, 'invalidada_por_troca', 'troca_peca', operadorId);
  }

  /** Cancelamento vindo do estorno de destinação (D6.3). */
  async cancelarVigenteNaTx(tx: Tx, pecaId: string, motivo: string, operadorId: string): Promise<Etiqueta | null> {
    const vigente = await this.buscarVigenteNaTx(tx, pecaId);
    if (!vigente) return null;
    return this.encerrarNaTx(tx, vigente, 'cancelada', motivo, operadorId);
  }

  private async encerrarNaTx(
    tx: Tx,
    vigente: Etiqueta,
    estado: 'cancelada' | 'invalidada_por_troca',
    motivo: string,
    operadorId: string,
  ): Promise<Etiqueta> {
    const encerrada = primeiroOuFalha(
      await tx
        .update(etiquetasImpressoes)
        .set({
          estado,
          motivoCancelamento: motivo,
          invalidadaEm: new Date(),
          invalidadaPorId: operadorId,
        })
        .where(eq(etiquetasImpressoes.id, vigente.id))
        .returning(),
    );

    await this.auditoria.registrar(tx, {
      tabela: 'etiquetas_impressoes',
      registroId: vigente.id,
      operacao: 'UPDATE',
      modulo: 'operacao',
      usuarioId: operadorId,
      dadosAnteriores: vigente,
      dadosNovos: encerrada,
    });

    return encerrada;
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
    const impressao = await this.imprimirPayload(payloadBase);

    return this.db.transaction(async (tx) => {
      const etiqueta = await this.emitirNaTx(tx, {
        pecaId,
        codigo: codigoEtiqueta,
        payload: payloadBase,
        impressao,
        reimpressao: false,
        operadorId,
      });
      const atualizada = primeiroOuFalha(
        await tx.select().from(pecas).where(eq(pecas.id, pecaId)),
      );
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
    const impressao = await this.imprimirPayload(payloadBase);

    return this.db.transaction(async (tx) => {
      const etiqueta = await this.emitirNaTx(tx, {
        pecaId,
        codigo: peca.etiquetaAtual!,
        payload: payloadBase,
        impressao,
        reimpressao: true,
        operadorId,
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
    const vigente = await this.db
      .select({ estado: etiquetasImpressoes.estado })
      .from(etiquetasImpressoes)
      .where(eq(etiquetasImpressoes.pecaId, peca.id))
      .orderBy(desc(etiquetasImpressoes.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (vigente && (vigente.estado === 'invalidada_por_troca' || vigente.estado === 'cancelada')) {
      throw new ConflictException(
        vigente.estado === 'invalidada_por_troca'
          ? 'Etiqueta invalidada por troca de peça — use a etiqueta vigente'
          : 'Etiqueta cancelada — não deve ser usada na operação',
      );
    }
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

  /** POST /operacao/etiquetas/:id/cancelar. Bloqueado depois que a carga fecha (D6.18). */
  async cancelar(etiquetaId: string, dto: CancelarEtiquetaDto, operadorId: string): Promise<Etiqueta> {
    const resultado = await this.db.transaction(async (tx) => {
      const alvo = await tx
        .select()
        .from(etiquetasImpressoes)
        .where(eq(etiquetasImpressoes.id, etiquetaId))
        .for('update')
        .then((r) => r[0] ?? null);
      if (!alvo) throw new NotFoundException('Etiqueta não encontrada');
      if (alvo.estado === 'cancelada' || alvo.estado === 'invalidada_por_troca') {
        throw new ConflictException('Etiqueta já está em estado terminal');
      }
      if (alvo.pecaId && (await pecaEmCargaFechada(tx, alvo.pecaId))) {
        throw new ConflictException('Peça já está em carga fechada — cancelamento bloqueado');
      }
      const encerrada = await this.encerrarNaTx(tx, alvo, 'cancelada', dto.motivo, operadorId);
      return { encerrada, dataOperacao: await this.dataOperacaoDaEtiqueta(tx, alvo) };
    });

    this.eventEmitter.emit(EVENTOS.ETIQUETA_INVALIDADA, {
      etiquetaId,
      pecaId: resultado.encerrada.pecaId!,
      dataOperacao: resultado.dataOperacao,
      estado: 'cancelada',
      motivo: dto.motivo,
    });

    return resultado.encerrada;
  }

  /**
   * `estado` NÃO entra no `WHERE` desta consulta: filtrar aqui truncaria o histórico e faria uma
   * linha antiga `ativa` aparecer como vigente de uma peça cuja etiqueta atual já é terminal.
   */
  async listar(filtros: ListarEtiquetasDto): Promise<Paginado<EtiquetaListada>> {
    const condicoes = [
      isNull(pecas.deletedAt),
      isNotNull(etiquetasImpressoes.pecaId),
      eq(pecas.recebimentoId, filtros.recebimentoId),
    ];
    if (filtros.busca) {
      const q = `%${filtros.busca.toLowerCase()}%`;
      condicoes.push(sql`(lower(coalesce(${pecas.etiquetaAtual}, '')) LIKE ${q}
                          OR lower(${pecas.id}::text) LIKE ${q})`);
    }

    const nfAtiva = await buscarNfAtivaDoRecebimento(this.db, filtros.recebimentoId);

    const linhasBrutas = await this.db
      .select({
        id: etiquetasImpressoes.id,
        pecaId: pecas.id,
        codigo: sql<string | null>`${etiquetasImpressoes.payload}->>'qr'`,
        estado: etiquetasImpressoes.estado,
        statusImpressao: etiquetasImpressoes.statusImpressao,
        reimpressao: etiquetasImpressoes.reimpressao,
        motivoCancelamento: etiquetasImpressoes.motivoCancelamento,
        invalidadaEm: etiquetasImpressoes.invalidadaEm,
        bloqueada: etiquetaBloqueadaSql,
        pesoOriginal: pecas.pesoOriginal,
        statusPeca: pecas.statusPeca,
        recebimentoId: pecas.recebimentoId,
        pedidoVendaId: pecas.pedidoVendaId,
        operadorId: etiquetasImpressoes.operadorId,
        operadorNome: sql<string>`coalesce(${usuarios.nome}, '—')`,
        createdAt: etiquetasImpressoes.createdAt,
        produtoCodigo: produtos.codigo,
        produtoDescricao: produtos.nome,
        caracteristicas: sql<string[]>`array_remove(ARRAY[
          CASE WHEN (${pecas.capturaMeta}->>'maisPesada')::boolean THEN 'Mais pesada' END,
          CASE WHEN (${pecas.capturaMeta}->>'maisGorda')::boolean THEN 'Mais gorda' END,
          CASE WHEN (${pecas.capturaMeta}->>'melhorAcabamento')::boolean THEN 'Melhor acabamento' END
        ], NULL)`,
        notaFiscalFornecedor: recebimentos.notaFiscalFornecedor,
        frigorifico: fornecedores.razaoSocial,
        romaneio: recebimentos.romaneio,
        placaVeiculo: recebimentos.placaVeiculo,
        motorista: recebimentos.motorista,
        clienteNome: sql<string | null>`coalesce(${clientes.nomeFantasia}, ${clientes.razaoSocial})`,
        representanteNome: representantes.nome,
        rotaPrevista: pedidosVenda.rotaPrevista,
        localEstoquePrevisto: sql<{ valor: string | null; provisorio: true } | null>`
          CASE WHEN ${pecas.statusPeca} = 'em_sobra'
               THEN jsonb_build_object('valor', NULL, 'provisorio', true)
               ELSE NULL END`,
      })
      .from(etiquetasImpressoes)
      .innerJoin(pecas, eq(pecas.id, etiquetasImpressoes.pecaId))
      .leftJoin(usuarios, eq(usuarios.id, etiquetasImpressoes.operadorId))
      .innerJoin(produtos, eq(produtos.id, pecas.produtoBaseId))
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .innerJoin(fornecedores, eq(fornecedores.id, recebimentos.fornecedorId))
      .leftJoin(pedidosVenda, eq(pedidosVenda.id, pecas.pedidoVendaId))
      .leftJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .leftJoin(representantes, eq(representantes.id, clientes.representanteId))
      .where(and(...condicoes))
      .orderBy(desc(etiquetasImpressoes.createdAt));

    const iso = (v: Date | string | null): string | null => {
      if (v == null) return null;
      return v instanceof Date ? v.toISOString() : String(v);
    };

    const linhas: LinhaEtiqueta[] = linhasBrutas.map(({ notaFiscalFornecedor, ...linha }) => ({
      ...linha,
      estado: linha.estado as EstadoEtiqueta,
      bloqueada: Boolean(linha.bloqueada),
      invalidadaEm: iso(linha.invalidadaEm as Date | string | null),
      createdAt: iso(linha.createdAt as Date | string)!,
      caracteristicas: (linha.caracteristicas ?? []) as string[],
      localEstoquePrevisto: linha.localEstoquePrevisto as EtiquetaListada['localEstoquePrevisto'],
      nfNumero: nfAtiva?.numero ?? notaFiscalFornecedor,
    }));

    const agrupadas = agruparPorPeca(linhas);
    const filtradas = filtros.estado
      ? agrupadas.filter((e) => e.estado === filtros.estado)
      : agrupadas;
    return paginarEmMemoria(filtradas, filtros.page, filtros.pageSize);
  }

  private async dataOperacaoDaEtiqueta(tx: Tx, etiqueta: Etiqueta): Promise<string> {
    if (!etiqueta.pecaId) return '';
    const r = await tx
      .select({ dataOperacao: operacoes.data })
      .from(pecas)
      .innerJoin(recebimentos, eq(recebimentos.id, pecas.recebimentoId))
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(eq(pecas.id, etiqueta.pecaId))
      .then((rows) => rows[0] ?? null);
    return r?.dataOperacao ?? '';
  }

  private montarPayload(peca: Peca, codigo: string): Record<string, unknown> {
    return {
      pecaId: peca.id,
      produtoBaseId: peca.produtoBaseId,
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
      produtoId: subitem.produtoId,
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
