import {
  calcularRange,
  listarQuerySchema,
  montarPaginado,
  primeiroOuFalha,
} from '../../src/common/crud/paginacao';

describe('paginacao', () => {
  it('listarQuerySchema aceita incluirRemovidos boolean true', () => {
    const parsed = listarQuerySchema.parse({ page: 1, pageSize: 10, incluirRemovidos: true });
    expect(parsed.incluirRemovidos).toBe(true);
  });

  it('listarQuerySchema normaliza incluirRemovidos a partir de string "true"', () => {
    const parsed = listarQuerySchema.parse({ page: 1, pageSize: 10, incluirRemovidos: 'true' });
    expect(parsed.incluirRemovidos).toBe(true);
  });

  it('listarQuerySchema mantém incluirRemovidos false quando ausente', () => {
    const parsed = listarQuerySchema.parse({ page: 2, pageSize: 5 });
    expect(parsed.incluirRemovidos).toBe(false);
  });

  it('calcularRange calcula offset pela página', () => {
    expect(calcularRange({ page: 3, pageSize: 20 })).toEqual({ limit: 20, offset: 40 });
  });

  it('montarPaginado monta envelope padrão', () => {
    expect(montarPaginado(['a'], 1, { page: 1, pageSize: 10 })).toEqual({
      data: ['a'],
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });

  it('primeiroOuFalha lança quando array vazio', () => {
    expect(() => primeiroOuFalha([], 'vazio')).toThrow('vazio');
  });

  it('primeiroOuFalha retorna primeiro elemento', () => {
    expect(primeiroOuFalha([{ id: 1 }])).toEqual({ id: 1 });
  });
});
