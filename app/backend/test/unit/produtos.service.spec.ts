import { itensComerciais, itensCompra } from '../../src/database/schema';
import { ProdutosService } from '../../src/modules/cadastros/produtos/produtos.service';

describe('ProdutosService — sincronização legado', () => {
  function criarTxMock() {
    const inserts: { tabela: 'comercial' | 'compra'; valores: unknown }[] = [];
    const updates: { tabela: 'comercial' | 'compra'; valores: unknown }[] = [];

    const tx = {
      select: jest.fn((cols?: unknown) => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            if (cols && typeof cols === 'object' && cols !== null && 'id' in cols) {
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          }),
        })),
      })),
      insert: jest.fn((tabela: unknown) => ({
        values: jest.fn((valores: unknown) => ({
          returning: jest.fn(() => {
            if (tabela === itensComerciais) {
              inserts.push({ tabela: 'comercial', valores });
              return Promise.resolve([{ id: 'ic-mock-1' }]);
            }
            if (tabela === itensCompra) {
              inserts.push({ tabela: 'compra', valores });
              return Promise.resolve([{ id: 'icp-mock-1' }]);
            }
            return Promise.resolve([{ id: 'outro-mock-1' }]);
          }),
        })),
      })),
      update: jest.fn((tabela: unknown) => ({
        set: jest.fn((valores: unknown) => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => {
              if (tabela === itensComerciais) {
                updates.push({ tabela: 'comercial', valores });
                return Promise.resolve([{ id: 'ic-legado-1' }]);
              }
              if (tabela === itensCompra) {
                updates.push({ tabela: 'compra', valores });
                return Promise.resolve([{ id: 'icp-legado-1' }]);
              }
              return Promise.resolve([{ id: 'outro-mock-1' }]);
            }),
          })),
        })),
      })),
    };

    return { tx, inserts, updates };
  }

  function montarService() {
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    return new ProdutosService({ db: { transaction: jest.fn() } } as never, auditoria as never);
  }

  const payloadVenda = {
    codigo: 'DIANT',
    nome: 'Dianteiro',
    unidadePedido: 'peca',
    tipoOperacional: 'peca_inteira_pesavel' as const,
    unidadePreco: 'kg' as const,
    exigePeso: true,
    passaBalanca: true,
    passaDesossa: false,
    origemTransformacao: false,
    saidaTransformacao: false,
    podeEstoque: true,
    ativoVenda: true,
    ativoCompra: false,
    status: 'ativo' as const,
  };

  const payloadCompra = {
    codigo: 'BOI',
    nome: 'Boi inteiro',
    unidadePedido: 'cabeca',
    tipoOperacional: 'compra_base' as const,
    unidadePreco: 'unidade' as const,
    exigePeso: false,
    passaBalanca: false,
    passaDesossa: false,
    origemTransformacao: false,
    saidaTransformacao: false,
    podeEstoque: true,
    ativoVenda: false,
    ativoCompra: true,
    status: 'ativo' as const,
  };

  it('cria item comercial legado quando ativoVenda=true', async () => {
    const { tx, inserts } = criarTxMock();
    const service = montarService();

    const resultado = await service.sincronizarLegado(tx as never, payloadVenda, {
      legadoItemComercialId: null,
      legadoItemCompraId: null,
    });

    expect(resultado.legadoItemComercialId).toBe('ic-mock-1');
    expect(resultado.legadoItemCompraId).toBeNull();
    expect(inserts).toEqual([
      {
        tabela: 'comercial',
        valores: expect.objectContaining({
          codigo: 'DIANT',
          descricao: 'Dianteiro',
          unidadeComercial: 'peca',
          permiteCorte: false,
        }),
      },
    ]);
  });

  it('cria item de compra legado quando ativoCompra=true', async () => {
    const { tx, inserts } = criarTxMock();
    const service = montarService();

    const resultado = await service.sincronizarLegado(tx as never, payloadCompra, {
      legadoItemComercialId: null,
      legadoItemCompraId: null,
    });

    expect(resultado.legadoItemCompraId).toBe('icp-mock-1');
    expect(resultado.legadoItemComercialId).toBeNull();
    expect(inserts).toEqual([
      {
        tabela: 'compra',
        valores: expect.objectContaining({
          codigo: 'BOI',
          descricao: 'Boi inteiro',
          unidadeCompra: 'cabeca',
        }),
      },
    ]);
  });

  it('atualiza registros legados existentes em vez de criar novos', async () => {
    const { tx, inserts, updates } = criarTxMock();
    const service = montarService();

    const resultado = await service.sincronizarLegado(
      tx as never,
      { ...payloadVenda, ativoCompra: true, nome: 'Dianteiro atualizado' },
      { legadoItemComercialId: 'ic-legado-1', legadoItemCompraId: 'icp-legado-1' },
    );

    expect(resultado).toEqual({
      legadoItemComercialId: 'ic-legado-1',
      legadoItemCompraId: 'icp-legado-1',
    });
    expect(updates).toHaveLength(2);
    expect(inserts).toHaveLength(0);
  });

  it('mapeia permiteCorte=true para derivado_desossa', async () => {
    const { tx, inserts } = criarTxMock();
    const service = montarService();

    await service.sincronizarLegado(
      tx as never,
      {
        ...payloadVenda,
        tipoOperacional: 'derivado_desossa',
        passaDesossa: true,
      },
      { legadoItemComercialId: null, legadoItemCompraId: null },
    );

    expect(inserts[0]?.valores).toEqual(
      expect.objectContaining({ permiteCorte: true }),
    );
  });
});
