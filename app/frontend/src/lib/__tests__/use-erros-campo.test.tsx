import { act, renderHook } from '@testing-library/react';
import { useErrosPorCampo } from '../use-erros-campo';

describe('useErrosPorCampo', () => {
  it('limparCampo remove só a chave editada', () => {
    const { result } = renderHook(() => useErrosPorCampo());
    act(() => result.current.setErros({ a: 'Erro A', b: 'Erro B' }));
    act(() => result.current.limparCampo('a'));
    expect(result.current.erros).toEqual({ b: 'Erro B' });
  });

  it('limparCampo de chave inexistente não altera o estado', () => {
    const { result } = renderHook(() => useErrosPorCampo());
    act(() => result.current.setErros({ a: 'Erro A' }));
    act(() => result.current.limparCampo('x'));
    expect(result.current.erros).toEqual({ a: 'Erro A' });
  });
});
