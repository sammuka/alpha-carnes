// Contrato único do gateway NFS-e EISS (ADR-011 / RA-03 / RA-05). O backend SEMPRE
// depende destas interfaces via DI token — nunca do adapter concreto. Isso isola o
// gateway externo e torna o caminho de falha testável com o fake determinístico.

/** DI Token — injetar sempre por este símbolo, nunca pela classe concreta. */
export const NFSE_GATEWAY = Symbol('NFSE_GATEWAY');

/**
 * Exceção de transporte: falha de infra (timeout, HTTP 500, connection refused).
 * Diferencia erros RETRIÁVEIS de erros de negócio retornados pelo EISS.
 * O campo falhaRetriavel=true sinaliza para o retry automático no serviço de faturamento.
 */
export class NfseTransporteError extends Error {
  readonly falhaRetriavel = true;
  constructor(message: string) {
    super(message);
    this.name = 'NfseTransporteError';
  }
}

/**
 * Resultado normalizado de qualquer operação EISS.
 * ATENÇÃO: HTTP 200 com erro=true é FALHA DE NEGÓCIO — não gravar sucesso sem confirmar erro=false.
 */
export interface NfseResultado {
  erro: boolean;
  mensagemErro?: string;
  numeroNota?: string;
  codigoVerificacao?: string;
  linkNota?: string;
  /** Eco do EmitirNfseRequest.identificador — usado na reconciliação por Identificador+período. */
  identificadorEco?: string;
  /** Resposta bruta do EISS — ChaveAutenticacao já redactada por redigirSegredos(). */
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface EmitirNfseRequest {
  /** Token EISS — NUNCA logar, persistir ou serializar este campo! */
  chaveAutenticacao: string;
  homologacao: boolean;
  /** Rastreio ERP↔EISS — id do pedido de venda, ecoado no response (NotaFiscalGerada.Identificador). */
  identificador: string;
  nrExercicioReferencia: number;
  nrMesReferencia: number;
  /** Tag <Atividade> — código LC 404/2022, formato "00.00". Substitui codigoServico. */
  atividade: string;
  aliquota: string; // decimal string, ex: "0.00" para não-Simples
  valor: string; // decimal string, ex: "1500.00"
  valorDeducao: string;
  /** Tag <InformacoesAdicionais> — máx. 2300 chars; "|" separa parágrafos. Substitui descricaoServico. */
  informacoesAdicionais: string;
  notificarTomadorPorEmail: boolean;
  substituicaoTributaria: boolean;
  semIncidenciaISS: boolean;
  simplesNacional: boolean;
  tomadorEstrangeiro: boolean;
  deduzirRepasse: boolean;
  tomador: PessoaDto;
  /** Modelo fiscal usado — 'rtc' aciona RTC_EmitirNFE + campos rtc*. */
  modeloFiscal: 'padrao' | 'rtc';
  /** Obrigatórios apenas quando modeloFiscal='rtc' (D10.2). */
  rtcClassTrib?: string;
  rtcCodigoNbs?: string;
  rtcIndOperacao?: string;
  rtcIdLocalIncidencia?: string;
  numeroRps?: string;
  serieRps?: string;
  dataRps?: string;
}

export interface CancelarNfseRequest {
  /** Token EISS — NUNCA logar, persistir ou serializar este campo! */
  chaveAutenticacao: string;
  homologacao: boolean;
  numeroNota: string;
  motivoCancelamento: string;
}

export interface ConsultarNfseRequest {
  /** Token EISS — NUNCA logar, persistir ou serializar este campo! */
  chaveAutenticacao: string;
  homologacao: boolean;
  /** Consulta por intervalo — número único usa numeroNotaInicial === numeroNotaFinal. */
  numeroNotaInicial?: string;
  numeroNotaFinal?: string;
  /** Fallback de reconciliação em timeout de emissão (D10.1). */
  identificador?: string;
}

// ---------------------------------------------------------------------------
// DTOs auxiliares
// ---------------------------------------------------------------------------

export interface PessoaDto {
  nome: string;
  cnpj?: string;
  cpf?: string;
  inscricaoMunicipal?: string;
  email?: string;
  ddd?: string;
  telefone?: string;
  endereco?: EnderecoDto;
}

export interface EnderecoDto {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  codigoCidadeIBGE?: string;
  estado?: string;
  cep?: string;
  pais?: string;
}

export interface RtcPesquisaNbsClassTrib {
  codigoNbs: string;
  classTrib: string;
  descricao: string;
}

// ---------------------------------------------------------------------------
// Porta (interface)
// ---------------------------------------------------------------------------

/** Gateway de emissão NFS-e via EISS Osasco-SP. */
export interface NfseGateway {
  emitir(req: EmitirNfseRequest): Promise<NfseResultado>;
  cancelar(req: CancelarNfseRequest): Promise<NfseResultado>;
  consultarNotaCompleta(req: ConsultarNfseRequest): Promise<NfseResultado>;
  /** D10.2 — utilitário de configuração (endpoint admin, sem tela nesta onda). */
  rtcPesquisarNbsClassTrib(chaveAutenticacao: string, homologacao: boolean, atividade: string): Promise<RtcPesquisaNbsClassTrib[]>;
}
