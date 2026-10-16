import {
  normalizarCnpj,
  raizCnpj,
  validarCnpjAlfanumerico,
} from '../../src/common/validators/cnpj-alfanumerico';
import { validarCNPJ } from '../../src/common/validators/documento-fiscal';

describe('CNPJ alfanumérico (E01-T01, D3)', () => {
  describe('normalizarCnpj', () => {
    it('remove ponto, barra, hífen e espaços e converte para maiúsculas', () => {
      expect(normalizarCnpj(' 12.abc.345/01de-35 ')).toBe('12ABC34501DE35');
      expect(normalizarCnpj('11.222.333/0001-81')).toBe('11222333000181');
    });
  });

  describe('validarCnpjAlfanumerico', () => {
    it('aceita o exemplo oficial da RFB (manual-dv-cnpj.pdf: 12.ABC.345/01DE-35)', () => {
      expect(validarCnpjAlfanumerico('12ABC34501DE35')).toBe(true);
      expect(validarCnpjAlfanumerico('12.ABC.345/01DE-35')).toBe(true);
    });

    it('aceita minúsculas (normaliza antes de validar)', () => {
      expect(validarCnpjAlfanumerico('12.abc.345/01de-35')).toBe(true);
    });

    it('rejeita DV errado no exemplo oficial', () => {
      expect(validarCnpjAlfanumerico('12ABC34501DE36')).toBe(false);
      expect(validarCnpjAlfanumerico('12ABC34501DE45')).toBe(false);
    });

    it('aceita vetores numéricos válidos, coerentes com o validador numérico legado', () => {
      for (const cnpj of ['11222333000181', '11444777000161', '00000000000191']) {
        expect(validarCNPJ(cnpj)).toBe(true);
        expect(validarCnpjAlfanumerico(cnpj)).toBe(true);
      }
    });

    it('rejeita vetores numéricos com DV inválido', () => {
      expect(validarCnpjAlfanumerico('11222333000182')).toBe(false);
      expect(validarCnpjAlfanumerico('11222333000191')).toBe(false);
    });

    it('rejeita 14 caracteres iguais', () => {
      expect(validarCnpjAlfanumerico('00000000000000')).toBe(false);
      expect(validarCnpjAlfanumerico('11111111111111')).toBe(false);
    });

    it('rejeita tamanho errado, letra nos DV e caracteres fora de [0-9A-Z]', () => {
      expect(validarCnpjAlfanumerico('12ABC34501DE3')).toBe(false);
      expect(validarCnpjAlfanumerico('12ABC34501DE355')).toBe(false);
      expect(validarCnpjAlfanumerico('12ABC34501DE3A')).toBe(false);
      expect(validarCnpjAlfanumerico('12ABC34501D#35')).toBe(false);
      expect(validarCnpjAlfanumerico('')).toBe(false);
    });
  });

  describe('raizCnpj', () => {
    it('devolve os 8 primeiros caracteres normalizados', () => {
      expect(raizCnpj('12.abc.345/01de-35')).toBe('12ABC345');
      expect(raizCnpj('11222333000181')).toBe('11222333');
    });
  });
});
