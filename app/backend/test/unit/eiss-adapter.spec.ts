import { EissClientAdapter } from '../../src/integracoes/nfse/eiss-client.adapter';
import { NfseTransporteError, type EmitirNfseRequest } from '../../src/integracoes/nfse/nfse.types';

const REQ_FAKE: EmitirNfseRequest = {
  chaveAutenticacao: 'chave-secreta-eiss',
  homologacao: true,
  identificador: 'PED-001',
  nrExercicioReferencia: 2026,
  nrMesReferencia: 8,
  atividade: '14.01',
  aliquota: '0.00',
  valor: '1500.00',
  valorDeducao: '0',
  informacoesAdicionais: 'Distribuição de carnes',
  notificarTomadorPorEmail: true,
  substituicaoTributaria: false,
  semIncidenciaISS: false,
  simplesNacional: false,
  tomadorEstrangeiro: false,
  deduzirRepasse: false,
  tomador: { nome: 'Cliente Teste', cnpj: '12345678000190' },
  modeloFiscal: 'padrao',
};

describe('EissClientAdapter', () => {
  let adapter: EissClientAdapter;

  beforeEach(() => {
    process.env['EISS_ENDPOINT_HML'] = 'https://hml.exemplo/EissnfeWebApp.svc';
    adapter = new EissClientAdapter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('DoD 10.2a Erro=true nao lanca', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      status: 200,
      text: async () => '<EmitirResponse><EmitirResult><a:Erro>true</a:Erro><a:MensagemErro>CNPJ inválido</a:MensagemErro></EmitirResult></EmitirResponse>',
    } as Response);
    const resultado = await adapter.emitir(REQ_FAKE);
    expect(resultado.erro).toBe(true);
    expect(resultado.mensagemErro).toBe('CNPJ inválido');
  });

  it('timeout de transporte lanca NfseTransporteError', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));
    await expect(adapter.emitir(REQ_FAKE)).rejects.toThrow(NfseTransporteError);
  });

  it('HTTP 500 lanca NfseTransporteError', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ status: 500, text: async () => '' } as Response);
    await expect(adapter.emitir(REQ_FAKE)).rejects.toThrow(NfseTransporteError);
  });

  it('redige ChaveAutenticacao do raw devolvido', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      status: 200,
      text: async () => `<EmitirResponse><EmitirResult><a:Erro>false</a:Erro><a:NotaFiscalGerada><b:Numero>1</b:Numero></a:NotaFiscalGerada></EmitirResult></EmitirResponse>`,
    } as Response);
    const resultado = await adapter.emitir(REQ_FAKE);
    expect(JSON.stringify(resultado.raw)).not.toContain(REQ_FAKE.chaveAutenticacao);
  });

  it('sucesso mapeia Numero/Autenticador/Link/Identificador', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      status: 200,
      text: async () => `<EmitirResponse><EmitirResult><a:Erro>false</a:Erro><a:NotaFiscalGerada><b:Numero>123</b:Numero><b:Autenticador>ABC123</b:Autenticador><b:Link>http://eiss/nota/123</b:Link><b:Identificador>PED-001</b:Identificador></a:NotaFiscalGerada></EmitirResult></EmitirResponse>`,
    } as Response);
    const resultado = await adapter.emitir(REQ_FAKE);
    expect(resultado.erro).toBe(false);
    expect(resultado.numeroNota).toBe('123');
    expect(resultado.codigoVerificacao).toBe('ABC123');
    expect(resultado.linkNota).toBe('http://eiss/nota/123');
    expect(resultado.identificadorEco).toBe('PED-001');
  });

  it('lanca erro quando endpoint HML nao configurado', async () => {
    delete process.env['EISS_ENDPOINT_HML'];
    jest.spyOn(global, 'fetch');
    await expect(adapter.emitir(REQ_FAKE)).rejects.toThrow(/EISS_ENDPOINT_HML/);
  });

  it('envia envelope RTC quando modeloFiscal=rtc', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      status: 200,
      text: async () => '<EmitirResponse><EmitirResult><a:Erro>false</a:Erro></EmitirResult></EmitirResponse>',
    } as Response);
    await adapter.emitir({
      ...REQ_FAKE,
      modeloFiscal: 'rtc',
      rtcClassTrib: '000001',
      rtcCodigoNbs: '111041000',
      rtcIndOperacao: '000001',
      rtcIdLocalIncidencia: '1',
    });
    const [, options] = fetchMock.mock.calls[0]!;
    const body = String((options as RequestInit).body);
    expect(body).toContain('RTC_EmitirNFE');
    expect(body).toContain('NotaFiscal_RTC');
    expect(body).toContain('<eis1:ClassTrib>000001</eis1:ClassTrib>');
  });
});
