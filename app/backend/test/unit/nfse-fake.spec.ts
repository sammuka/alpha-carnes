import { FakeNfseGateway } from '../../src/integracoes/nfse/fake-nfse.gateway';
import { NfseTransporteError } from '../../src/integracoes/nfse/nfse.types';

// Request mínimo — os campos obrigatórios apenas para tipagem correta
const reqBase = {
  chaveAutenticacao: 'fake-chave',
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
  modeloFiscal: 'padrao' as const,
};

const cancelarReqBase = {
  chaveAutenticacao: 'fake-chave',
  homologacao: true,
  numeroNota: 'FAKE-001',
  motivoCancelamento: 'Erro operacional',
};

const consultarReqBase = {
  chaveAutenticacao: 'fake-chave',
  homologacao: true,
  numeroNotaInicial: 'FAKE-001',
  numeroNotaFinal: 'FAKE-001',
};

describe('FakeNfseGateway', () => {
  let gateway: FakeNfseGateway;

  beforeEach(() => {
    gateway = new FakeNfseGateway();
  });

  // ── emitir ──────────────────────────────────────────────────────────────────

  describe('emitir', () => {
    it('sucesso → erro=false, numeroNota e codigoVerificacao presentes', async () => {
      gateway.definirCenario('sucesso');
      const result = await gateway.emitir(reqBase);
      expect(result.erro).toBe(false);
      expect(result.numeroNota).toBeTruthy();
      expect(result.codigoVerificacao).toBeTruthy();
    });

    it('erro_negocio → erro=true, mensagem presente, NÃO lança exceção', async () => {
      gateway.definirCenario('erro_negocio');
      // Não deve lançar — deve retornar resultado com erro=true
      const result = await gateway.emitir(reqBase);
      expect(result.erro).toBe(true);
      expect(result.mensagemErro).toBeTruthy();
    });

    it('timeout → lança NfseTransporteError com falhaRetriavel=true', async () => {
      gateway.definirCenario('timeout');
      await expect(gateway.emitir(reqBase)).rejects.toBeInstanceOf(NfseTransporteError);
      try {
        await gateway.emitir(reqBase);
      } catch (e) {
        expect((e as NfseTransporteError).falhaRetriavel).toBe(true);
        expect((e as NfseTransporteError).message).toMatch(/timeout/i);
      }
    });

    it('http500 → lança NfseTransporteError com falhaRetriavel=true', async () => {
      gateway.definirCenario('http500');
      await expect(gateway.emitir(reqBase)).rejects.toBeInstanceOf(NfseTransporteError);
      try {
        await gateway.emitir(reqBase);
      } catch (e) {
        expect((e as NfseTransporteError).falhaRetriavel).toBe(true);
        expect((e as NfseTransporteError).message).toMatch(/500/i);
      }
    });
  });

  // ── cancelar ─────────────────────────────────────────────────────────────────

  describe('cancelar', () => {
    it('sucesso → erro=false', async () => {
      gateway.definirCenario('sucesso');
      const result = await gateway.cancelar(cancelarReqBase);
      expect(result.erro).toBe(false);
    });

    it('erro_negocio → erro=true, não lança exceção', async () => {
      gateway.definirCenario('erro_negocio');
      const result = await gateway.cancelar(cancelarReqBase);
      expect(result.erro).toBe(true);
      expect(result.mensagemErro).toBeTruthy();
    });

    it('timeout → lança NfseTransporteError', async () => {
      gateway.definirCenario('timeout');
      await expect(gateway.cancelar(cancelarReqBase)).rejects.toBeInstanceOf(NfseTransporteError);
    });
  });

  // ── consultarNotaCompleta ──────────────────────────────────────────────────

  describe('consultarNotaCompleta', () => {
    it('quando definirConsultarAchaNota(true) → retorna nota encontrada (erro=false)', async () => {
      gateway.definirConsultarAchaNota(true);
      const result = await gateway.consultarNotaCompleta(consultarReqBase);
      expect(result.erro).toBe(false);
      expect(result.numeroNota).toBeTruthy();
    });

    it('quando definirConsultarAchaNota(false) → retorna não encontrada (erro=true)', async () => {
      gateway.definirConsultarAchaNota(false);
      const result = await gateway.consultarNotaCompleta(consultarReqBase);
      expect(result.erro).toBe(true);
      expect(result.mensagemErro).toBeTruthy();
    });

    it('NUNCA lança exceção — nem em cenário de timeout (consulta é segura)', async () => {
      gateway.definirCenario('timeout');
      // consultarNotaCompleta não usa cenario para lançar — sempre retorna
      await expect(gateway.consultarNotaCompleta(consultarReqBase)).resolves.toBeDefined();
    });

    it('NUNCA lança exceção — nem em cenário de http500', async () => {
      gateway.definirCenario('http500');
      await expect(gateway.consultarNotaCompleta(consultarReqBase)).resolves.toBeDefined();
    });
  });

  // ── transições ────────────────────────────────────────────────────────────

  describe('transições', () => {
    it('cenário pode ser alterado entre chamadas', async () => {
      gateway.definirCenario('sucesso');
      const r1 = await gateway.emitir(reqBase);
      expect(r1.erro).toBe(false);

      gateway.definirCenario('erro_negocio');
      const r2 = await gateway.emitir(reqBase);
      expect(r2.erro).toBe(true);

      gateway.definirCenario('sucesso');
      const r3 = await gateway.emitir(reqBase);
      expect(r3.erro).toBe(false);
    });

    it('definirConsultarAchaNota alterna entre encontrar e não encontrar', async () => {
      gateway.definirConsultarAchaNota(true);
      expect((await gateway.consultarNotaCompleta(consultarReqBase)).erro).toBe(false);

      gateway.definirConsultarAchaNota(false);
      expect((await gateway.consultarNotaCompleta(consultarReqBase)).erro).toBe(true);
    });

    it('cenário padrão ao instanciar é sucesso', async () => {
      const fresh = new FakeNfseGateway();
      const result = await fresh.emitir(reqBase);
      expect(result.erro).toBe(false);
    });
  });
});
