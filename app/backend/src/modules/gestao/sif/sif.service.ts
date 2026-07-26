import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  operacoes,
  relatoriosSif,
  relatoriosSifVersoes,
  usuarios,
} from '../../../database/schema';
import { EVENTOS } from '../../../realtime/events/eventos';
import { CATALOGO_SIF, derivarStatus, type TipoRelatorioSif } from './catalogo-sif';
import { SifCalculoService } from './sif-calculo.service';

@Injectable()
export class SifService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly calculo: SifCalculoService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(operacaoId: string) {
    await this.db.transaction(async (tx) => {
      for (const def of CATALOGO_SIF) {
        const existe = await tx.select({ id: relatoriosSif.id }).from(relatoriosSif)
          .where(and(
            eq(relatoriosSif.operacaoId, operacaoId),
            eq(relatoriosSif.tipo, def.tipo),
            isNull(relatoriosSif.deletedAt),
          ))
          .then((r) => r[0]);
        if (!existe) {
          await tx.insert(relatoriosSif).values({
            operacaoId, tipo: def.tipo, codigo: def.codigo,
            nome: def.nome, perfilResponsavel: def.perfilResponsavel,
          });
        }
      }
    });

    const linhas = await this.db.select().from(relatoriosSif)
      .where(and(eq(relatoriosSif.operacaoId, operacaoId), isNull(relatoriosSif.deletedAt)))
      .orderBy(asc(relatoriosSif.codigo));

    const resultado = [];
    for (const relatorio of linhas) {
      const pendencias = await this.calculo.pendencias(operacaoId, relatorio.tipo as TipoRelatorioSif);
      const ultima = await this.ultimaVersao(relatorio.id);
      const status = derivarStatus(
        pendencias,
        relatorio.versaoAtual,
        (ultima?.tipoGeracao as 'gerado' | 'retificado' | null) ?? null,
      );
      if (status !== relatorio.status
          || JSON.stringify(pendencias) !== JSON.stringify(relatorio.pendenciasJson)) {
        await this.db.update(relatoriosSif)
          .set({ status, pendenciasJson: pendencias, updatedAt: new Date() })
          .where(eq(relatoriosSif.id, relatorio.id));
      }
      resultado.push({ ...relatorio, status, pendenciasJson: pendencias, ultimaVersao: ultima });
    }
    return resultado;
  }

  async gerar(id: string, usuarioId: string) {
    return this.novaVersao(id, usuarioId, 'gerado', null);
  }

  async retificar(id: string, usuarioId: string, motivo: string) {
    return this.novaVersao(id, usuarioId, 'retificado', motivo);
  }

  private async novaVersao(
    id: string, usuarioId: string,
    tipoGeracao: 'gerado' | 'retificado', motivo: string | null,
  ) {
    const resultado = await this.db.transaction(async (tx) => {
      const relatorio = await tx.select().from(relatoriosSif)
        .where(and(eq(relatoriosSif.id, id), isNull(relatoriosSif.deletedAt)))
        .for('update').then((r) => r[0]);
      if (!relatorio) throw new NotFoundException('Relatório SIF não encontrado');

      const pendencias = await this.calculo.pendencias(
        relatorio.operacaoId, relatorio.tipo as TipoRelatorioSif,
      );
      if (pendencias.length > 0) {
        throw new ConflictException({
          codigo: 'RELATORIO_COM_PENDENCIAS',
          mensagem: 'Resolva as pendências de dados antes de gerar',
          pendencias,
        });
      }
      if (tipoGeracao === 'retificado' && relatorio.versaoAtual < 1) {
        throw new ConflictException({
          codigo: 'SEM_VERSAO_PARA_RETIFICAR',
          mensagem: 'Não há versão gerada para retificar',
        });
      }

      const conteudo = await this.calculo.conteudo(
        relatorio.operacaoId, relatorio.tipo as TipoRelatorioSif,
      );
      const versao = relatorio.versaoAtual + 1;
      const [linha] = await tx.insert(relatoriosSifVersoes).values({
        relatorioId: relatorio.id, versao, tipoGeracao,
        motivoRetificacao: motivo, conteudoJson: conteudo, geradoPorId: usuarioId,
      }).returning();
      if (!linha) throw new Error('Falha ao gravar versão do relatório SIF');

      const [atualizado] = await tx.update(relatoriosSif).set({
        versaoAtual: versao, status: tipoGeracao, pendenciasJson: [], updatedAt: new Date(),
      }).where(eq(relatoriosSif.id, relatorio.id)).returning();
      if (!atualizado) throw new Error('Falha ao atualizar relatório SIF');

      await this.auditoria.registrar(tx, {
        tabela: 'relatorios_sif', registroId: relatorio.id, operacao: 'UPDATE',
        modulo: 'gestao', usuarioId, dadosAnteriores: relatorio, dadosNovos: atualizado,
      });

      const operacao = await tx.select({ data: operacoes.data }).from(operacoes)
        .where(eq(operacoes.id, relatorio.operacaoId)).then((r) => r[0]);
      if (!operacao) throw new NotFoundException('Operação do relatório não encontrada');

      return { relatorio: atualizado, versao: linha, dataOperacao: operacao.data };
    });

    this.eventEmitter.emit(EVENTOS.RELATORIO_SIF_GERADO, {
      relatorioId: resultado.relatorio.id,
      operacaoId: resultado.relatorio.operacaoId,
      dataOperacao: resultado.dataOperacao,
      versao: resultado.versao.versao,
      tipoGeracao,
    });
    return resultado;
  }

  async versoes(id: string) {
    return this.db.select({
      id: relatoriosSifVersoes.id,
      versao: relatoriosSifVersoes.versao,
      tipoGeracao: relatoriosSifVersoes.tipoGeracao,
      motivoRetificacao: relatoriosSifVersoes.motivoRetificacao,
      geradoEm: relatoriosSifVersoes.geradoEm,
      geradoPorNome: usuarios.nome,
    })
      .from(relatoriosSifVersoes)
      .leftJoin(usuarios, eq(usuarios.id, relatoriosSifVersoes.geradoPorId))
      .where(eq(relatoriosSifVersoes.relatorioId, id))
      .orderBy(asc(relatoriosSifVersoes.versao));
  }

  async preview(id: string) {
    const ultima = await this.ultimaVersao(id);
    if (!ultima) {
      throw new NotFoundException({
        codigo: 'SEM_VERSAO_GERADA',
        mensagem: 'Nenhuma versão gerada ainda para este relatório.',
      });
    }
    return ultima;
  }

  private async ultimaVersao(relatorioId: string) {
    return this.db.select().from(relatoriosSifVersoes)
      .where(eq(relatoriosSifVersoes.relatorioId, relatorioId))
      .orderBy(desc(relatoriosSifVersoes.versao)).limit(1).then((r) => r[0] ?? null);
  }
}
