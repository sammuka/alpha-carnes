'use client';

// Cliente WebSocket do painel de tempo real (ADR-004): assina rooms e recebe
// broadcasts do backend. Reconexão com backoff; ao reconectar, dispara
// onReconnect para o caller refazer o fetch do estado atual (não confia em
// deltas perdidos durante a queda).

export interface RealtimeMensagem {
  type: string;
  payload: unknown;
}

export interface ConectarOpts {
  rooms: string[];
  onMessage: (msg: RealtimeMensagem) => void;
  onReconnect?: () => void;
  onStatus?: (status: 'conectado' | 'desconectado') => void;
}

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001').replace(/^http/, 'ws');

export function conectarRealtime(opts: ConectarOpts): () => void {
  let ws: WebSocket | null = null;
  let fechadoPeloCaller = false;
  let tentativa = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let jaConectouUmaVez = false;

  const conectar = () => {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      tentativa = 0;
      opts.onStatus?.('conectado');
      for (const room of opts.rooms) {
        ws?.send(JSON.stringify({ type: 'subscribe', room }));
      }
      // Reconexão (não a primeira conexão) → refetch do estado atual.
      if (jaConectouUmaVez) opts.onReconnect?.();
      jaConectouUmaVez = true;
    };

    ws.onmessage = (ev) => {
      try {
        opts.onMessage(JSON.parse(ev.data as string) as RealtimeMensagem);
      } catch {
        // mensagem malformada — ignora
      }
    };

    ws.onclose = () => {
      opts.onStatus?.('desconectado');
      if (fechadoPeloCaller) return;
      // backoff exponencial limitado a 10s
      tentativa += 1;
      const atraso = Math.min(1000 * 2 ** Math.min(tentativa, 4), 10000);
      timer = setTimeout(conectar, atraso);
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  conectar();

  return () => {
    fechadoPeloCaller = true;
    if (timer) clearTimeout(timer);
    ws?.close();
  };
}
