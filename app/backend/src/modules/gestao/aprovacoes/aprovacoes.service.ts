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
import { montarPaginado } from '../../../common/crud/paginacao';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  aprovacoesOperacionais,
  fornecedores,
  ocorrenciasFornecedor,
  operacoes,
  usuarios,
} from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import type { Tx } from '../../operacoes/operacoes.service';
import type {
  AbrirAprovacaoDto,
  DecidirAprovacaoDto,
  ListarAprovacoesDto,
} from './dto/aprovacoes.dto';

@Injectable()
export class AprovacoesService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarAprovacoesDto) {
    return query.aba === 'ocorrencias'
      ? this.listarOcorrencias(query)
      : this.listarOperacionais(query);
  }

  private async listarOperacionais(query: ListarAprovacoesDto) {
    const filtros = [
      eq(aprovacoesOperacionais.operacaoId, query.operacaoId),
      isNull(aprovacoesOperacionais.deletedAt),
    ];
    if (query.status) filtros.push(eq(aprovacoesOperacionais.status, query.status));
    if (query.busca) {
      filtros.push(sql`(${aprovacoesOperacionais.descricao} ILIKE ${'%' + query.busca + '%'}
                     OR ${aprovacoesOperacionais.origem} ILIKE ${'%' + query.busca + '%'})`);
    }
    const where = and(...filtros);
    const [linhas, totalRow] = await Promise.all([
      this.db.select({
        id: aprovacoesOperacionais.id,
        tipo: aprovacoesOperacionais.tipo,
        origem: aprovacoesOperacionais.origem,
        descricao: aprovacoesOperacionais.descricao,
        impacto: aprovacoesOperacionais.impacto,
        status: aprovacoesOperacionais.status,
        solicitadoEm: aprovacoesOperacionais.solicitadoEm,
        solicitanteNome: usuarios.nome,
        decisaoMotivo: aprovacoesOperacionais.decisaoMotivo,
        decididoEm: aprovacoesOperacionais.decididoEm,
      })
        .from(aprovacoesOperacionais)
        .leftJoin(usuarios, eq(usuarios.id, aprovacoesOperacionais.solicitanteId))
        .where(where)
        .orderBy(desc(aprovacoesOperacionais.solicitadoEm))
        .limit(query.limite).offset((query.pagina - 1) * query.limite),
      this.db.select({ total: sql<number>`count(*)::int` })
        .from(aprovacoesOperacionais).where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0,
      { page: query.pagina, pageSize: query.limite });
  }

  async abrir(dto: AbrirAprovacaoDto, usuarioId: string) {
    const { aprovacao, dataOperacao } = await this.db.transaction(async (tx) => {
      const aprovacao = await this.abrirNaTx(tx, dto, usuarioId);
      return { aprovacao, dataOperacao: await this.dataDaOperacao(tx, aprovacao.operacaoId) };
    });
    this.eventEmitter.emit(EVENTOS.APROVACAO_REGISTRADA, {
      aprovacaoId: aprovacao.id, operacaoId: aprovacao.operacaoId, dataOperacao,
      tipo: aprovacao.tipo, status: aprovacao.status,
    });
    return aprovacao;
  }

  private async dataDaOperacao(tx: Tx, operacaoId: string): Promise<string> {
    const linha = await tx.select({ data: operacoes.data }).from(operacoes)
      .where(eq(operacoes.id, operacaoId)).then((r) => r[0]);
    if (!linha) throw new NotFoundException('Operação da solicitação não encontrada');
    return linha.data;
  }

  async abrirNaTx(tx: Tx, dto: AbrirAprovacaoDto, usuarioId: string) {
    const [aprovacao] = await tx.insert(aprovacoesOperacionais).values({
      operacaoId: dto.operacaoId, tipo: dto.tipo, origem: dto.origem,
      descricao: dto.descricao, impacto: dto.impacto,
      referenciaTabela: dto.referenciaTabela ?? null,
      referenciaId: dto.referenciaId ?? null,
      solicitanteId: usuarioId,
    }).returning();
    if (!aprovacao) throw new Error('Falha ao registrar solicitação de aprovação');
    await this.auditoria.registrar(tx, {
      tabela: 'aprovacoes_operacionais', registroId: aprovacao.id, operacao: 'INSERT',
      modulo: 'gestao', usuarioId, dadosAnteriores: {}, dadosNovos: aprovacao,
    });
    return aprovacao;
  }

  async decidir(id: string, dto: DecidirAprovacaoDto, usuarioId: string) {
    const { aprovacao, dataOperacao } = await this.db.transaction(async (tx) => {
      const atual = await tx.select().from(aprovacoesOperacionais)
        .where(and(eq(aprovacoesOperacionais.id, id), isNull(aprovacoesOperacionais.deletedAt)))
        .for('update').then((r) => r[0]);
      if (!atual) throw new NotFoundException('Solicitação de aprovação não encontrada');
      if (atual.status !== 'pendente') {
        throw new ConflictException({
          codigo: 'APROVACAO_JA_DECIDIDA',
          mensagem: `Solicitação já ${atual.status}`,
        });
      }
      const [decidida] = await tx.update(aprovacoesOperacionais).set({
        status: dto.decisao, decisaoMotivo: dto.motivo,
        decididoPorId: usuarioId, decididoEm: new Date(), updatedAt: new Date(),
      }).where(eq(aprovacoesOperacionais.id, id)).returning();
      if (!decidida) throw new Error('Falha ao registrar decisão');
      await this.auditoria.registrar(tx, {
        tabela: 'aprovacoes_operacionais', registroId: id, operacao: 'UPDATE',
        modulo: 'gestao', usuarioId, dadosAnteriores: atual, dadosNovos: decidida,
      });
      return {
        aprovacao: decidida,
        dataOperacao: await this.dataDaOperacao(tx, decidida.operacaoId),
      };
    });
    this.eventEmitter.emit(EVENTOS.APROVACAO_DECIDIDA, {
      aprovacaoId: aprovacao.id, operacaoId: aprovacao.operacaoId, dataOperacao,
      tipo: aprovacao.tipo, status: aprovacao.status,
    });
    return aprovacao;
  }

  private async listarOcorrencias(query: ListarAprovacoesDto) {
    const daOperacao = sql`(
      EXISTS (
        SELECT 1 FROM compras_programadas cp
         WHERE cp.id = ${ocorrenciasFornecedor.compraProgramadaId}
           AND cp.operacao_id = ${query.operacaoId}
           AND cp.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM divergencias_recebimento d
          JOIN recebimentos r ON r.id = d.recebimento_id
         WHERE d.id = ${ocorrenciasFornecedor.divergenciaId}
           AND r.operacao_id = ${query.operacaoId}
           AND r.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM notas_fiscais_fornecedor nf
          JOIN recebimentos r ON r.id = nf.recebimento_id
         WHERE nf.id = ${ocorrenciasFornecedor.nfFornecedorId}
           AND r.operacao_id = ${query.operacaoId}
           AND r.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM conclusoes_conferencia cc
          JOIN recebimentos r ON r.id = cc.recebimento_id
         WHERE cc.id = ${ocorrenciasFornecedor.conclusaoConferenciaId}
           AND r.operacao_id = ${query.operacaoId}
           AND r.deleted_at IS NULL
      )
    )`;
    const filtros = [daOperacao];
    if (query.status) filtros.push(eq(ocorrenciasFornecedor.status, query.status));
    if (query.busca) {
      filtros.push(sql`(
        ${fornecedores.razaoSocial} ILIKE ${'%' + query.busca + '%'}
        OR ${ocorrenciasFornecedor.descricao} ILIKE ${'%' + query.busca + '%'}
      )`);
    }
    const where = and(...filtros);
    const [linhas, totalRow] = await Promise.all([
      this.db.select({
        id: ocorrenciasFornecedor.id,
        fornecedorNome: fornecedores.razaoSocial,
        nfChave: sql<string | null>`(
          SELECT nf.chave FROM notas_fiscais_fornecedor nf
           WHERE nf.id = ${ocorrenciasFornecedor.nfFornecedorId}
           LIMIT 1
        )`,
        pedidoLote: sql<string | null>`(
          SELECT coalesce(r.romaneio, r.nota_fiscal_fornecedor)
            FROM divergencias_recebimento d
            JOIN recebimentos r ON r.id = d.recebimento_id
           WHERE d.id = ${ocorrenciasFornecedor.divergenciaId}
           LIMIT 1
        )`,
        produtosDivergentes: sql<number>`(
          SELECT count(*)::int FROM divergencias_recebimento d
           WHERE d.id = ${ocorrenciasFornecedor.divergenciaId}
              OR d.conclusao_conferencia_id = ${ocorrenciasFornecedor.conclusaoConferenciaId}
        )`,
        difQtdTotal: sql<string | null>`(
          SELECT coalesce(sum((item->>'qtdApurada')::numeric - (item->>'qtdNf')::numeric), 0)::text
            FROM conclusoes_conferencia cc,
                 jsonb_array_elements(cc.quadro_json) AS item
           WHERE cc.id = ${ocorrenciasFornecedor.conclusaoConferenciaId}
        )`,
        difPesoTotal: sql<string | null>`(
          SELECT coalesce(sum(
            CASE
              WHEN (item->>'pesoApurado') IS NULL OR (item->>'pesoNf') IS NULL THEN 0
              ELSE (item->>'pesoApurado')::numeric - (item->>'pesoNf')::numeric
            END
          ), 0)::text
            FROM conclusoes_conferencia cc,
                 jsonb_array_elements(cc.quadro_json) AS item
           WHERE cc.id = ${ocorrenciasFornecedor.conclusaoConferenciaId}
        )`,
        responsavelNome: usuarios.nome,
        status: ocorrenciasFornecedor.status,
        dataAbertura: ocorrenciasFornecedor.dataHoraAbertura,
      })
        .from(ocorrenciasFornecedor)
        .innerJoin(fornecedores, eq(fornecedores.id, ocorrenciasFornecedor.fornecedorId))
        .leftJoin(usuarios, eq(usuarios.id, ocorrenciasFornecedor.usuarioAberturaId))
        .where(where)
        .orderBy(desc(ocorrenciasFornecedor.dataHoraAbertura))
        .limit(query.limite).offset((query.pagina - 1) * query.limite),
      this.db.select({ total: sql<number>`count(*)::int` })
        .from(ocorrenciasFornecedor)
        .innerJoin(fornecedores, eq(fornecedores.id, ocorrenciasFornecedor.fornecedorId))
        .where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0,
      { page: query.pagina, pageSize: query.limite });
  }
}
