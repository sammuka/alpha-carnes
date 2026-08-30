import nextConfig from '../next.config';

describe('next.config redirects', () => {
  it('não redireciona itens-compra nem itens-comerciais para produtos (AD-11)', async () => {
    const redirects = nextConfig.redirects ? await nextConfig.redirects() : [];
    const fontes = redirects.map((r) => r.source);
    expect(fontes).not.toContain('/cadastros/itens-compra');
    expect(fontes).not.toContain('/cadastros/itens-comerciais');
    expect(redirects.some((r) => r.destination === '/cadastros/produtos')).toBe(false);
  });
});
