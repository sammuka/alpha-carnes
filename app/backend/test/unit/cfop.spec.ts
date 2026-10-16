import { normalizarCfop, validarCfop } from '../../src/common/validators/cfop';
import { normalizarCest, validarCest } from '../../src/common/validators/cest';
import { validarNcm, normalizarNcm } from '../../src/common/validators/ncm';

describe('CFOP — formato de 4 dígitos', () => {
  it('5101 válido', () => {
    expect(normalizarCfop('5101')).toBe('5101');
    expect(validarCfop('5101')).toBe(true);
  });

  it('ABC inválido', () => {
    expect(validarCfop('ABC')).toBe(false);
    expect(validarCfop('51A1')).toBe(false);
  });
});

describe('CFOP/CEST/NCM — lixo não é normalizado para válido (M3)', () => {
  it.each(['abc1102xyz', '11/02', '11a02'])('CFOP %s é recusado', (valor) => {
    expect(validarCfop(normalizarCfop(valor))).toBe(false);
  });

  it('CFOP aceita máscara 1.102 e 1-102', () => {
    expect(validarCfop(normalizarCfop('1.102'))).toBe(true);
    expect(validarCfop(normalizarCfop('1-102'))).toBe(true);
  });

  it.each(['abc1708700x', '17a0870'])('CEST %s é recusado', (valor) => {
    expect(validarCest(normalizarCest(valor))).toBe(false);
  });

  it('CEST aceita máscara 17.087.00', () => {
    expect(validarCest(normalizarCest('17.087.00'))).toBe(true);
  });

  it.each(['51\n02', '51\t02', '51 02'])('CFOP com espaço não comum %j é recusado', (valor) => {
    expect(validarCfop(normalizarCfop(valor))).toBe(false);
  });

  it('CEST e NCM com quebra de linha ou tabulação são recusados', () => {
    expect(validarCest(normalizarCest('17087\n00'))).toBe(false);
    expect(validarNcm(normalizarNcm('0201\t3000'))).toBe(false);
    expect(validarNcm(normalizarNcm('0201 30 00'))).toBe(true);
  });

  it('NCM com letras é recusado', () => {
    expect(validarNcm(normalizarNcm('abc02013000x'))).toBe(false);
  });
});
