import { Injectable } from '@nestjs/common';
import type { BalancaGateway, LeituraPeso, SaudeDispositivo } from '../hardware.types';

/**
 * Adapter real da balança RS-232. O driver serial físico (node-serialport) é
 * adiado para a fase de infraestrutura on-premises (ADR-010): aqui o adapter
 * reporta sempre `indisponivel` e a leitura automática lança erro explícito —
 * o caminho manual assistido (ADR-009) cobre a operação até o driver entrar.
 */
@Injectable()
export class SerialBalancaAdapter implements BalancaGateway {
  private readonly dispositivoId = 'balanca-serial-real';

  status(): SaudeDispositivo {
    return { status: 'indisponivel', dispositivoId: this.dispositivoId, heartbeatEm: new Date().toISOString() };
  }

  async lerEstavel(): Promise<LeituraPeso> {
    throw new Error('Driver serial da balança não instalado (ADR-010): use captura manual assistida');
  }
}
