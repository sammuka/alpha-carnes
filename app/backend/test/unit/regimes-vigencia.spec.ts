import { classificarSobreposicao, diaAnterior, type IntervaloRegime } from '../../src/modules/erp/fiscal/empresas/regimes-vigencia';

function regime(parcial: Partial<IntervaloRegime> & Pick<IntervaloRegime, 'vigenciaInicio'>): IntervaloRegime {
  return {
    id: parcial.id ?? 'r1',
    crt: parcial.crt ?? '3',
    vigenciaInicio: parcial.vigenciaInicio,
    vigenciaFim: parcial.vigenciaFim ?? null,
    situacao: parcial.situacao ?? 'APPROVED',
  };
}

describe('regimes-vigencia', () => {
  it('dia anterior atravessa mês, ano e fevereiro bissexto', () => {
    expect(diaAnterior('2026-03-01')).toBe('2026-02-28');
    expect(diaAnterior('2024-03-01')).toBe('2024-02-29');
    expect(diaAnterior('2026-01-01')).toBe('2025-12-31');
  });

  it('sem interseção é livre, inclusive no dia seguinte ao fim', () => {
    const atual = regime({ vigenciaInicio: '2026-01-01', vigenciaFim: '2026-01-10' });
    expect(classificarSobreposicao({ vigenciaInicio: '2026-01-11', vigenciaFim: null }, [atual]).tipo).toBe('livre');
    expect(classificarSobreposicao({ vigenciaInicio: '2025-01-01', vigenciaFim: '2025-12-31' }, [atual]).tipo).toBe('livre');
  });

  it('limites fechados: o mesmo dia de fim e início é sobreposto', () => {
    const atual = regime({ vigenciaInicio: '2026-01-01', vigenciaFim: '2026-01-10' });
    const resultado = classificarSobreposicao({ vigenciaInicio: '2026-01-10', vigenciaFim: '2026-01-20' }, [atual]);
    expect(resultado.tipo).toBe('sobreposto');
  });

  it('APPROVED aberto com início anterior é troca e propõe D−1', () => {
    const atual = regime({ id: 'aberto', vigenciaInicio: '2020-01-01', situacao: 'APPROVED' });
    const resultado = classificarSobreposicao({ vigenciaInicio: '2026-06-01', vigenciaFim: '2026-12-31' }, [atual]);
    expect(resultado).toEqual({
      tipo: 'troca',
      regimeAtual: atual,
      fimProposto: '2026-05-31',
    });
  });

  it('REVIEW sobreposto não vira troca', () => {
    const revisao = regime({ vigenciaInicio: '2026-01-01', situacao: 'REVIEW' });
    const resultado = classificarSobreposicao({ vigenciaInicio: '2026-06-01', vigenciaFim: null }, [revisao]);
    expect(resultado.tipo).toBe('sobreposto');
    if (resultado.tipo === 'sobreposto') expect(resultado.conflito.situacao).toBe('REVIEW');
  });

  it('APPROVED com fim futuro interceptado é sobreposto e não sugere encurtar', () => {
    const atual = regime({ vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31', situacao: 'APPROVED' });
    const resultado = classificarSobreposicao({ vigenciaInicio: '2026-06-01', vigenciaFim: '2026-08-01' }, [atual]);
    expect(resultado.tipo).toBe('sobreposto');
    if (resultado.tipo === 'sobreposto') expect(resultado.conflito.vigenciaFim).toBe('2026-12-31');
  });
});
