import {
  classificarTipoV11,
  type QuadroItem,
} from '../../src/modules/operacao/recebimento/conferencia.service';

function item(partial: Partial<QuadroItem>): QuadroItem {
  return {
    recebimentoItemId: 'ri-1',
    itemComercialId: 'ic-1',
    previstoNoPedido: true,
    qtdPedido: '5.000',
    qtdNf: '5.000',
    qtdApurada: '5.000',
    pesoNf: '100.000',
    pesoApurado: '100.000',
    situacao: 'conforme',
    ...partial,
  };
}

describe('conferencia.calc (classificadores v1.1)', () => {
  it('classifica falta, excesso, peso, não previsto e outro', () => {
    expect(classificarTipoV11(item({ qtdApurada: '3.000', situacao: 'divergente' }))).toBe('falta');
    expect(classificarTipoV11(item({ qtdApurada: '7.000', situacao: 'divergente' }))).toBe('excesso');
    expect(classificarTipoV11(item({
      pesoApurado: '90.000', situacao: 'divergente',
    }))).toBe('peso_divergente');
    expect(classificarTipoV11(item({
      previstoNoPedido: false, situacao: 'divergente',
    }))).toBe('produto_nao_previsto');
    expect(classificarTipoV11(item({ situacao: 'conforme' }))).toBe('outro');
  });
});
