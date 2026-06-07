import { Injectable } from '@nestjs/common';
import type { BalancaGateway, LeituraPeso, SaudeDispositivo, StatusDispositivo } from '../hardware.types';

/**
 * Balança FAKE para CI/testes (ADR-009 §"testável com fake"). Estado controlável
 * para simular disponivel/instavel/indisponivel sem hardware físico:
 * - disponivel  → lerEstavel resolve { estavel: true }
 * - instavel    → lerEstavel resolve { estavel: false } (não confirma automático)
 * - indisponivel→ lerEstavel LANÇA erro explícito (sem inventar valor)
 */
@Injectable()
export class FakeBalancaGateway implements BalancaGateway {
  private estado: StatusDispositivo = 'disponivel';
  private peso = '12.500';
  private readonly dispositivoId = 'fake-balanca-01';

  definirStatus(status: StatusDispositivo): void {
    this.estado = status;
  }

  definirPeso(peso: string): void {
    this.peso = peso;
  }

  status(): SaudeDispositivo {
    return { status: this.estado, dispositivoId: this.dispositivoId, heartbeatEm: new Date().toISOString() };
  }

  async lerEstavel(): Promise<LeituraPeso> {
    const saude = this.status();
    if (this.estado === 'indisponivel') {
      throw new Error('Balança indisponível: leitura automática não disponível');
    }
    return { peso: this.peso, estavel: this.estado === 'disponivel', saude };
  }
}
