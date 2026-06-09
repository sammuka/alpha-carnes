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
  /** Alíquota ISS decimal string; padrão "0.0500" (5% — Osasco/SP). */
  aliquota?: string;
  /** Código CNAE/EISS do serviço; padrão "04014". */
  codigoServico?: string;
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
  prestador: DadosPrestador,
  homologacao: boolean,
  numeroRps: string,
  serieRps = 'A',
): Omit<EmitirNfseRequest, 'chaveAutenticacao'> {
  const docCliente = pedido.cliente.documentoFiscal.replace(/\D/g, '');
  const fiscal = pedido.cliente.dadosFiscaisJson as Record<string, string | undefined>;
  const contato = pedido.cliente.dadosContatoJson as Record<string, string | undefined>;

  const tomador: PessoaDto = {
    nome: pedido.cliente.razaoSocial,
    ...(docCliente.length === 14 ? { cnpj: docCliente } : { cpf: docCliente }),
    inscricaoMunicipal: fiscal['inscricao_municipal'],
    email: contato['email'] as string | undefined,
    endereco: {
      logradouro: fiscal['logradouro'] as string | undefined,
      numero: fiscal['numero'] as string | undefined,
      complemento: fiscal['complemento'] as string | undefined,
      bairro: fiscal['bairro'] as string | undefined,
      cidade: fiscal['cidade'] as string | undefined,
      codigoCidadeIBGE: fiscal['codigo_ibge'] as string | undefined,
      estado: fiscal['uf'] as string | undefined,
      cep: (fiscal['cep'] as string | undefined)?.replace(/\D/g, ''),
      pais: 'BRASIL',
    },
  };

  const prestadorDto: PessoaDto = {
    nome: prestador.razaoSocial,
    cnpj: prestador.cnpj.replace(/\D/g, ''),
    inscricaoMunicipal: prestador.inscricaoMunicipal,
    email: prestador.email,
  };

  const descricaoServico =
    `Distribuição de carnes — Pedido ${pedido.pedidoId} — ` +
    `${pedido.itensDescricao} — ${pedido.pesoTotalKg}kg`;

  return {
    homologacao,
    aliquota: pedido.aliquota ?? '0.0500',
    valor: pedido.valor,
    valorDeducao: '0',
    descricaoServico: descricaoServico.slice(0, 2000),
    codigoServico: pedido.codigoServico ?? '04014',
    notificarTomadorPorEmail: true,
    substituicaoTributaria: false,
    tomador,
    prestador: prestadorDto,
    numeroRps,
    serieRps,
    dataRps: new Date().toISOString(),
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
