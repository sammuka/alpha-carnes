import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ClientesService } from '../../src/modules/cadastros/clientes/clientes.service';

function chain(rows: unknown[]) {
  const obj: Record<string, unknown> = {
    from: () => obj,
    leftJoin: () => obj,
    innerJoin: () => obj,
    where: () => obj,
    orderBy: () => obj,
    limit: () => obj,
    offset: () => obj,
    then: (resolve: (r: unknown[]) => unknown) => resolve(rows),
  };
  return obj;
}

describe('ClientesService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  it('listar com totais vazios usa 0', async () => {
    const db = { select: jest.fn(() => chain([])) };
    const svc = new ClientesService({ db } as never, auditoria as never);
    const result = await svc.listar({ page: 1, pageSize: 20 } as never, 'u1');
    expect(result.total).toBe(0);
    expect(result.totalAtivos).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('detalhar → 404 fora do escopo', async () => {
    const db = { select: jest.fn(() => chain([])) };
    const svc = new ClientesService({ db } as never, auditoria as never);
    await expect(svc.detalhar('c-x', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remover → 404 se não encontrado', async () => {
    const tx = { select: jest.fn(() => chain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const svc = new ClientesService({ db } as never, auditoria as never);
    await expect(svc.remover('c-x', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restaurar → 404 se não encontrado; 409 se não está removido', async () => {
    const txVazio = { select: jest.fn(() => chain([])) };
    const db404 = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(txVazio)) };
    const svc404 = new ClientesService({ db: db404 } as never, auditoria as never);
    await expect(svc404.restaurar('c-x', 'u1')).rejects.toBeInstanceOf(NotFoundException);

    const txVivo = { select: jest.fn(() => chain([{ id: 'c1', deletedAt: null }])) };
    const db409 = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(txVivo)) };
    const svc409 = new ClientesService({ db: db409 } as never, auditoria as never);
    await expect(svc409.restaurar('c1', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('atualizar → 404 se representante fora do escopo', async () => {
    const cliente = { id: 'c1', representanteId: null, codigo: '1', documentoFiscal: 'x' };
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([cliente]))
        .mockImplementationOnce(() => chain([])),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const svc = new ClientesService({ db } as never, auditoria as never);
    await expect(
      svc.atualizar('c1', { representanteId: 'rep-x' } as never, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('criar sem codigo esgota retries com erro não-Error', async () => {
    const db = {
      transaction: jest.fn().mockRejectedValue({ code: '23505', constraint: 'uq_clientes_codigo' }),
    };
    const svc = new ClientesService({ db } as never, auditoria as never);
    await expect(
      svc.criar({ razaoSocial: 'X', documentoFiscal: '1', faixaPreco: 'A' } as never, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.transaction).toHaveBeenCalledTimes(5);
  });

  it('atualizar → 400 se representante inativo e diferente do persistido', async () => {
    const cliente = { id: 'c1', representanteId: 'rep-old', codigo: '1', documentoFiscal: 'x' };
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([cliente]))
        .mockImplementationOnce(() => chain([{ id: 'rep-new', status: 'inativo' }])),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const svc = new ClientesService({ db } as never, auditoria as never);
    await expect(
      svc.atualizar('c1', { representanteId: 'rep-new' } as never, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('atualizar → 400 se rota inativa e diferente da persistida', async () => {
    const cliente = { id: 'c1', rotaId: 'r-old', codigo: '1', documentoFiscal: 'x' };
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([cliente]))
        .mockImplementationOnce(() => chain([{ id: 'r-new', status: 'inativo' }])),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const svc = new ClientesService({ db } as never, auditoria as never);
    await expect(
      svc.atualizar('c1', { rotaId: 'r-new' } as never, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
