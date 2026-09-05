import { ConflictException } from '@nestjs/common';
import { ProntidaoService } from '../../src/modules/cadastros/prontidao/prontidao.service';

describe('ProntidaoService', () => {
  it('retorna pronto quando todos os cadastros mínimos existem', async () => {
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([{ total: 2 }])),
        })),
      })),
    };
    const service = new ProntidaoService({ db } as never);

    await expect(service.verificarProntidaoCadastros()).resolves.toEqual({
      pronto: true,
      contagens: expect.objectContaining({
        clientes: 2,
        fornecedores: 2,
        produtosVenda: 2,
        regrasDesdobramento: 2,
      }),
    });
  });

  it('lança ConflictException listando cadastros faltantes', async () => {
    let call = 0;
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            call += 1;
            return Promise.resolve([{ total: call === 3 ? 0 : 1 }]);
          }),
        })),
      })),
    };
    const service = new ProntidaoService({ db } as never);

    await expect(service.verificarProntidaoCadastros()).rejects.toBeInstanceOf(ConflictException);
  });

  it('contagem retorna zero quando select não retorna linha', async () => {
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([])),
        })),
      })),
    };
    const service = new ProntidaoService({ db } as never);

    await expect(service.verificarProntidaoCadastros()).rejects.toMatchObject({
      message: expect.stringContaining('produtosVenda'),
    });
  });
});
