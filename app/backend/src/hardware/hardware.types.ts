// Contrato único de captura física (ADR-009 / RA-03). O backend SEMPRE depende
// destas interfaces (via DI token), nunca de um driver concreto — isso isola o
// hardware e torna o caminho de indisponibilidade/fallback testável com um fake.

/** Saúde do dispositivo publicada pelo gateway (com heartbeat). */
export type StatusDispositivo = 'disponivel' | 'instavel' | 'indisponivel';

export interface SaudeDispositivo {
  status: StatusDispositivo;
  dispositivoId: string;
  /** ISO timestamp do último heartbeat conhecido. */
  heartbeatEm: string;
}

/** Leitura de peso com flag de estabilidade e snapshot da saúde no momento. */
export interface LeituraPeso {
  /** Peso como string NUMERIC(.,3) — nunca float, evita drift. */
  peso: string;
  estavel: boolean;
  saude: SaudeDispositivo;
}

export interface ResultadoImpressao {
  jobId: string;
  /** true só quando o dispositivo aceitou o job fisicamente. */
  impresso: boolean;
  saude: SaudeDispositivo;
  /** Mensagem de erro quando a impressão física falhou (impressora down). */
  erro?: string;
}

/** Balança RS-232/USB. `lerEstavel` rejeita (lança) se o dispositivo está fora. */
export interface BalancaGateway {
  status(): SaudeDispositivo;
  lerEstavel(): Promise<LeituraPeso>;
}

/** Leitor/scanner QR. `ler` rejeita se o dispositivo está fora. */
export interface LeitorGateway {
  status(): SaudeDispositivo;
  ler(): Promise<string>;
}

/** Impressora de etiquetas. `imprimir` é best-effort: nunca lança por estar fora
 *  — devolve `impresso=false` + erro, para o fluxo lógico não morrer (REFINO 1). */
export interface ImpressoraGateway {
  status(): SaudeDispositivo;
  imprimir(payload: unknown): Promise<ResultadoImpressao>;
}

// DI tokens — o backend injeta sempre por estes símbolos.
export const BALANCA_GATEWAY = Symbol('BALANCA_GATEWAY');
export const LEITOR_GATEWAY = Symbol('LEITOR_GATEWAY');
export const IMPRESSORA_GATEWAY = Symbol('IMPRESSORA_GATEWAY');
