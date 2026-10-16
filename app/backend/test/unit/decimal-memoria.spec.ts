import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calcularMemoria, formatarDinheiroPtBr, normalizarDinheiro, rotuloCompetencia } from '../../src/modules/erp/fiscal/simulacoes/decimal-memoria';

describe('decimal-memoria', () => {
  it('10,05 com alíquota 12,00 gera ICMS 1.21', () => {
    expect(normalizarDinheiro('10,05')).toBe('10.05');
    expect(normalizarDinheiro('R$ 1.000,00')).toBe('1000.00');
    expect(normalizarDinheiro('10,005')).toBeNull();
    expect(normalizarDinheiro('1e2')).toBeNull();
    const icms = calcularMemoria({ valor: '10.05', desconto: '0.00', pRedBc: '0.0000', pIcms: '0.1200' });
    expect(icms).toEqual({ valorLiquido: '10.05', baseTributavel: '10.05', icms: '1.21', baseDifereBruto: false });
    const reduzida = calcularMemoria({ valor: '1000.00', desconto: '0.00', pRedBc: '0.4167', pIcms: '0.1200' });
    expect(reduzida).toEqual({ valorLiquido: '1000.00', baseTributavel: '583.30', icms: '70.00', baseDifereBruto: true });
    const desconto = calcularMemoria({ valor: '1000.00', desconto: '100.00', pRedBc: '0.0000', pIcms: '0.1200' });
    expect(desconto).toMatchObject({ valorLiquido: '900.00', baseTributavel: '900.00', icms: '108.00', baseDifereBruto: true });
    const descontoEReducao = calcularMemoria({ valor: '1000.00', desconto: '100.00', pRedBc: '0.4167', pIcms: '0.1200' });
    expect(descontoEReducao).toEqual({ valorLiquido: '900.00', baseTributavel: '524.97', icms: '63.00', baseDifereBruto: true });
    expect(calcularMemoria({ valor: '1000.00', desconto: '1000.01', pRedBc: '0.0000', pIcms: '0.1200' })).toBeNull();
    expect(formatarDinheiroPtBr('583.30')).toBe('583,30');
    expect(formatarDinheiroPtBr('1000.00')).toBe('1.000,00');
    expect(rotuloCompetencia('2026-10')).toBe('Outubro de 2026');
  });

  it('fonte sem float', () => {
    const fonte = readFileSync(join(__dirname, '../../src/modules/erp/fiscal/simulacoes/decimal-memoria.ts'), 'utf8');
    expect(fonte).not.toMatch(/parseFloat|parseInt|Number\(|Math\./);
  });
});
