import { Injectable } from '@nestjs/common';
import type { ImpressoraGateway, ResultadoImpressao, SaudeDispositivo, StatusDispositivo } from '../hardware.types';

/**
 * Impressora FAKE. Acumula os jobs numa fila consultável (auditoria de teste).
 * Best-effort (REFINO 1): indisponivel não lança — devolve impresso=false + erro,
 * para o fluxo lógico da etiqueta não morrer.
 */
@Injectable()
export class FakeImpressoraGateway implements ImpressoraGateway {
  private estado: StatusDispositivo = 'disponivel';
  private readonly dispositivoId = 'fake-impressora-01';
  private seq = 0;
  readonly fila: Array<{ jobId: string; payload: unknown; impresso: boolean }> = [];

  definirStatus(status: StatusDispositivo): void {
    this.estado = status;
  }

  status(): SaudeDispositivo {
    return { status: this.estado, dispositivoId: this.dispositivoId, heartbeatEm: new Date().toISOString() };
  }

  async imprimir(payload: unknown): Promise<ResultadoImpressao> {
    const saude = this.status();
    this.seq += 1;
    const jobId = `${this.dispositivoId}-job-${this.seq}`;
    const impresso = this.estado === 'disponivel';
    this.fila.push({ jobId, payload, impresso });
    return impresso
      ? { jobId, impresso: true, saude }
      : { jobId, impresso: false, saude, erro: 'Impressora indisponível: impressão física pendente' };
  }
}
