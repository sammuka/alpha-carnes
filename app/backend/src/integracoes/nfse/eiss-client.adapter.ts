import { Injectable } from '@nestjs/common';
import type {
  NfseGateway,
  NfseResultado,
  EmitirNfseRequest,
  CancelarNfseRequest,
  ConsultarNfseRequest,
} from './nfse.types';
import { NfseTransporteError } from './nfse.types';

/**
 * Adapter real do EISS via node-soap (ADR-006 / ADR-011).
 *
 * Integração SOAP completa planejada para o ambiente de produção on-premises:
 * - SOAPAction manual, document/literal, forceSoap12Headers: false.
 * - ChaveAutenticacao injetada apenas no momento do envio; NUNCA persistida em banco/logs.
 * - Redação de segredos via redigirSegredos() antes de qualquer log.
 * - Timeout de 30s; retry com backoff (5s→10s→20s) controlado pelo FaturamentoService.
 *
 * Em dev/CI, usar NFSE_FAKE=1 para ativar o FakeNfseGateway determinístico.
 * O node-soap será configurado quando o ambiente de homologação EISS estiver disponível.
 */
@Injectable()
export class EissClientAdapter implements NfseGateway {
  async emitir(_req: EmitirNfseRequest): Promise<NfseResultado> {
    throw new NfseTransporteError(
      'EissClientAdapter: driver node-soap não configurado (use NFSE_FAKE=1 em dev/CI)',
    );
  }

  async cancelar(_req: CancelarNfseRequest): Promise<NfseResultado> {
    throw new NfseTransporteError(
      'EissClientAdapter: driver node-soap não configurado (use NFSE_FAKE=1 em dev/CI)',
    );
  }

  async consultarNotaCompleta(_req: ConsultarNfseRequest): Promise<NfseResultado> {
    throw new NfseTransporteError(
      'EissClientAdapter: driver node-soap não configurado (use NFSE_FAKE=1 em dev/CI)',
    );
  }
}
