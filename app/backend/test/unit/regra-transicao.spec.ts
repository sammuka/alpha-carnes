import { ConflictException } from '@nestjs/common';
import { recusarAcao, recusarEdicao } from '../../src/modules/erp/fiscal/regras/regra-transicao';

function codigoDe(executar: () => void): string {
  try {
    executar();
  } catch (err) {
    const corpo = err instanceof ConflictException ? err.getResponse() : undefined;
    if (typeof corpo === 'object' && corpo && 'codigo' in corpo) return String(corpo.codigo);
    throw err;
  }
  throw new Error('a transição não recusou');
}

describe('regra-transicao', () => {
  it('editar aprovada ou aposentada é VERSAO_IMUTAVEL', () => {
    expect(codigoDe(() => recusarEdicao('APROVADA'))).toBe('VERSAO_IMUTAVEL');
    expect(codigoDe(() => recusarEdicao('APOSENTADA'))).toBe('VERSAO_IMUTAVEL');
  });

  it('editar submetida é TRANSICAO_INVALIDA', () => {
    expect(codigoDe(() => recusarEdicao('SUBMETIDA'))).toBe('TRANSICAO_INVALIDA');
  });

  it('aprovar rascunho é TRANSICAO_INVALIDA', () => {
    expect(codigoDe(() => recusarAcao('RASCUNHO', 'aprovar'))).toBe('TRANSICAO_INVALIDA');
  });
});
