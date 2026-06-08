import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  caminhoes,
  cargaItens,
  conferenciasCarga,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { PERMISSOES } from '../../../common/rbac/permissoes';
import { assertTransicao, type StatusCaminhao } from './transicoes';
import { CaminhaoService } from './caminhao.service';
import { EtiquetaService } from '../pesagem/etiqueta.service';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import type { RegistrarItemConferenciaDto } from './dto/expedicao.dto';

@Injectable()
export class ConferenciaService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly caminhaoService: CaminhaoService,
    private readonly etiqueta: EtiquetaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /** Inicia a conferência: em_carga → em_conferencia, cria registro. */
  async iniciar(caminhaoId: string, operadorId: string) {
    return this.db.transaction(async (tx) => {
      const caminhao = await this.caminhaoService.caminhaoAtivo(tx, caminhaoId);
      assertTransicao(caminhao.statusCaminhao as StatusCaminhao, 'em_conferencia');

      primeiroOuFalha(
        await tx
          .update(caminhoes)
          .set({ statusCaminhao: 'em_conferencia' })
          .where(eq(caminhoes.id, caminhaoId))
          .returning(),
      );

      const conferencia = primeiroOuFalha(
        await tx
          .insert(conferenciasCarga)
          .values({
            caminhaoId,
            operadorResponsavelId: operadorId,
            statusConferencia: 'aberta',
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'conferencias_carga',
        registroId: conferencia.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: {},
        dadosNovos: conferencia,
      });

      return conferencia;
    });
  }

  /**
   * Registra item conferido por QR (ADR-009).
   * tipoOrigem: 'peca' ou 'subitem'. modoCaptura: 'automatico' ou 'manual_assistido'.
   */
  async registrarItem(
    caminhaoId: string,
    dto: RegistrarItemConferenciaDto,
    user: CurrentUserPayload,
  ) {
    // Validar manualidade
    if (dto.modoCaptura === 'manual_assistido') {
      if (!user.permissoes.includes(PERMISSOES.LEITURA_MANUAL)) {
        throw new ForbiddenException('Sem permissão LEITURA_MANUAL para conferência manual');
      }
      if (!dto.codigo || !dto.motivo) {
        throw new BadRequestException('Conferência manual exige código e motivo');
      }
    }

    // Resolver QR (pode lançar NotFoundException se código inválido)
    let pecaId: string | null = null;
    let subitemId: string | null = null;

    if (dto.tipoOrigem === 'peca') {
      const peca = await this.etiqueta.resolverQr({
        modoCaptura: dto.modoCaptura,
        codigo: dto.codigo,
        motivo: dto.motivo,
      });
      pecaId = peca.id;
    } else {
      const sub = await this.etiqueta.resolverQrSubitem({
        modoCaptura: dto.modoCaptura,
        codigo: dto.codigo,
        motivo: dto.motivo,
      });
      subitemId = sub.id;
    }

    return this.db.transaction(async (tx) => {
      const caminhao = await this.caminhaoService.caminhaoAtivo(tx, caminhaoId);
      if (caminhao.statusCaminhao !== 'em_conferencia') {
        throw new ConflictException('Caminhão não está em conferência');
      }

      // Conferência ativa
      const conferencia = await tx
        .select()
        .from(conferenciasCarga)
        .where(
          and(
            eq(conferenciasCarga.caminhaoId, caminhaoId),
            eq(conferenciasCarga.statusConferencia, 'aberta'),
            isNull(conferenciasCarga.deletedAt),
          ),
        )
        .then((r) => r[0] ?? null);
      if (!conferencia) throw new ConflictException('Nenhuma conferência ativa para este caminhão');

      // Verificar se a peça/subitem está nesta carga
      const cond =
        pecaId !== null
          ? and(
              eq(cargaItens.caminhaoId, caminhaoId),
              eq(cargaItens.pecaId, pecaId),
              ne(cargaItens.statusCargaItem, 'removido'),
              isNull(cargaItens.deletedAt),
            )
          : and(
              eq(cargaItens.caminhaoId, caminhaoId),
              eq(cargaItens.subitemId, subitemId!),
              ne(cargaItens.statusCargaItem, 'removido'),
              isNull(cargaItens.deletedAt),
            );

      const itemCarga = await tx
        .select()
        .from(cargaItens)
        .where(cond)
        .then((r) => r[0] ?? null);

      if (!itemCarga) {
        // Excedente: código válido mas não vinculado a esta carga
        throw new ConflictException('Item não está vinculado a esta carga (excedente)');
      }

      if (itemCarga.statusCargaItem === 'conferido') {
        // Idempotente
        return itemCarga;
      }

      const atualizado = primeiroOuFalha(
        await tx
          .update(cargaItens)
          .set({ conferido: true, statusCargaItem: 'conferido' })
          .where(eq(cargaItens.id, itemCarga.id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'carga_itens',
        registroId: itemCarga.id,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: user.sub,
        dadosAnteriores: itemCarga,
        dadosNovos: atualizado,
      });

      return atualizado;
    });
  }

  /**
   * Conclui a conferência. Calcula faltas/excedentes e grava em pendencias.
   * pendencias.faltas = carga_itens ainda em_carga (não conferidos)
   */
  async concluir(caminhaoId: string, operadorId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const caminhao = await this.caminhaoService.caminhaoAtivo(tx, caminhaoId);
      if (caminhao.statusCaminhao !== 'em_conferencia') {
        throw new ConflictException('Caminhão não está em conferência');
      }

      const conferencia = await tx
        .select()
        .from(conferenciasCarga)
        .where(
          and(
            eq(conferenciasCarga.caminhaoId, caminhaoId),
            eq(conferenciasCarga.statusConferencia, 'aberta'),
            isNull(conferenciasCarga.deletedAt),
          ),
        )
        .then((r) => r[0] ?? null);
      if (!conferencia) throw new ConflictException('Nenhuma conferência ativa');

      // Calcular pendências
      const todosItens = await tx
        .select()
        .from(cargaItens)
        .where(and(eq(cargaItens.caminhaoId, caminhaoId), isNull(cargaItens.deletedAt)));

      const faltas = todosItens
        .filter((i) => i.statusCargaItem === 'em_carga')
        .map((i) => ({
          cargaItemId: i.id,
          tipoOrigem: i.tipoOrigem,
          pecaId: i.pecaId,
          subitemId: i.subitemId,
        }));

      const pendencias = { faltas, totalFaltas: faltas.length };

      const atualizada = primeiroOuFalha(
        await tx
          .update(conferenciasCarga)
          .set({
            statusConferencia: 'concluida',
            dataHoraFim: new Date(),
            pendencias,
          })
          .where(eq(conferenciasCarga.id, conferencia.id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'conferencias_carga',
        registroId: conferencia.id,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: conferencia,
        dadosNovos: atualizada,
      });

      return { conferencia: atualizada, dataOperacao: caminhao.dataOperacao };
    });

    this.eventEmitter.emit(EVENTOS.CONFERENCIA_CONCLUIDA, {
      caminhaoId,
      conferenciaId: resultado.conferencia.id,
      dataOperacao: resultado.dataOperacao,
    });

    return resultado.conferencia;
  }
}
