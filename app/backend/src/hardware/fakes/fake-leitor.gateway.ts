import { Injectable } from '@nestjs/common';
import type { LeitorGateway, SaudeDispositivo, StatusDispositivo } from '../hardware.types';

/**
 * Leitor QR FAKE. indisponivel → ler() lança (força o caminho manual autorizado);
 * disponivel → devolve o código previamente definido.
 */
@Injectable()
export class FakeLeitorGateway implements LeitorGateway {
  private estado: StatusDispositivo = 'disponivel';
  private codigo = '';
  private readonly dispositivoId = 'fake-leitor-01';

  definirStatus(status: StatusDispositivo): void {
    this.estado = status;
  }

  definirCodigo(codigo: string): void {
    this.codigo = codigo;
  }

  status(): SaudeDispositivo {
    return { status: this.estado, dispositivoId: this.dispositivoId, heartbeatEm: new Date().toISOString() };
  }

  async ler(): Promise<string> {
    if (this.estado === 'indisponivel') {
      throw new Error('Leitor indisponível: leitura automática não disponível');
    }
    return this.codigo;
  }
}
