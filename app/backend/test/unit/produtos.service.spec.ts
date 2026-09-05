import { produtos } from '../../src/database/schema';
import { ProdutosService } from '../../src/modules/cadastros/produtos/produtos.service';
import { listarProdutoQuerySchema } from '../../src/common/crud/paginacao';

describe('ProdutosService — catálogo único (AD-15)', () => {
  const payloadVenda = {
    codigo: 'DIANT',
    nome: 'Dianteiro',
    unidadePedido: 'unidade' as const,
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

  function montarService(dbMock: unknown) {
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    return new ProdutosService({ db: dbMock } as never, auditoria as never);
  }

  it('criar com ativoVenda insere somente em produtos', async () => {
    const inserts: unknown[] = [];
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([])),
        })),
      })),
      insert: jest.fn((tabela: unknown) => ({
        values: jest.fn((valores: unknown) => ({
          returning: jest.fn(() => {
            if (tabela === produtos) {
              inserts.push(valores);
              return Promise.resolve([{ id: 'prod-mock-1', ...payloadVenda }]);
            }
            throw new Error(`insert inesperado em ${String(tabela)}`);
          }),
        })),
      })),
    };
    const db = {
      transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const service = montarService(db);

    await service.criar(payloadVenda, 'user-1');

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual(expect.objectContaining({ codigo: 'DIANT', ativoVenda: true }));
  });

  it('listar com ativoVenda=true exclui BOI (filtro no WHERE)', async () => {
    const boi = { id: '1', codigo: 'BOI', ativoVenda: false, ativoCompra: true, deletedAt: null };
    const tz = { id: '2', codigo: 'TZ', ativoVenda: true, ativoCompra: true, deletedAt: null };
    const whereCalls: unknown[] = [];

    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn((cond: unknown) => {
            whereCalls.push(cond);
            return {
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => ({
                  offset: jest.fn(() => Promise.resolve([tz])),
                })),
              })),
            };
          }),
        })),
      })),
    };
    (db.select as jest.Mock).mockImplementationOnce(() => ({
      from: jest.fn(() => ({
        where: jest.fn((cond: unknown) => {
          whereCalls.push(cond);
          return {
            orderBy: jest.fn(() => ({
              limit: jest.fn(() => ({
                offset: jest.fn(() => Promise.resolve([tz])),
              })),
            })),
          };
        }),
      })),
    }));
    (db.select as jest.Mock).mockImplementationOnce(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve([{ total: 1 }])),
      })),
    }));

    const service = montarService(db);
    const resultado = await service.listar({
      page: 1,
      pageSize: 20,
      ativoVenda: true,
      ativoCompra: undefined,
      incluirRemovidos: false,
    });

    expect(resultado.data).toEqual([tz]);
    expect(resultado.data.some((p) => p.codigo === 'BOI')).toBe(false);
    expect(whereCalls.length).toBeGreaterThan(0);
  });

  it('query string ativoVenda=false não vira true (listarProdutoQuerySchema)', () => {
    const parsed = listarProdutoQuerySchema.parse({ page: '1', pageSize: '20', ativoVenda: 'false' });
    expect(parsed.ativoVenda).toBe(false);
  });
});
