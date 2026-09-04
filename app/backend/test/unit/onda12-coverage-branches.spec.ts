import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProdutosService } from '../../src/modules/cadastros/produtos/produtos.service';
import { RegrasDesdobramentoService } from '../../src/modules/cadastros/regras-desdobramento/regras-desdobramento.service';

const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

function listarDb(linhas: unknown[], total: unknown[] = [{ total: linhas.length }]) {
  const listChain = {
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            offset: jest.fn(() => Promise.resolve(linhas)),
          })),
        })),
      })),
    })),
  };
  const countChain = {
    from: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve(total)),
    })),
  };
  return {
    select: jest.fn().mockImplementationOnce(() => listChain).mockImplementationOnce(() => countChain),
  };
}

const produtoBase = {
  id: 'prod-1',
  codigo: 'P1',
  nome: 'Produto',
  nomeOperacional: null,
  categoria: null,
  tipoOperacional: 'peca_inteira_pesavel',
  unidadePedido: 'unidade',
  unidadePreco: 'kg',
  exigePeso: true,
  passaBalanca: true,
  passaDesossa: false,
  origemTransformacao: false,
  saidaTransformacao: false,
  podeEstoque: false,
  ativoVenda: false,
  ativoCompra: false,
  status: 'ativo',
  observacoesOperacionais: null,
  atributosJson: {},
  deletedAt: null,
};

describe('ProdutosService — cobertura de branches Onda 12', () => {
  it('listar filtra por status e inclui removidos', async () => {
    const db = listarDb([], []);
    const service = new ProdutosService({ db } as never, auditoria as never);
    const r = await service.listar({ page: 1, pageSize: 10, status: 'inativo', incluirRemovidos: true });
    expect(r.total).toBe(0);
  });

  it('atualizar inexistente → NotFoundException', async () => {
    const tx = {
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = new ProdutosService({ db } as never, auditoria as never);
    await expect(service.atualizar('prod-x', { nome: 'X' }, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualizar parcial usa fallbacks do registro anterior', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([produtoBase])),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...produtoBase, nome: 'Produto' }])),
          })),
        })),
      })),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = new ProdutosService({ db } as never, auditoria as never);
    const atualizado = await service.atualizar('prod-1', {}, 'user-1');
    expect(atualizado.codigo).toBe('P1');
  });

  it('remover inexistente → NotFoundException', async () => {
    const tx = {
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = new ProdutosService({ db } as never, auditoria as never);
    await expect(service.remover('prod-x', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restaurar inexistente → NotFoundException', async () => {
    const tx = {
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = new ProdutosService({ db } as never, auditoria as never);
    await expect(service.restaurar('prod-x', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restaurar produto removido', async () => {
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([{ ...produtoBase, deletedAt: new Date() }])),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([{ id: 'prod-1' }])),
          })),
        })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...produtoBase, deletedAt: null }])),
          })),
        })),
      })),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = new ProdutosService({ db } as never, auditoria as never);
    const restaurado = await service.restaurar('prod-1', 'user-1');
    expect(restaurado.deletedAt).toBeNull();
  });

  it('criar produto sem legado', async () => {
    const tx = {
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([produtoBase])),
        })),
      })),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = new ProdutosService({ db } as never, auditoria as never);
    const criado = await service.criar(
      {
        codigo: 'P1',
        nome: 'Produto',
        tipoOperacional: 'peca_inteira_pesavel',
        unidadePedido: 'unidade',
        unidadePreco: 'kg',
        exigePeso: true,
        passaBalanca: true,
        passaDesossa: false,
        origemTransformacao: false,
        saidaTransformacao: false,
        podeEstoque: false,
        ativoVenda: false,
        ativoCompra: false,
        status: 'ativo',
      },
      'user-1',
    );
    expect(criado.id).toBe('prod-1');
  });

  it('remover produto existente', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([produtoBase])) })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...produtoBase, deletedAt: new Date() }])),
          })),
        })),
      })),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = new ProdutosService({ db } as never, auditoria as never);
    const r = await service.remover('prod-1', 'user-1');
    expect(r.id).toBe('prod-1');
    expect(r.deletedAt).toBeInstanceOf(Date);
  });
});

describe('produtosService — cobertura de branches Onda 12', () => {
  const item = {
    id: 'ic-1',
    codigo: 'IC1',
    descricao: 'Dianteiro',
    categoria: null,
    unidadeComercial: 'kg',
    permiteCorte: false,
    status: 'ativo',
    observacoesOperacionais: null,
    deletedAt: null,
  };

  it('listar aplica status, busca e inclui removidos', async () => {
    const db = listarDb([item]);
    const service = new ProdutosService({ db } as never, auditoria as never);
    const r = await service.listar({
      page: 1,
      pageSize: 10,
      status: 'ativo',
      search: 'Dian',
      incluirRemovidos: true,
    });
    expect(r.data).toHaveLength(1);
  });

  it('detalhar e mutações de inexistente → NotFoundException', async () => {
    const vazio = {
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
    };
    const dbTx = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(vazio)) };
    const service = new ProdutosService({ db: { ...vazio, ...dbTx } } as never, auditoria as never);
    await expect(service.detalhar('x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.atualizar('x', { descricao: 'Y' }, 'u')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remover('x', 'u')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.restaurar('x', 'u')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('criar, atualizar, remover e restaurar caminho feliz', async () => {
    const txCriar = {
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([item])) })),
      })),
    };
    const service = new ProdutosService(
      { db: { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txCriar)) } } as never,
      auditoria as never,
    );
    expect((await service.criar({
      codigo: 'IC1',
      descricao: 'Dianteiro',
      unidadeComercial: 'kg',
      permiteCorte: false,
      status: 'ativo',
    }, 'u')).id).toBe('ic-1');

    const txUpd = {
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([item])) })) })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([item])) })),
        })),
      })),
    };
    const svcUpd = new ProdutosService(
      { db: { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txUpd)) } } as never,
      auditoria as never,
    );
    expect((await svcUpd.atualizar('ic-1', {}, 'u')).codigo).toBe('IC1');
    expect((await svcUpd.remover('ic-1', 'u')).id).toBe('ic-1');

    const txRest = {
      select: jest.fn()
        .mockImplementationOnce(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([{ ...item, deletedAt: new Date() }])),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([{ id: 'ic-1' }])) })),
        })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...item, deletedAt: null }])),
          })),
        })),
      })),
    };
    const svcRest = new ProdutosService(
      { db: { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txRest)) } } as never,
      auditoria as never,
    );
    expect((await svcRest.restaurar('ic-1', 'u')).deletedAt).toBeNull();
  });

  it('restaurar item ativo → ConflictException; criar código duplicado → ConflictException', async () => {
    const txAtivo = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([item])) })),
      })),
    };
    const svc = new ProdutosService(
      { db: { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txAtivo)) } } as never,
      auditoria as never,
    );
    await expect(svc.restaurar('ic-1', 'u')).rejects.toBeInstanceOf(ConflictException);

    const txDup = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([{ id: 'outro' }])) })),
      })),
    };
    const svcDup = new ProdutosService(
      { db: { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txDup)) } } as never,
      auditoria as never,
    );
    await expect(
      svcDup.criar({
        codigo: 'IC1',
        descricao: 'X',
        unidadeComercial: 'kg',
        permiteCorte: false,
        status: 'ativo',
      }, 'u'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('RegrasDesdobramentoService — cobertura de branches Onda 12', () => {
  function listarJoinDb(linhas: unknown[], total: number) {
    const listChain = {
      from: jest.fn(() => ({
        innerJoin: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => ({
                  offset: jest.fn(() => Promise.resolve(linhas)),
                })),
              })),
            })),
          })),
        })),
      })),
    };
    const countChain = {
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve([{ total }])),
      })),
    };
    return {
      select: jest.fn().mockImplementationOnce(() => listChain).mockImplementationOnce(() => countChain),
    };
  }

  it('listar com join coerente e incluirRemovidos', async () => {
    const db = listarJoinDb([{ id: 'r1' }], 1);
    const service = new RegrasDesdobramentoService({ db } as never, auditoria as never);
    const r = await service.listar({ page: 1, pageSize: 20, incluirRemovidos: true });
    expect(r.data).toHaveLength(1);
  });

  it('listar com referência órfã → ConflictException', async () => {
    const db = listarJoinDb([], 1);
    const service = new RegrasDesdobramentoService({ db } as never, auditoria as never);
    await expect(service.listar({ page: 1, pageSize: 20, incluirRemovidos: false })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('detalhar inexistente → NotFoundException', async () => {
    const db = {
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
    };
    const service = new RegrasDesdobramentoService({ db } as never, auditoria as never);
    await expect(service.detalhar('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('criar rejeita item inativo', async () => {
    const tx = {
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
    };
    const service = new RegrasDesdobramentoService(
      { db: { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) } } as never,
      auditoria as never,
    );
    await expect(
      service.criar(
        {
          produtoId: 'c1',
          produtoId: 'm1',
          fatorQuantidade: 2,
          status: 'ativo',
          vigenciaInicio: new Date('2026-01-01'),
        },
        'u',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('atualizar regra inexistente → NotFoundException', async () => {
    const tx = {
      select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
    };
    const service = new RegrasDesdobramentoService(
      { db: { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) } } as never,
      auditoria as never,
    );
    await expect(service.atualizar('x', { status: 'inativo' }, 'u')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('simular agrega fatores de regras ativas', async () => {
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() =>
                Promise.resolve([
                  { produtoId: 'm1', descricao: 'TZ', fator: '2' },
                  { produtoId: 'm2', descricao: 'DT', fator: '2' },
                ]),
              ),
            })),
          })),
        })),
      })),
    };
    const service = new RegrasDesdobramentoService({ db } as never, auditoria as never);
    const r = await service.simular('compra-1', 10);
    expect(r.somaFatores).toBe(4);
    expect(r.itens).toHaveLength(2);
  });
});
