import { Injectable } from '@nestjs/common';
import type { LeitorGateway, SaudeDispositivo } from '../hardware.types';

/**
 * Adapter real do leitor QR. Driver físico adiado (ADR-010): reporta sempre
 * `indisponivel`; a leitura automática lança e o caminho manual (LEITURA_MANUAL,
 * ADR-009) cobre a digitação do identificador.
 */
@Injectable()
export class SerialLeitorAdapter implements LeitorGateway {
  private readonly dispositivoId = 'leitor-qr-real';

  status(): SaudeDispositivo {
    return { status: 'indisponivel', dispositivoId: this.dispositivoId, heartbeatEm: new Date().toISOString() };
  }

  async ler(): Promise<string> {
    throw new Error('Driver do leitor QR não instalado (ADR-010): use leitura manual autorizada');
  }
}
