import type { EmitirNfseRequest, PessoaDto } from './nfse.types';

/**
 * Monta o payload EISS (EmitirNfseRequest) a partir dos dados do pedido e do faturamento.
 * Função pura — sem I/O, sem efeitos colaterais, totalmente testável.
 *
 * ATENÇÃO: ChaveAutenticacao NÃO é incluída aqui — é injetada pelo adapter no momento
 * do envio. Isso garante que o payload pode ser construído, validado e logado (via
 * redigirSegredos) sem vazar o token em nenhum momento.
 */
export interface DadosPedidoParaNfse {
  pedidoId: string;
  cliente: {
    razaoSocial: string;
    /** CNPJ ou CPF — apenas dígitos ou com pontuação (normalizado internamente). */
    documentoFiscal: string;
    dadosFiscaisJson: Record<string, unknown>;
    dadosContatoJson: Record<string, unknown>;
  };
  /** Descrição legível dos itens, ex: "Dianteiro 2un, Central 1un". */
  itensDescricao: string;
  /** Peso total NUMERIC(10,3) como string, ex: "125.500". */
  pesoTotalKg: string;
  /** Valor do serviço NUMERIC(15,2) como string, ex: "1500.00". */
  valor: string;
}

export interface DadosFiscaisEmissao {
  /** faturamento.codigo_servico_atividade — tag <Atividade>, ex: "14.01". */
  atividade: string;
  /** faturamento.simples_nacional. */
  simplesNacional: boolean;
  /** faturamento.modelo_fiscal. */
  modeloFiscal: 'padrao' | 'rtc';
  /** Obrigatórios apenas quando modeloFiscal='rtc'. */
  rtc?: { classTrib: string; codigoNbs: string; indOperacao: string; idLocalIncidencia: string };
}

export interface DadosPrestador {
  razaoSocial: string;
  cnpj: string;
  inscricaoMunicipal: string;
  email?: string;
}

/**
 * Monta o EmitirNfseRequest sem chaveAutenticacao.
 * O campo chaveAutenticacao é omitido intencionalmente — injete-o apenas no adapter,
 * imediatamente antes do envio SOAP, e nunca persista o objeto completo.
 */
export function montarPayloadEiss(
  pedido: DadosPedidoParaNfse,
  fiscal: DadosFiscaisEmissao,
  homologacao: boolean,
  numeroRps: string,
  serieRps = 'A',
): Omit<EmitirNfseRequest, 'chaveAutenticacao'> {
  const docCliente = pedido.cliente.documentoFiscal.replace(/\D/g, '');
  const fiscalCliente = pedido.cliente.dadosFiscaisJson as Record<string, string | undefined>;
  const contato = pedido.cliente.dadosContatoJson as Record<string, string | undefined>;

  const tomador: PessoaDto = {
    nome: pedido.cliente.razaoSocial,
    ...(docCliente.length === 14 ? { cnpj: docCliente } : { cpf: docCliente }),
    inscricaoMunicipal: fiscalCliente['inscricao_municipal'],
    email: contato['email'] as string | undefined,
    endereco: {
      logradouro: fiscalCliente['logradouro'] as string | undefined,
      numero: fiscalCliente['numero'] as string | undefined,
      complemento: fiscalCliente['complemento'] as string | undefined,
      bairro: fiscalCliente['bairro'] as string | undefined,
      cidade: fiscalCliente['cidade'] as string | undefined,
      codigoCidadeIBGE: fiscalCliente['codigo_ibge'] as string | undefined,
      estado: fiscalCliente['uf'] as string | undefined,
      cep: (fiscalCliente['cep'] as string | undefined)?.replace(/\D/g, ''),
      pais: 'BRASIL',
    },
  };

  const informacoesAdicionais =
    `Distribuição de carnes — Pedido ${pedido.pedidoId} — ` +
    `${pedido.itensDescricao} — ${pedido.pesoTotalKg}kg`;

  const agora = new Date();

  return {
    homologacao,
    identificador: pedido.pedidoId,
    nrExercicioReferencia: agora.getFullYear(),
    nrMesReferencia: agora.getMonth() + 1,
    atividade: fiscal.atividade,
    aliquota: '0.00',
    valor: pedido.valor,
    valorDeducao: '0',
    informacoesAdicionais: informacoesAdicionais.slice(0, 2300),
    notificarTomadorPorEmail: true,
    substituicaoTributaria: false,
    semIncidenciaISS: false,
    simplesNacional: fiscal.simplesNacional,
    tomadorEstrangeiro: false,
    deduzirRepasse: false,
    tomador,
    modeloFiscal: fiscal.modeloFiscal,
    ...(fiscal.modeloFiscal === 'rtc' && fiscal.rtc
      ? {
          rtcClassTrib: fiscal.rtc.classTrib,
          rtcCodigoNbs: fiscal.rtc.codigoNbs,
          rtcIndOperacao: fiscal.rtc.indOperacao,
          rtcIdLocalIncidencia: fiscal.rtc.idLocalIncidencia,
        }
      : {}),
    numeroRps,
    serieRps,
    dataRps: agora.toISOString(),
  };
}

/**
 * Redige segredos de um objeto payload antes de persistir ou logar.
 * Remove ChaveAutenticacao e quaisquer variações de nomenclatura sensível.
 * Recursivo — percorre objetos e arrays aninhados.
 */
export function redigirSegredos(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map(redigirSegredos);

  const CAMPOS_SENSIVEIS = new Set([
    'chaveAutenticacao',
    'ChaveAutenticacao',
    'chave_autenticacao',
  ]);
  const resultado: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    resultado[k] = CAMPOS_SENSIVEIS.has(k) ? '***REDACTED***' : redigirSegredos(v);
  }
  return resultado;
}
