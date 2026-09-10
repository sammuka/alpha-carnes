import { formatarPercentualDuasCasas, formatarPrecoBr } from '../src/lib/formatacao-preco';

describe('formatacao-preco', () => {
  it('formata valores monetários no padrão brasileiro com R$', () => {
    expect(formatarPrecoBr('33.00')).toBe('R$ 33,00');
    expect(formatarPrecoBr('31.00')).toBe('R$ 31,00');
    expect(formatarPrecoBr('-2.00')).toBe('-R$ 2,00');
    expect(formatarPrecoBr('18.50')).toBe('R$ 18,50');
    expect(formatarPrecoBr(null)).toBe('—');
  });

  it('percentual fica com duas casas depois do ponto', () => {
    expect(formatarPercentualDuasCasas('-6.0606')).toBe('-6.06');
    expect(formatarPercentualDuasCasas('-8.1081')).toBe('-8.11');
    expect(formatarPercentualDuasCasas('20.0000')).toBe('20.00');
    expect(formatarPercentualDuasCasas(null)).toBe('—');
  });
});
