import { Global, Module } from '@nestjs/common';
import { NFSE_GATEWAY } from './nfse.types';
import { FakeNfseGateway } from './fake-nfse.gateway';
import { EissClientAdapter } from './eiss-client.adapter';

/**
 * Gateway NFS-e isolado (ADR-011 / RA-03 / RA-05). O módulo resolve o DI token
 * NFSE_GATEWAY para o fake determinístico (NFSE_FAKE=1 — CI/testes) ou para o
 * adapter real EISS via node-soap (produção).
 *
 * Nunca importe EissClientAdapter ou FakeNfseGateway diretamente — injete sempre
 * pelo token NFSE_GATEWAY para manter o isolamento.
 */
const usarFake = process.env.NFSE_FAKE === '1';

@Global()
@Module({
  providers: [
    { provide: NFSE_GATEWAY, useClass: usarFake ? FakeNfseGateway : EissClientAdapter },
  ],
  exports: [NFSE_GATEWAY],
})
export class NfseModule {}
