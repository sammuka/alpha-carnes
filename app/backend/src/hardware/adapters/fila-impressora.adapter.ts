import { Injectable } from '@nestjs/common';
import type { ImpressoraGateway, ResultadoImpressao, SaudeDispositivo } from '../hardware.types';

/**
 * Adapter real da impressora. Driver físico adiado (ADR-010): reporta sempre
 * `indisponivel`. A impressão é best-effort (REFINO 1) — não lança; devolve
 * impresso=false + erro, para a etiqueta lógica avançar e a impressão ficar
 * pendente até a impressora real entrar.
 */
@Injectable()
export class FilaImpressoraAdapter implements ImpressoraGateway {
  private readonly dispositivoId = 'impressora-etiqueta-real';
  private seq = 0;

  status(): SaudeDispositivo {
    return { status: 'indisponivel', dispositivoId: this.dispositivoId, heartbeatEm: new Date().toISOString() };
  }

  async imprimir(): Promise<ResultadoImpressao> {
    this.seq += 1;
    return {
      jobId: `${this.dispositivoId}-job-${this.seq}`,
      impresso: false,
      saude: this.status(),
      erro: 'Driver da impressora não instalado (ADR-010): impressão física pendente',
    };
  }
}
