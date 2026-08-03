import { Injectable } from '@nestjs/common';
import type {
  NfseGateway,
  NfseResultado,
  EmitirNfseRequest,
  CancelarNfseRequest,
  ConsultarNfseRequest,
  RtcPesquisaNbsClassTrib,
} from './nfse.types';
import { NfseTransporteError } from './nfse.types';

type CenarioNfse = 'sucesso' | 'erro_negocio' | 'timeout' | 'http500';

/**
 * Gateway NFS-e FAKE para CI/testes (ADR-011). Estado controlável para simular
 * os quatro cenários do EISS sem dependência de rede:
 *
 * - sucesso      → emitir/cancelar retornam NfseResultado sem erro.
 * - erro_negocio → retornam NfseResultado com erro=true (sem lançar exceção —
 *                   é resposta de negócio do EISS, não falha de transporte).
 * - timeout      → lançam NfseTransporteError (retriável).
 * - http500      → lançam NfseTransporteError (retriável).
 *
 * consultarNotaCompleta NUNCA lança — sempre retorna uma resposta, controlada
 * por definirConsultarAchaNota().
 */
@Injectable()
export class FakeNfseGateway implements NfseGateway {
  private cenario: CenarioNfse = 'sucesso';
  private consultarAchaNota = true;

  /** Muta o cenário de emissão/cancelamento para o próximo call. */
  definirCenario(c: CenarioNfse): void {
    this.cenario = c;
  }

  /** Controla se consultarNotaCompleta "acha" a nota (true) ou retorna erro (false). */
  definirConsultarAchaNota(v: boolean): void {
    this.consultarAchaNota = v;
  }

  async rtcPesquisarNbsClassTrib(): Promise<RtcPesquisaNbsClassTrib[]> {
    return [{ codigoNbs: '111041000', classTrib: '000001', descricao: 'Fake — pesquisa determinística' }];
  }

  async emitir(req: EmitirNfseRequest): Promise<NfseResultado> {
    if (req.valor === '999.99') return { erro: true, mensagemErro: 'Atividade não autorizada', raw: {} };
    if (req.valor === '888.88') throw new NfseTransporteError('Timeout simulado (valor gatilho 888.88)');
    return { ...this.resolverCenario(), identificadorEco: req.identificador };
  }

  async cancelar(_req: CancelarNfseRequest): Promise<NfseResultado> {
    return this.resolverCenario();
  }

  async consultarNotaCompleta(_req: ConsultarNfseRequest): Promise<NfseResultado> {
    if (this.consultarAchaNota) {
      return { erro: false, numeroNota: 'FAKE-001', codigoVerificacao: 'FAKECODE123', raw: {} };
    }
    return { erro: true, mensagemErro: 'Nota não encontrada', raw: {} };
  }

  // ---------------------------------------------------------------------------

  private resolverCenario(): NfseResultado {
    switch (this.cenario) {
      case 'sucesso':
        return { erro: false, numeroNota: 'FAKE-001', codigoVerificacao: 'FAKECODE123', raw: {} };
      case 'erro_negocio':
        return { erro: true, mensagemErro: 'CNPJ do tomador inválido.', raw: {} };
      case 'timeout':
        throw new NfseTransporteError('Timeout na comunicação com EISS');
      case 'http500':
        throw new NfseTransporteError('Internal Server Error (HTTP 500) no EISS');
    }
  }
}
