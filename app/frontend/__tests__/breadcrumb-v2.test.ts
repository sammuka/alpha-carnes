import { resolveBreadcrumb } from '../src/lib/breadcrumb-v2';

describe('resolveBreadcrumb', () => {
  it('usa rótulo curto "Fornecedores" no breadcrumb (não o label longo do menu)', () => {
    const breadcrumb = resolveBreadcrumb('/cadastros/fornecedores');

    expect(breadcrumb).not.toBeNull();
    expect(breadcrumb?.group).toBe('CADASTROS & REGRAS');
    expect(breadcrumb?.item).toBe('Fornecedores');
    expect(breadcrumb?.item).not.toContain('Frigoríficos');
  });
});
