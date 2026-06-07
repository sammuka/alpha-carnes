import { Injectable } from '@nestjs/common';

/** Interface mínima de socket usada pelo hub (testável sem `ws` real). */
export interface RealtimeSocket {
  /** 1 = OPEN (ws.OPEN). Só envia quando aberto. */
  readyState: number;
  send(data: string): void;
}

const OPEN = 1;

/**
 * Gerencia rooms de WebSocket e broadcast. Sem dependência do servidor `ws`
 * (recebe sockets por interface) — testável em isolamento. O gateway atacha
 * os sockets reais; aqui só roteamos mensagens por room.
 */
@Injectable()
export class RealtimeHub {
  private readonly rooms = new Map<string, Set<RealtimeSocket>>();

  join(socket: RealtimeSocket, room: string): void {
    let set = this.rooms.get(room);
    if (!set) {
      set = new Set();
      this.rooms.set(room, set);
    }
    set.add(socket);
  }

  leaveAll(socket: RealtimeSocket): void {
    for (const [room, set] of this.rooms) {
      set.delete(socket);
      if (set.size === 0) this.rooms.delete(room);
    }
  }

  broadcast(room: string, type: string, payload: unknown): void {
    const set = this.rooms.get(room);
    if (!set) return;
    const data = JSON.stringify({ type, payload });
    for (const socket of set) {
      if (socket.readyState === OPEN) {
        socket.send(data);
      } else {
        set.delete(socket); // limpa sockets mortos
      }
    }
    if (set.size === 0) this.rooms.delete(room);
  }
}
