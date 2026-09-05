import { ConflictException, NotFoundException } from '@nestjs/common';
import { RotasService } from '../../src/modules/cadastros/rotas/rotas.service';
import { RepresentantesService } from '../../src/modules/cadastros/representantes/representantes.service';
import { ProdutosService } from '../../src/modules/cadastros/produtos/produtos.service';

function txComRota(exists: boolean, deleted = false) {
  return {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() =>
          Promise.resolve(
            exists
              ? [{ id: 'rota-1', codigo: 'R1', nome: 'Rota', deletedAt: deleted ? new Date() : null }]
              : [],
          ),
        ),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([{ id: 'rota-new', codigo: 'R2' }])),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([{ id: 'rota-1', deletedAt: null }])),
        })),
      })),
    })),
  };
}

describe('RotasService — branches de erro', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  it('detalhar inexistente → NotFoundException', async () => {
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([])),
        })),
      })),
    };
    const service = new RotasService({ db } as never, auditoria as never);
    await expect(service.detalhar('019ef6b5-0000-7000-8000-000000000001')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('restaurar rota ativa → ConflictException', async () => {
    const tx = txComRota(true, false);
    const db = {
      transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    };
    const service = new RotasService({ db } as never, auditoria as never);
    await expect(service.restaurar('rota-1', 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('assertCodigoUnico conflito em criar → ConflictException', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([{ id: 'outro-id' }])),
        })),
      })),
    };
    const db = {
      transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    };
    const service = new RotasService({ db } as never, auditoria as never);
    await expect(
      service.criar(
        { codigo: 'R-DUP', nome: 'X', regiao: 'SP', status: 'ativo', paradas: [], diasAtendimento: [] },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('RepresentantesService — branches de erro', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  it('detalhar inexistente → NotFoundException', async () => {
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([])),
        })),
      })),
    };
    const service = new RepresentantesService({ db } as never, auditoria as never);
    await expect(service.detalhar('019ef6b5-0000-7000-8000-000000000002')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('restaurar representante ativo → ConflictException', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() =>
            Promise.resolve([{ id: 'rep-1', codigo: 'REP', deletedAt: null }]),
          ),
        })),
      })),
    };
    const db = {
      transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    };
    const service = new RepresentantesService({ db } as never, auditoria as never);
    await expect(service.restaurar('rep-1', 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ProdutosService — branches de erro', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  it('listar com busca aplica filtro', async () => {
    const countChain = {
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve([{ total: 0 }])),
      })),
    };
    const listChain = {
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => ({
              offset: jest.fn(() => Promise.resolve([])),
            })),
          })),
        })),
      })),
    };
    const db = {
      select: jest
        .fn()
        .mockImplementationOnce(() => listChain)
        .mockImplementationOnce(() => countChain),
    };

    const service = new ProdutosService({ db } as never, auditoria as never);
    await service.listar({
      page: 1,
      pageSize: 10,
      search: 'DIANT',
      incluirRemovidos: false,
      ativoVenda: undefined,
      ativoCompra: undefined,
    });
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('detalhar inexistente → NotFoundException', async () => {
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([])),
        })),
      })),
    };
    const service = new ProdutosService({ db } as never, auditoria as never);
    await expect(service.detalhar('019ef6b5-0000-7000-8000-000000000003')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('restaurar produto ativo → ConflictException', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() =>
            Promise.resolve([{ id: 'prod-1', codigo: 'P1', deletedAt: null }]),
          ),
        })),
      })),
    };
    const db = {
      transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    };
    const service = new ProdutosService({ db } as never, auditoria as never);
    await expect(service.restaurar('prod-1', 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('criar com código duplicado → ConflictException', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([{ id: 'outro-id' }])),
        })),
      })),
    };
    const db = {
      transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    };
    const service = new ProdutosService({ db } as never, auditoria as never);
    await expect(
      service.criar(
        {
          codigo: 'DUP',
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
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
