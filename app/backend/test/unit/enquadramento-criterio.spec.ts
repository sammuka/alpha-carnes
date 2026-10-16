import { classificarEnquadramentos } from '../../src/modules/erp/fiscal/enquadramentos/enquadramento-criterio';

describe('classificarEnquadramentos', () => {
  it('não desempata por prioridade', () => {
    const r = classificarEnquadramentos([
      { codigo: '2', prioridade: 1 },
      { codigo: '10', prioridade: 99 },
    ]);
    expect(r).toEqual({ tipo: 'empate', codigos: ['2', '10'] });
  });

  it('2 candidatos não elege o de menor prioridade', () => {
    const r = classificarEnquadramentos([
      { codigo: '9', prioridade: 1 },
      { codigo: '3', prioridade: 50 },
    ]);
    expect(r).toEqual({ tipo: 'empate', codigos: ['9', '3'] });
    expect(r).not.toHaveProperty('vencedor');
  });

  it('0 candidatos é ausente e 1 é único', () => {
    expect(classificarEnquadramentos([])).toEqual({ tipo: 'ausente' });
    expect(classificarEnquadramentos([{ codigo: '4', prioridade: 8 }])).toEqual({
      tipo: 'unico',
      codigo: '4',
    });
  });
});
