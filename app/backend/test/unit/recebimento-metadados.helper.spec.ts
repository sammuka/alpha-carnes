import { calcularProgressoBalanca } from '../../src/modules/operacao/recebimento/recebimento-metadados.helper';

describe('calcularProgressoBalanca', () => {
  it('retorna 100 quando nenhum item passa pela balança', () => {
    expect(
      calcularProgressoBalanca([
        { quantidadeEsperada: '10', requerBalanca: false, quantidadeApurada: 0 },
      ]),
    ).toBe(100);
  });

  it('retorna 0 quando esperado na balança é zero', () => {
    expect(
      calcularProgressoBalanca([
        { quantidadeEsperada: '0', requerBalanca: true, quantidadeApurada: 0 },
      ]),
    ).toBe(0);
  });

  it('calcula percentual parcial com cap no esperado', () => {
    expect(
      calcularProgressoBalanca([
        { quantidadeEsperada: '10', requerBalanca: true, quantidadeApurada: 5 },
      ]),
    ).toBe(50);
  });

  it('não ultrapassa 100% quando apurado excede o esperado', () => {
    expect(
      calcularProgressoBalanca([
        { quantidadeEsperada: '4', requerBalanca: true, quantidadeApurada: 9 },
      ]),
    ).toBe(100);
  });

  it('agrega múltiplos itens que passam pela balança', () => {
    expect(
      calcularProgressoBalanca([
        { quantidadeEsperada: '10', requerBalanca: true, quantidadeApurada: 10 },
        { quantidadeEsperada: '10', requerBalanca: true, quantidadeApurada: 5 },
        { quantidadeEsperada: '99', requerBalanca: false, quantidadeApurada: 0 },
      ]),
    ).toBe(75);
  });

  it('lista vazia → 100 (nenhum item de balança)', () => {
    expect(calcularProgressoBalanca([])).toBe(100);
  });
});
