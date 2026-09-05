import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CADASTROS,
  configCadastroParaCliente,
  fornecedoresConfig,
} from '../cadastros-config';

function contemFuncao(valor: unknown): boolean {
  if (typeof valor === 'function') return true;
  if (Array.isArray(valor)) return valor.some(contemFuncao);
  if (valor && typeof valor === 'object') {
    return Object.values(valor).some(contemFuncao);
  }
  return false;
}

describe('configCadastroParaCliente', () => {
  it.each(Object.keys(CADASTROS))(
    'remove funções não serializáveis de %s (schema, ícones, máscaras)',
    (recurso) => {
      const serializavel = configCadastroParaCliente(CADASTROS[recurso]!);
      expect(contemFuncao(serializavel)).toBe(false);
      expect(serializavel.recurso).toBe(recurso);
    },
  );

  it('mantém os campos de fornecedores', () => {
    expect(configCadastroParaCliente(fornecedoresConfig).campos.map((c) => c.nome)).toEqual(
      fornecedoresConfig.campos.map((c) => c.nome),
    );
  });

  it('DoD 12.1 clientes possui uma única UI canônica', () => {
    expect(CADASTROS).not.toHaveProperty('clientes');
    const bff = path.join(__dirname, '../../app/api/cadastros/clientes');
    expect(fs.existsSync(path.join(bff, 'route.ts'))).toBe(true);
    expect(fs.existsSync(path.join(bff, '[id]/route.ts'))).toBe(true);
  });

  it('AD-15: CADASTROS não inclui itens-compra nem itens-comerciais', () => {
    expect(CADASTROS).not.toHaveProperty('itens-compra');
    expect(CADASTROS).not.toHaveProperty('itens-comerciais');
  });
});
