import { formatarPerfis, ROTULOS_PERFIS } from '../src/lib/perfis';

describe('rótulos de perfil', () => {
  it('rotula os 11 perfis canonicos e preserva chave desconhecida', () => {
    expect(Object.keys(ROTULOS_PERFIS)).toHaveLength(11);
    expect(formatarPerfis(['recebimento_pesagem'])).toBe('Recebimento & Balança');
    expect(formatarPerfis(['gestor', 'comercial'])).toBe('Gestão · Comercial');
    expect(formatarPerfis(['perfil_novo'])).toBe('perfil_novo');
  });

  it('lista vazia nao inventa perfil', () => {
    expect(formatarPerfis([])).toBeNull();
  });
});
