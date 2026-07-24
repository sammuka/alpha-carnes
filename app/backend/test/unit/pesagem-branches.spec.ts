import { NotFoundException } from '@nestjs/common';
import { PesagemService } from '../../src/modules/operacao/pesagem/pesagem.service';

describe('PesagemService — branches', () => {
  function makeService(rows: unknown[]) {
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => Promise.resolve(rows),
        }),
      })),
    };
    return new PesagemService(
      { db } as never,
      { registrar: jest.fn() } as never,
      { emit: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('detalhar → lança 404 se peça não encontrada', async () => {
    const service = makeService([]);
    await expect(service.detalhar('pc-inexistente')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.detalhar('pc-inexistente')).rejects.toThrow('Peça não encontrada');
  });

  it('listarPorRecebimento → retorna peças ordenadas por criação', async () => {
    const pecas = [{ id: 'pc1', recebimentoId: 'r1', deletedAt: null }];
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(pecas),
          }),
        }),
      })),
    };
    const service = new PesagemService(
      { db } as never,
      { registrar: jest.fn() } as never,
      { emit: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await service.listarPorRecebimento('r1');
    expect(result).toEqual(pecas);
  });
});
