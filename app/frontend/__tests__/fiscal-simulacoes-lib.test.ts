import * as fs from 'node:fs';
import * as path from 'node:path';
import * as lib from '../src/lib/fiscal-simulacoes';
import { descontoMaiorQueValor, rotuloVersao, validarDinheiro, validarEscala } from '../src/lib/fiscal-simulacoes';

describe('fiscal-simulacoes lib', () => {
  it('formata dinheiro e competência sem calcular tributo', () => {
    expect(lib.formatarDinheiroPtBr('583.30')).toBe('583,30');
    expect(lib.rotuloCompetencia('2026-10')).toBe('Outubro de 2026');
    expect(lib).not.toHaveProperty('calcularMemoria');
    const fonte = fs.readFileSync(path.join(__dirname, '../src/lib/fiscal-simulacoes.ts'), 'utf8');
    expect(fonte).not.toMatch(/parseFloat/);
    expect(fonte).not.toMatch(/Number\(/);
  });

  it('valida dinheiro e escalas localmente com as regras do servidor', () => {
    expect(validarDinheiro('1.000,00', { exigirPositivo: true })).toBeNull();
    expect(validarDinheiro('0,00', { exigirPositivo: false })).toBeNull();
    expect(validarDinheiro('0,00', { exigirPositivo: true })).toBe('Informe um valor maior que zero.');
    expect(validarDinheiro('12x', { exigirPositivo: true })).toBe('Informe um valor com até duas casas decimais.');
    expect(validarEscala('10,000', 12, 'msg')).toBeNull();
    expect(validarEscala('0,000', 12, 'msg')).toBe('msg');
    expect(validarEscala('1234567890123', 12, 'msg')).toBe('msg');
  });

  it('compara desconto e valor pelos centavos, sem ponto flutuante', () => {
    expect(descontoMaiorQueValor('1.000,01', '1.000,00')).toBe(true);
    expect(descontoMaiorQueValor('1.000,00', '1.000,00')).toBe(false);
    expect(descontoMaiorQueValor('x', '1,00')).toBe(false);
  });

  it('rótulo da versão traz código, versão, situação e competência', () => {
    expect(rotuloVersao({ codigo: '71', numeroVersao: 2, situacao: 'Calculada', competenciaRotulo: 'Outubro de 2026' }))
      .toBe('71 · versão 2 · Calculada · Outubro de 2026');
  });
});

describe('ENQUADRAMENTO_INDISPONIVEL (plano T04 L501)', () => {
  it.each([
    'O enquadramento fiscal não está ativo.',
    'O enquadramento fiscal não cobre esta competência.',
  ])('mostra a mensagem do servidor: %s', async (mensagem) => {
    const original = global.fetch;
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ message: { message: mensagem, codigo: 'ENQUADRAMENTO_INDISPONIVEL' }, statusCode: 422 }), { status: 422 })) as unknown as typeof fetch;
    try {
      const erro = await lib.simulacoesApi.criar({} as never).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(lib.ErroSimulacao);
      expect(lib.mensagemDeSimulacao(erro as InstanceType<typeof lib.ErroSimulacao>)).toBe(mensagem);
    } finally {
      global.fetch = original;
    }
  });
});
