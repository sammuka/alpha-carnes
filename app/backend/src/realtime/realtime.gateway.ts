import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { OnEvent } from '@nestjs/event-emitter';
import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { TokenService } from '../modules/auth/token.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PERMISSOES } from '../common/rbac/permissoes';
import { RealtimeHub } from './realtime.hub';
import {
  EVENTOS,
  roomsDaData,
  type CompraConfirmadaPayload,
  type DisponibilidadeGeradaPayload,
  type PedidoSemCoberturaPayload,
  type ReservaAtualizadaPayload,
  type RecebimentoIniciadoPayload,
  type RecebimentoRegistradoPayload,
  type DivergenciaRecebimentoPayload,
  type OcorrenciaFornecedorPayload,
  type PedidoEmRiscoPayload,
  type PecaPesadaPayload,
  type PecaAssociadaPayload,
  type PecaRedirecionadaPayload,
  type DispositivoStatusPayload,
  type CorteIniciadoPayload,
  type SubitemGeradoPayload,
  type SubitemPesadoPayload,
  type SubitemAssociadoPayload,
  type CorteConcluidoPayload,
  type CargaItemAdicionadoPayload,
  type CargaItemTransferidoPayload,
  type CargaItemRemovidoPayload,
  type ConferenciaConcluidaPayload,
  type ExpedicaoFechadaPayload,
  type ExpedicaoReabertaPayload,
  type NfseEmitidaPayload,
  type NfseCanceladaPayload,
  type NfseErroEmissaoPayload,
  type CompraAlteradaImpactoPayload,
  type AprovacaoOperacionalPayload,
  type RelatorioSifGeradoPayload,
  type PendenciaOverbookingPayload,
  type FaltasDesossaAtualizadasPayload,
  type DivergenciaTransformacaoAbertaPayload,
  type EstoqueItemDestinadoPayload,
  type EntradaItensRegistradaPayload,
  type AjusteEstoqueCriadoPayload,
  type AjusteEstoqueDecididoPayload,
  type CargaItemDivergentePayload,
} from './events/eventos';

/** Socket autenticado: carrega o payload do usuário validado no handshake. */
type AuthSocket = WebSocket & { user?: CurrentUserPayload };

interface MensagemCliente {
  type: string;
  room?: string;
}

/**
 * Gateway WebSocket nativo (ADR-004): atacha um WebSocketServer({ noServer })
 * ao mesmo http.Server do Nest via evento 'upgrade'. Autentica o handshake pelo
 * cookie access_token. Escuta eventos de domínio e faz broadcast por room.
 * Sem polling. Todo handler é defensivo — broadcast nunca derruba o request HTTP.
 */
@Injectable()
export class RealtimeGateway implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RealtimeGateway.name);
  private wss?: WebSocketServer;
  private server?: Server;
  private upgradeHandler?: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly tokenService: TokenService,
    private readonly hub: RealtimeHub,
  ) {}

  onModuleInit(): void {
    const server = this.httpAdapterHost.httpAdapter?.getHttpServer() as Server | undefined;
    if (!server) {
      this.logger.warn('http server indisponível — gateway WebSocket não atachado');
      return;
    }
    this.server = server;
    this.wss = new WebSocketServer({ noServer: true });

    this.upgradeHandler = (req, socket, head) => {
      const user = this.autenticar(req);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        (ws as AuthSocket).user = user;
        this.registrar(ws as AuthSocket);
      });
    };

    server.on('upgrade', this.upgradeHandler);
  }

  onApplicationShutdown(): void {
    if (this.server && this.upgradeHandler) {
      this.server.removeListener('upgrade', this.upgradeHandler);
    }
    if (this.wss) {
      for (const client of this.wss.clients) client.terminate();
      this.wss.close();
    }
  }

  /** Valida o cookie access_token do handshake; retorna o payload ou null. */
  private autenticar(req: IncomingMessage): CurrentUserPayload | null {
    try {
      const token = lerCookie(req.headers.cookie, 'access_token');
      if (!token) return null;
      return this.tokenService.verifyAccessToken(token);
    } catch {
      return null;
    }
  }

  private registrar(ws: AuthSocket): void {
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as MensagemCliente;
        if (msg.type === 'subscribe' && typeof msg.room === 'string') {
          if (this.podeAssinar(ws)) this.hub.join(ws, msg.room);
        }
      } catch {
        // mensagem malformada — ignora silenciosamente (não derruba a conexão)
      }
    });
    ws.on('close', () => this.hub.leaveAll(ws));
    ws.on('error', () => this.hub.leaveAll(ws));
  }

  /** Assinatura de rooms de operação exige a permissão de leitura de disponibilidade. */
  private podeAssinar(ws: AuthSocket): boolean {
    return ws.user?.permissoes?.includes(PERMISSOES.DISPONIBILIDADE_LER) ?? false;
  }

  // ── Eventos de domínio → broadcast (defensivo) ────────────────────────────

  @OnEvent(EVENTOS.RESERVA_ATUALIZADA)
  handleReservaAtualizada(payload: ReservaAtualizadaPayload): void {
    this.broadcast(EVENTOS.RESERVA_ATUALIZADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.DISPONIBILIDADE_GERADA)
  handleDisponibilidadeGerada(payload: DisponibilidadeGeradaPayload): void {
    this.broadcast(EVENTOS.DISPONIBILIDADE_GERADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.COMPRA_CONFIRMADA)
  handleCompraConfirmada(payload: CompraConfirmadaPayload): void {
    this.broadcast(EVENTOS.COMPRA_CONFIRMADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PEDIDO_SEM_COBERTURA)
  handlePedidoSemCobertura(payload: PedidoSemCoberturaPayload): void {
    this.broadcast(EVENTOS.PEDIDO_SEM_COBERTURA, payload, payload.dataOperacao);
  }

  // ── F4a — Recebimento + Divergências ──────────────────────────────────────

  @OnEvent(EVENTOS.RECEBIMENTO_INICIADO)
  handleRecebimentoIniciado(payload: RecebimentoIniciadoPayload): void {
    this.broadcast(EVENTOS.RECEBIMENTO_INICIADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.RECEBIMENTO_REGISTRADO)
  handleRecebimentoRegistrado(payload: RecebimentoRegistradoPayload): void {
    this.broadcast(EVENTOS.RECEBIMENTO_REGISTRADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.DIVERGENCIA_RECEBIMENTO_ABERTA)
  handleDivergenciaAberta(payload: DivergenciaRecebimentoPayload): void {
    this.broadcast(EVENTOS.DIVERGENCIA_RECEBIMENTO_ABERTA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.DIVERGENCIA_RECEBIMENTO_ATUALIZADA)
  handleDivergenciaAtualizada(payload: DivergenciaRecebimentoPayload): void {
    this.broadcast(EVENTOS.DIVERGENCIA_RECEBIMENTO_ATUALIZADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.OCORRENCIA_FORNECEDOR_ABERTA)
  handleOcorrenciaAberta(payload: OcorrenciaFornecedorPayload): void {
    this.broadcast(EVENTOS.OCORRENCIA_FORNECEDOR_ABERTA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.OCORRENCIA_FORNECEDOR_ATUALIZADA)
  handleOcorrenciaAtualizada(payload: OcorrenciaFornecedorPayload): void {
    this.broadcast(EVENTOS.OCORRENCIA_FORNECEDOR_ATUALIZADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PEDIDO_EM_RISCO)
  handlePedidoEmRisco(payload: PedidoEmRiscoPayload): void {
    this.broadcast(EVENTOS.PEDIDO_EM_RISCO, payload, payload.dataOperacao);
  }

  // ── F4b — Pesagem + Associação + Etiquetagem ──────────────────────────────

  @OnEvent(EVENTOS.PECA_PESADA)
  handlePecaPesada(payload: PecaPesadaPayload): void {
    this.broadcast(EVENTOS.PECA_PESADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PECA_ASSOCIADA)
  handlePecaAssociada(payload: PecaAssociadaPayload): void {
    this.broadcast(EVENTOS.PECA_ASSOCIADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PECA_REDIRECIONADA)
  handlePecaRedirecionada(payload: PecaRedirecionadaPayload): void {
    this.broadcast(EVENTOS.PECA_REDIRECIONADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.DISPOSITIVO_STATUS_ALTERADO)
  handleDispositivoStatus(payload: DispositivoStatusPayload): void {
    this.broadcast(EVENTOS.DISPOSITIVO_STATUS_ALTERADO, payload, payload.dataOperacao);
  }

  // ── F4c — Corte / Transformação ───────────────────────────────────────────

  @OnEvent(EVENTOS.CORTE_INICIADO)
  handleCorteIniciado(payload: CorteIniciadoPayload): void {
    this.broadcast(EVENTOS.CORTE_INICIADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.SUBITEM_GERADO)
  handleSubitemGerado(payload: SubitemGeradoPayload): void {
    this.broadcast(EVENTOS.SUBITEM_GERADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.SUBITEM_PESADO)
  handleSubitemPesado(payload: SubitemPesadoPayload): void {
    this.broadcast(EVENTOS.SUBITEM_PESADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.SUBITEM_ASSOCIADO)
  handleSubitemAssociado(payload: SubitemAssociadoPayload): void {
    this.broadcast(EVENTOS.SUBITEM_ASSOCIADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.CORTE_CONCLUIDO)
  handleCorteConcluido(payload: CorteConcluidoPayload): void {
    this.broadcast(EVENTOS.CORTE_CONCLUIDO, payload, payload.dataOperacao);
  }

  // ── F5 — Expedição ────────────────────────────────────────────────────────

  @OnEvent(EVENTOS.CARGA_ITEM_ADICIONADO)
  handleCargaItemAdicionado(payload: CargaItemAdicionadoPayload): void {
    this.broadcast(EVENTOS.CARGA_ITEM_ADICIONADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.CARGA_ITEM_TRANSFERIDO)
  handleCargaItemTransferido(payload: CargaItemTransferidoPayload): void {
    this.broadcast(EVENTOS.CARGA_ITEM_TRANSFERIDO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.CARGA_ITEM_REMOVIDO)
  handleCargaItemRemovido(payload: CargaItemRemovidoPayload): void {
    this.broadcast(EVENTOS.CARGA_ITEM_REMOVIDO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.CONFERENCIA_CONCLUIDA)
  handleConferenciaConcluida(payload: ConferenciaConcluidaPayload): void {
    this.broadcast(EVENTOS.CONFERENCIA_CONCLUIDA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.EXPEDICAO_FECHADA)
  handleExpedicaoFechada(payload: ExpedicaoFechadaPayload): void {
    this.broadcast(EVENTOS.EXPEDICAO_FECHADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.EXPEDICAO_REABERTA)
  handleExpedicaoReaberta(payload: ExpedicaoReabertaPayload): void {
    this.broadcast(EVENTOS.EXPEDICAO_REABERTA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.CARGA_ITEM_DIVERGENTE)
  handleCargaItemDivergente(payload: CargaItemDivergentePayload): void {
    this.broadcast(EVENTOS.CARGA_ITEM_DIVERGENTE, payload, payload.dataOperacao);
  }

  // ── F6a — Faturamento / NFS-e ─────────────────────────────────────────────

  @OnEvent(EVENTOS.NFSE_EMITIDA)
  handleNfseEmitida(payload: NfseEmitidaPayload): void {
    this.broadcast(EVENTOS.NFSE_EMITIDA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.NFSE_CANCELADA)
  handleNfseCancelada(payload: NfseCanceladaPayload): void {
    this.broadcast(EVENTOS.NFSE_CANCELADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.NFSE_ERRO_EMISSAO)
  handleNfseErroEmissao(payload: NfseErroEmissaoPayload): void {
    this.broadcast(EVENTOS.NFSE_ERRO_EMISSAO, payload, payload.dataOperacao);
  }

  // ── Onda 5 — Gestão ───────────────────────────────────────────────────────

  @OnEvent(EVENTOS.COMPRA_ALTERADA_IMPACTO)
  handleCompraAlteradaImpacto(payload: CompraAlteradaImpactoPayload): void {
    this.broadcast(EVENTOS.COMPRA_ALTERADA_IMPACTO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.APROVACAO_REGISTRADA)
  handleAprovacaoRegistrada(payload: AprovacaoOperacionalPayload): void {
    this.broadcast(EVENTOS.APROVACAO_REGISTRADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.APROVACAO_DECIDIDA)
  handleAprovacaoDecidida(payload: AprovacaoOperacionalPayload): void {
    this.broadcast(EVENTOS.APROVACAO_DECIDIDA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.RELATORIO_SIF_GERADO)
  handleRelatorioSifGerado(payload: RelatorioSifGeradoPayload): void {
    this.broadcast(EVENTOS.RELATORIO_SIF_GERADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PENDENCIA_OVERBOOKING_ABERTA)
  handlePendenciaAberta(payload: PendenciaOverbookingPayload & { pedidoVendaId: string }): void {
    this.broadcast(EVENTOS.PENDENCIA_OVERBOOKING_ABERTA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PENDENCIA_OVERBOOKING_ATUALIZADA)
  handlePendenciaAtualizada(payload: PendenciaOverbookingPayload): void {
    this.broadcast(EVENTOS.PENDENCIA_OVERBOOKING_ATUALIZADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.PENDENCIA_OVERBOOKING_RESOLVIDA)
  handlePendenciaResolvida(payload: PendenciaOverbookingPayload): void {
    this.broadcast(EVENTOS.PENDENCIA_OVERBOOKING_RESOLVIDA, payload, payload.dataOperacao);
  }

  // ── Onda 7 — Desossa / Transformação ──────────────────────────────────────

  @OnEvent(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS)
  handleFaltasDesossaAtualizadas(payload: FaltasDesossaAtualizadasPayload): void {
    this.broadcast(EVENTOS.FALTAS_DESOSSA_ATUALIZADAS, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA)
  handleDivergenciaTransformacaoAberta(payload: DivergenciaTransformacaoAbertaPayload): void {
    this.broadcast(EVENTOS.DIVERGENCIA_TRANSFORMACAO_ABERTA, payload, payload.dataOperacao);
  }

  // ── Onda 8 — Estoque ───────────────────────────────────────────────────────

  @OnEvent(EVENTOS.ESTOQUE_ITEM_DESTINADO)
  handleEstoqueItemDestinado(payload: EstoqueItemDestinadoPayload): void {
    this.broadcast(EVENTOS.ESTOQUE_ITEM_DESTINADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.ENTRADA_ITENS_REGISTRADA)
  handleEntradaItensRegistrada(payload: EntradaItensRegistradaPayload): void {
    this.broadcast(EVENTOS.ENTRADA_ITENS_REGISTRADA, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.AJUSTE_ESTOQUE_CRIADO)
  handleAjusteEstoqueCriado(payload: AjusteEstoqueCriadoPayload): void {
    this.broadcast(EVENTOS.AJUSTE_ESTOQUE_CRIADO, payload, payload.dataOperacao);
  }

  @OnEvent(EVENTOS.AJUSTE_ESTOQUE_DECIDIDO)
  handleAjusteEstoqueDecidido(payload: AjusteEstoqueDecididoPayload): void {
    this.broadcast(EVENTOS.AJUSTE_ESTOQUE_DECIDIDO, payload, payload.dataOperacao);
  }

  private broadcast(evento: string, payload: unknown, dataOperacao: string): void {
    try {
      for (const room of roomsDaData(dataOperacao)) {
        this.hub.broadcast(room, evento, payload);
      }
    } catch (err) {
      this.logger.error(`Falha ao fazer broadcast de ${evento}`, err as Error);
    }
  }
}

/** Extrai um cookie do header Cookie cru (sem dependência externa). */
function lerCookie(header: string | undefined, nome: string): string | undefined {
  if (!header) return undefined;
  for (const parte of header.split(';')) {
    const idx = parte.indexOf('=');
    if (idx === -1) continue;
    const chave = parte.slice(0, idx).trim();
    if (chave === nome) return decodeURIComponent(parte.slice(idx + 1).trim());
  }
  return undefined;
}
