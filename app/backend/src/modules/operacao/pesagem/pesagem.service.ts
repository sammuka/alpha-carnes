import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { pecas, recebimentos } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { formatarQtd } from '../../../common/crud/decimal';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { PERMISSOES } from '../../../common/rbac/permissoes';
import {
  BALANCA_GATEWAY,
  IMPRESSORA_GATEWAY,
  LEITOR_GATEWAY,
  type BalancaGateway,
  type ImpressoraGateway,
  type LeitorGateway,
  type SaudeDispositivo,
} from '../../../hardware/hardware.types';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import type { RegistrarPesagemDto } from './dto/pesagem.dto';

type Peca = typeof pecas.$inferSelect;

export interface StatusDispositivos {
  balanca: SaudeDispositivo;
  leitor: SaudeDispositivo;
  impressora: SaudeDispositivo;
}

@Injectable()
export class PesagemService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(BALANCA_GATEWAY) private readonly balanca: BalancaGateway,
    @Inject(LEITOR_GATEWAY) private readonly leitor: LeitorGateway,
    @Inject(IMPRESSORA_GATEWAY) private readonly impressora: ImpressoraGateway,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /** Saúde corrente dos dispositivos (RA-05: sempre visível, nunca silenciosa). */
  statusDispositivos(): StatusDispositivos {
    return {
      balanca: this.balanca.status(),
      leitor: this.leitor.status(),
      impressora: this.impressora.status(),
    };
  }

  async detalhar(id: string): Promise<Peca> {
    const peca = await this.db
      .select()
      .from(pecas)
      .where(and(eq(pecas.id, id), isNull(pecas.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!peca) throw new NotFoundException('Peça não encontrada');
    return peca;
  }

  /** Peças de um recebimento (rastreabilidade), mais recentes primeiro. */
  async listarPorRecebimento(recebimentoId: string): Promise<Peca[]> {
    return this.db
      .select()
      .from(pecas)
      .where(and(eq(pecas.recebimentoId, recebimentoId), isNull(pecas.deletedAt)))
      .orderBy(desc(pecas.createdAt));
  }

  /**
   * Registra a pesagem de uma peça aplicando o contrato de captura (ADR-009):
   * - automatico: lê o gateway; se status≠disponivel OU leitura instável, NÃO grava
   *   como automático — erro explícito orientando o manual (nunca inventa valor).
   * - manual_assistido: exige PESO_MANUAL (403) e motivo (400, no DTO); grava
   *   captura_meta com snapshot do gateway_status.
   * Transacional + auditoria; evento peca_pesada pós-commit.
   */
  async registrarPesagem(dto: RegistrarPesagemDto, user: CurrentUserPayload): Promise<Peca> {
    const recebimento = await this.db
      .select()
      .from(recebimentos)
      .where(and(eq(recebimentos.id, dto.recebimentoId), isNull(recebimentos.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!recebimento) throw new NotFoundException('Recebimento não encontrado');

    let peso: string;
    let capturaMeta: Record<string, unknown>;

    if (dto.modoCaptura === 'automatico') {
      const saude = this.balanca.status();
      if (saude.status !== 'disponivel') {
        // Indisponibilidade nunca silenciosa: emite status e falha explícito.
        this.emitirStatusDispositivo('balanca', saude, recebimento.dataOperacao);
        throw new ConflictException(
          'Balança indisponível ou instável: captura automática não disponível, use o modo manual assistido',
        );
      }
      const leitura = await this.balanca.lerEstavel();
      if (!leitura.estavel) {
        this.emitirStatusDispositivo('balanca', leitura.saude, recebimento.dataOperacao);
        throw new ConflictException('Leitura instável: confirme via modo manual assistido com motivo');
      }
      peso = formatarQtd(leitura.peso);
      capturaMeta = {
        leitura_estavel: true,
        gateway_status: leitura.saude,
        operador: user.sub,
      };
    } else {
      // manual_assistido: exige permissão dedicada (segregação de funções, ADR-009).
      if (!user.permissoes.includes(PERMISSOES.PESO_MANUAL)) {
        throw new ForbiddenException('Sem permissão PESO_MANUAL para captura manual assistida');
      }
      if (dto.pesoManual === undefined || !dto.motivo) {
        // Backstop ao DTO — nunca grava manual sem procedência.
        throw new BadRequestException('Captura manual exige pesoManual e motivo');
      }
      peso = formatarQtd(dto.pesoManual);
      capturaMeta = {
        leitura_estavel: false,
        motivo: dto.motivo,
        motivo_detalhe: dto.motivoDetalhe ?? null,
        gateway_status: this.balanca.status(),
        operador: user.sub,
      };
    }

    const criada = await this.db.transaction(async (tx) => {
      const peca = primeiroOuFalha(
        await tx
          .insert(pecas)
          .values({
            compraProgramadaId: recebimento.compraProgramadaId,
            recebimentoId: recebimento.id,
            itemComercialBaseId: dto.itemComercialBaseId,
            classificacaoOperacional: dto.classificacaoOperacional,
            pesoOriginal: peso,
            modoCapturaPeso: dto.modoCaptura,
            capturaMeta,
            statusPeca: 'pesada',
            observacoes: dto.observacoes,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'pecas',
        registroId: peca.id,
        operacao: 'INSERT',
        modulo: 'operacao',
        usuarioId: user.sub,
        dadosAnteriores: {},
        dadosNovos: peca,
      });

      return peca;
    });

    // PÓS-COMMIT (ADR-004): nenhum evento se a transação falhou.
    this.eventEmitter.emit(EVENTOS.PECA_PESADA, {
      pecaId: criada.id,
      recebimentoId: criada.recebimentoId,
      dataOperacao: recebimento.dataOperacao,
      modoCaptura: criada.modoCapturaPeso as 'automatico' | 'manual_assistido',
      pesoOriginal: criada.pesoOriginal,
    });

    return criada;
  }

  private emitirStatusDispositivo(
    dispositivo: 'balanca' | 'leitor' | 'impressora',
    saude: SaudeDispositivo,
    dataOperacao: string,
  ): void {
    this.eventEmitter.emit(EVENTOS.DISPOSITIVO_STATUS_ALTERADO, {
      dataOperacao,
      dispositivo,
      dispositivoId: saude.dispositivoId,
      status: saude.status,
      heartbeatEm: saude.heartbeatEm,
    });
  }
}
