import { calcularFaltasDesossa, parseQuantidade } from '../../src/modules/operacao/desossa/faltas.calc';

describe('calcularFaltasDesossa', () => {
  const produtos = [
    { id: 'p1', codigo: 'JAC', nome: 'Jacaré', legadoItemComercialId: 'ic1' },
    { id: 'p2', codigo: 'ALC', nome: 'Alcatra', legadoItemComercialId: 'ic2' },
    { id: 'p3', codigo: 'SEM-LINK', nome: 'Sem vínculo', legadoItemComercialId: null },
  ];

  it('calcula faltante como demanda menos estoque', () => {
    const demanda = new Map([
      ['ic1', 13],
      ['ic2', 15],
    ]);
    const estoque = new Map([
      ['ic1', 0],
      ['ic2', 2],
    ]);
    const origem = new Map([
      ['p1', 'TZ'],
      ['p2', 'TZ'],
    ]);

    const resultado = calcularFaltasDesossa(produtos, demanda, estoque, origem);

    expect(resultado).toHaveLength(2);
    expect(resultado[0]).toEqual({
      produto: { id: 'p1', codigo: 'JAC', nome: 'Jacaré' },
      quantidadeFaltante: 13,
      quantidadeEstoque: 0,
      origem: 'TZ',
    });
    expect(resultado[1]).toEqual({
      produto: { id: 'p2', codigo: 'ALC', nome: 'Alcatra' },
      quantidadeFaltante: 13,
      quantidadeEstoque: 2,
      origem: 'TZ',
    });
  });

  it('ignora produtos sem demanda pendente', () => {
    const resultado = calcularFaltasDesossa(
      produtos,
      new Map([['ic1', 5]]),
      new Map([['ic1', 10]]),
      new Map([['p1', 'TZ']]),
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.quantidadeFaltante).toBe(0);
    expect(resultado[0]?.quantidadeEstoque).toBe(10);
  });

  it('usa origem padrão TZ quando regra não mapeia produto', () => {
    const resultado = calcularFaltasDesossa(
      produtos,
      new Map([['ic1', 4]]),
      new Map([['ic1', 1]]),
      new Map(),
    );

    expect(resultado[0]?.origem).toBe('TZ');
  });

  it('ordena por maior quantidade faltante', () => {
    const resultado = calcularFaltasDesossa(
      produtos,
      new Map([
        ['ic1', 5],
        ['ic2', 20],
      ]),
      new Map([
        ['ic1', 0],
        ['ic2', 0],
      ]),
      new Map(),
    );

    expect(resultado[0]?.produto.codigo).toBe('ALC');
    expect(resultado[1]?.produto.codigo).toBe('JAC');
  });
});

describe('parseQuantidade', () => {
  it('converte strings numéricas do banco', () => {
    expect(parseQuantidade('13.500')).toBe(13.5);
    expect(parseQuantidade(null)).toBe(0);
    expect(parseQuantidade('abc')).toBe(0);
  });
});
