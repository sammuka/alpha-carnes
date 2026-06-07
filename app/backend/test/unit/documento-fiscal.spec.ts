import {
  normalizarDocumento,
  validarCNPJ,
  validarCPF,
  validarDocumentoFiscal,
} from '../../src/common/validators/documento-fiscal';

describe('Validação de documento fiscal', () => {
  describe('normalizarDocumento', () => {
    it('remove máscara e mantém apenas dígitos', () => {
      expect(normalizarDocumento('11.222.333/0001-81')).toBe('11222333000181');
      expect(normalizarDocumento('529.982.247-25')).toBe('52998224725');
    });
  });

  describe('validarCPF', () => {
    it('aceita CPF válido (com e sem máscara)', () => {
      expect(validarCPF('529.982.247-25')).toBe(true);
      expect(validarCPF('52998224725')).toBe(true);
    });

    it('rejeita CPF com dígito verificador inválido', () => {
      expect(validarCPF('52998224726')).toBe(false);
      expect(validarCPF('12345678900')).toBe(false);
    });

    it('rejeita sequências repetidas e tamanho errado', () => {
      expect(validarCPF('00000000000')).toBe(false);
      expect(validarCPF('111')).toBe(false);
    });
  });

  describe('validarCNPJ', () => {
    it('aceita CNPJ válido (com e sem máscara)', () => {
      expect(validarCNPJ('11.222.333/0001-81')).toBe(true);
      expect(validarCNPJ('11222333000181')).toBe(true);
    });

    it('rejeita CNPJ com dígito verificador inválido', () => {
      expect(validarCNPJ('11222333000182')).toBe(false);
      expect(validarCNPJ('11111111111111')).toBe(false);
    });

    it('rejeita tamanho errado', () => {
      expect(validarCNPJ('1122233300018')).toBe(false);
    });
  });

  describe('validarDocumentoFiscal', () => {
    it('aceita CPF (11 dígitos) e CNPJ (14 dígitos) válidos', () => {
      expect(validarDocumentoFiscal('529.982.247-25')).toBe(true);
      expect(validarDocumentoFiscal('11.222.333/0001-81')).toBe(true);
    });

    it('rejeita documentos inválidos ou de tamanho não suportado', () => {
      expect(validarDocumentoFiscal('123')).toBe(false);
      expect(validarDocumentoFiscal('52998224726')).toBe(false);
      expect(validarDocumentoFiscal('11222333000182')).toBe(false);
    });
  });
});
