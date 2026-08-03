import { Injectable, Logger } from '@nestjs/common';
import type {
  NfseGateway,
  NfseResultado,
  EmitirNfseRequest,
  CancelarNfseRequest,
  ConsultarNfseRequest,
  RtcPesquisaNbsClassTrib,
} from './nfse.types';
import { NfseTransporteError } from './nfse.types';
import { redigirSegredos } from './payload-builder';

const NS = {
  tem: 'http://tempuri.org/',
  eis: 'http://schemas.datacontract.org/2004/07/Eissnfe.Negocio.WebServices.Mensagem',
  eis1: 'http://schemas.datacontract.org/2004/07/Eissnfe.Dominio.DataTransferObject.Prestador',
  eis2: 'http://schemas.datacontract.org/2004/07/Eissnfe.Dominio.DataTransferObject.Contribuinte',
};

function endpoint(homologacao: boolean): string {
  const url = homologacao ? process.env['EISS_ENDPOINT_HML'] : process.env['EISS_ENDPOINT_PRD'];
  if (!url) throw new Error(`Variável EISS_ENDPOINT_${homologacao ? 'HML' : 'PRD'} não configurada`);
  return url;
}

/** Escapa entidades XML nos valores de texto interpolados no envelope. */
function xmlEscape(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Extrai o conteúdo de texto da primeira ocorrência de uma tag XML (regex simples — shape estável dos manuais). */
function tag(xml: string, nome: string): string | undefined {
  const m = xml.match(new RegExp(`<[\\w:]*${nome}[^>]*>([^<]*)</[\\w:]*${nome}>`));
  return m?.[1];
}

/**
 * Adapter real do EISS via template string + fetch nativo (D10.11 — FIXADO, sem
 * WSDL/node-soap: o WSDL real não está vendorizado no repositório).
 *
 * Integração SOAP contra o webservice EISS Osasco-SP:
 * - Envelope montado literalmente conforme docs/integrações/nfse-osasco/eiss-webservice.md.
 * - ChaveAutenticacao injetada apenas no momento do envio; NUNCA persistida em banco/logs.
 * - Redação de segredos via redigirSegredos() antes de qualquer persistência do raw.
 * - Timeout via AbortSignal.timeout(EISS_TIMEOUT_MS) (30s default).
 *
 * Em dev/CI, usar NFSE_FAKE=1 para ativar o FakeNfseGateway determinístico.
 */
@Injectable()
export class EissClientAdapter implements NfseGateway {
  private readonly logger = new Logger(EissClientAdapter.name);

  async emitir(req: EmitirNfseRequest): Promise<NfseResultado> {
    const metodo = req.modeloFiscal === 'rtc' ? 'RTC_EmitirNFE' : 'Emitir';
    const tagNota = req.modeloFiscal === 'rtc' ? 'NotaFiscal_RTC' : 'NotaFiscal';
    const camposRtc = req.modeloFiscal === 'rtc'
      ? `<eis1:ClassTrib>${xmlEscape(req.rtcClassTrib)}</eis1:ClassTrib>
          <eis1:CodigoNBS>${xmlEscape(req.rtcCodigoNbs)}</eis1:CodigoNBS>
          <eis1:IndOperacao>${xmlEscape(req.rtcIndOperacao)}</eis1:IndOperacao>
          <eis1:IdLocalIncidencia>${xmlEscape(req.rtcIdLocalIncidencia)}</eis1:IdLocalIncidencia>`
      : '';
    const corpo = `<eis:${tagNota}>
          <eis1:ChaveAutenticacao>${xmlEscape(req.chaveAutenticacao)}</eis1:ChaveAutenticacao>
          <eis1:Homologacao>${req.homologacao}</eis1:Homologacao>
          <eis1:Identificador>${xmlEscape(req.identificador)}</eis1:Identificador>
          <eis1:nrExercicioReferencia>${req.nrExercicioReferencia}</eis1:nrExercicioReferencia>
          <eis1:nrMesReferencia>${req.nrMesReferencia}</eis1:nrMesReferencia>
          <eis1:Atividade>${xmlEscape(req.atividade)}</eis1:Atividade>
          <eis1:Aliquota>${xmlEscape(req.aliquota)}</eis1:Aliquota>
          <eis1:SubstituicaoTributaria>${req.substituicaoTributaria}</eis1:SubstituicaoTributaria>
          <eis1:SemIncidenciaISS>${req.semIncidenciaISS}</eis1:SemIncidenciaISS>
          <eis1:SimplesNacional>${req.simplesNacional}</eis1:SimplesNacional>
          <eis1:TomadorEstrangeiro>${req.tomadorEstrangeiro}</eis1:TomadorEstrangeiro>
          <eis1:Tomador>
            ${req.tomador.cnpj ? `<eis2:CNPJ>${xmlEscape(req.tomador.cnpj)}</eis2:CNPJ>` : `<eis2:CPF>${xmlEscape(req.tomador.cpf)}</eis2:CPF>`}
            <eis2:Nome>${xmlEscape(req.tomador.nome)}</eis2:Nome>
            ${req.tomador.email ? `<eis2:Email>${xmlEscape(req.tomador.email)}</eis2:Email>` : ''}
          </eis1:Tomador>
          <eis1:NotificarTomadorPorEmail>${req.notificarTomadorPorEmail}</eis1:NotificarTomadorPorEmail>
          <eis1:InformacoesAdicionais>${xmlEscape(req.informacoesAdicionais)}</eis1:InformacoesAdicionais>
          <eis1:Valor>${xmlEscape(req.valor)}</eis1:Valor>
          <eis1:DeduzirRepasse>${req.deduzirRepasse}</eis1:DeduzirRepasse>
          ${camposRtc}
        </eis:${tagNota}>`;
    const envelope = this.envelopeComNs(`<tem:${metodo}><tem:request>${corpo}</tem:request></tem:${metodo}>`, true);
    return this.chamar(metodo, envelope, req.homologacao, `${metodo}Result`);
  }

  async cancelar(req: CancelarNfseRequest): Promise<NfseResultado> {
    const corpo = `<eis:ChaveAutenticacao>${xmlEscape(req.chaveAutenticacao)}</eis:ChaveAutenticacao>
        <eis:Homologacao>${req.homologacao}</eis:Homologacao>
        <eis:NumeroNota>${xmlEscape(req.numeroNota)}</eis:NumeroNota>
        <eis:Motivo>${xmlEscape(req.motivoCancelamento)}</eis:Motivo>`;
    const envelope = this.envelopeComNs(`<tem:Cancelar><tem:request>${corpo}</tem:request></tem:Cancelar>`, false);
    return this.chamar('Cancelar', envelope, req.homologacao, 'CancelarResult');
  }

  async consultarNotaCompleta(req: ConsultarNfseRequest): Promise<NfseResultado> {
    const inicial = req.numeroNotaInicial ?? '';
    const corpo = `<eis:ChaveAutenticacao>${xmlEscape(req.chaveAutenticacao)}</eis:ChaveAutenticacao>
        <eis:NumeroNotaInicial>${xmlEscape(inicial)}</eis:NumeroNotaInicial>
        <eis:NumeroNotaFinal>${xmlEscape(req.numeroNotaFinal ?? inicial)}</eis:NumeroNotaFinal>`;
    const envelope = this.envelopeComNs(`<tem:ConsultarNotaCompleta><tem:request>${corpo}</tem:request></tem:ConsultarNotaCompleta>`, false);
    return this.chamar('ConsultarNotaCompleta', envelope, req.homologacao, 'ConsultarNotaCompletaResult');
  }

  async rtcPesquisarNbsClassTrib(
    chaveAutenticacao: string, homologacao: boolean, atividade: string,
  ): Promise<RtcPesquisaNbsClassTrib[]> {
    const corpo = `<eis:ChaveAutenticacao>${xmlEscape(chaveAutenticacao)}</eis:ChaveAutenticacao>
        <eis:CodigoAtividade>${xmlEscape(atividade)}</eis:CodigoAtividade>`;
    const envelope = this.envelopeComNs(`<tem:RTC_PesquisarNbsClassTrib><tem:request>${corpo}</tem:request></tem:RTC_PesquisarNbsClassTrib>`, false);
    const resposta = await this.enviar('RTC_PesquisarNbsClassTrib', envelope, homologacao);
    // Resposta em lista: cada ocorrência de <CodigoNBS>/<ClassTrib>/<Descricao> — parse simples por regex global.
    const nbs = [...resposta.matchAll(/<[\w:]*CodigoNBS[^>]*>([^<]*)</g)].map((m) => m[1]);
    const classTrib = [...resposta.matchAll(/<[\w:]*ClassTrib[^>]*>([^<]*)</g)].map((m) => m[1]);
    const descricao = [...resposta.matchAll(/<[\w:]*Descricao[^>]*>([^<]*)</g)].map((m) => m[1]);
    return nbs.map((codigoNbs, i) => ({ codigoNbs: codigoNbs ?? '', classTrib: classTrib[i] ?? '', descricao: descricao[i] ?? '' }));
  }

  private envelopeComNs(corpo: string, comEis1Eis2: boolean): string {
    const declaracoes = comEis1Eis2
      ? `xmlns:eis1="${NS.eis1}" xmlns:eis2="${NS.eis2}"`
      : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${NS.tem}" xmlns:eis="${NS.eis}" ${declaracoes}>
  <soapenv:Header/>
  <soapenv:Body>${corpo}</soapenv:Body>
</soapenv:Envelope>`;
  }

  /** POST HTTPS com SOAPAction + timeout; lança NfseTransporteError em falha de rede/timeout/5xx. */
  private async enviar(metodo: string, envelope: string, homologacao: boolean): Promise<string> {
    const timeoutMs = parseInt(process.env['EISS_TIMEOUT_MS'] ?? '30000', 10);
    let resposta: Response;
    try {
      resposta = await fetch(endpoint(homologacao), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `http://tempuri.org/INotaFiscalEletronica/${metodo}`,
        },
        body: envelope,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new NfseTransporteError(`Falha de transporte EISS (${metodo}): ${(e as Error).message}`);
    }
    if (resposta.status >= 500) {
      throw new NfseTransporteError(`Falha de transporte EISS (${metodo}): HTTP ${resposta.status}`);
    }
    return resposta.text();
  }

  private async chamar(
    metodo: string, envelope: string, homologacao: boolean, tagResultado: string,
  ): Promise<NfseResultado> {
    const bruto = await this.enviar(metodo, envelope, homologacao);
    const erroTxt = tag(bruto, 'Erro');
    const erro = erroTxt === 'true';
    if (erro) {
      this.logger.warn(`EISS retornou Erro=true em ${metodo}: ${tag(bruto, 'MensagemErro')}`);
    }
    return {
      erro,
      mensagemErro: erro ? (tag(bruto, 'MensagemErro') ?? 'Erro de negócio EISS') : undefined,
      numeroNota: tag(bruto, 'Numero'),
      codigoVerificacao: tag(bruto, 'Autenticador'),
      linkNota: tag(bruto, 'Link'),
      identificadorEco: tag(bruto, 'Identificador'),
      raw: redigirSegredos({ tagResultado, xml: bruto }),
    };
  }
}
