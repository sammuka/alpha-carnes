import { getTableConfig } from 'drizzle-orm/pg-core';
import { clientes } from '../../src/database/schema';

describe('Onda 4 — schema de clientes (D23)', () => {
  it('cliente grava rota_id com indice e o schema nao expoe rota_padrao', () => {
    expect(Object.keys(clientes)).toContain('rotaId');
    expect(Object.keys(clientes)).not.toContain('rotaPadrao');
    expect(
      getTableConfig(clientes).indexes.map((index) => index.config.name),
    ).toContain('idx_clientes_rota');
  });
});
