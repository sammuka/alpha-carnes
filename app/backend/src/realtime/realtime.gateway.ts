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
