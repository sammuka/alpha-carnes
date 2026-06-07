import { Global, Module } from '@nestjs/common';
import { BALANCA_GATEWAY, IMPRESSORA_GATEWAY, LEITOR_GATEWAY } from './hardware.types';
import { FakeBalancaGateway } from './fakes/fake-balanca.gateway';
import { FakeLeitorGateway } from './fakes/fake-leitor.gateway';
import { FakeImpressoraGateway } from './fakes/fake-impressora.gateway';
import { SerialBalancaAdapter } from './adapters/serial-balanca.adapter';
import { SerialLeitorAdapter } from './adapters/serial-leitor.adapter';
import { FilaImpressoraAdapter } from './adapters/fila-impressora.adapter';

/**
 * Gateways de hardware isolados (RA-03). O backend depende sempre das interfaces
 * (DI tokens); o fake é o único ponto que muda entre prod e teste.
 *
 * HARDWARE_FAKE=1 (CI/testes) → gateways FAKE controláveis, que cobrem o fallback
 * de indisponibilidade de forma determinística. Caso contrário, os adapters reais
 * (stub indisponível, ADR-010) — a operação física fica no caminho manual até o
 * driver serial entrar na fase de infraestrutura on-premises.
 */
const usarFake = process.env.HARDWARE_FAKE === '1';

@Global()
@Module({
  providers: [
    { provide: BALANCA_GATEWAY, useClass: usarFake ? FakeBalancaGateway : SerialBalancaAdapter },
    { provide: LEITOR_GATEWAY, useClass: usarFake ? FakeLeitorGateway : SerialLeitorAdapter },
    { provide: IMPRESSORA_GATEWAY, useClass: usarFake ? FakeImpressoraGateway : FilaImpressoraAdapter },
  ],
  exports: [BALANCA_GATEWAY, LEITOR_GATEWAY, IMPRESSORA_GATEWAY],
})
export class HardwareModule {}
