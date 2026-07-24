import { ConflictException, NotFoundException } from '@nestjs/common';
import { CaminhaoService } from '../../src/modules/operacao/expedicao/caminhao.service';

function makeSelectChain(rows: unknown[]) {
  const chain: {
    where: (...args: unknown[]) => typeof chain;
    then: (cb: (r: unknown[]) => unknown) => unknown;
  } = {
    where: () => chain,
    then: (cb) => cb(rows),
  };
  return { from: () => chain };
}

describe('CaminhaoService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const operacoesService = { garantirOperacao: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('caminhaoAtivo → lança 404 se não encontrado', async () => {
    const tx = { select: jest.fn(() => makeSelectChain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new CaminhaoService({ db } as never, auditoria as never, operacoesService as never);
    await expect(service.caminhaoAtivo(tx as never, 'cam-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('vincularPedido → lança 404 se pedido não encontrado', async () => {
    const caminhao = { id: 'cam-1', statusCaminhao: 'em_carga', deletedAt: null };
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call++;
        if (call === 1) return makeSelectChain([caminhao]);
        return makeSelectChain([]);
      }),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new CaminhaoService({ db } as never, auditoria as never, operacoesService as never);
    await expect(
      service.vincularPedido('cam-1', { pedidoVendaId: 'pv-inexistente' } as never, 'u1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('vincularPedido → lança 409 se pedido cancelado', async () => {
    const caminhao = { id: 'cam-1', statusCaminhao: 'em_carga', deletedAt: null };
    const pedido = { id: 'pv1', status: 'cancelado', deletedAt: null };
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call++;
        if (call === 1) return makeSelectChain([caminhao]);
        return makeSelectChain([pedido]);
      }),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new CaminhaoService({ db } as never, auditoria as never, operacoesService as never);
    await expect(
      service.vincularPedido('cam-1', { pedidoVendaId: 'pv1' } as never, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.vincularPedido('cam-1', { pedidoVendaId: 'pv1' } as never, 'u1'),
    ).rejects.toThrow('cancelado não pode ser vinculado');
  });

  it('vincularPedido → idempotente quando vínculo já existe', async () => {
    const caminhao = { id: 'cam-1', statusCaminhao: 'em_carga', deletedAt: null };
    const pedido = { id: 'pv1', status: 'aberto', deletedAt: null };
    const existente = { id: 'vinc-1', caminhaoId: 'cam-1', pedidoVendaId: 'pv1', deletedAt: null };
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call++;
        if (call === 1) return makeSelectChain([caminhao]);
        if (call === 2) return makeSelectChain([pedido]);
        return makeSelectChain([existente]);
      }),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new CaminhaoService({ db } as never, auditoria as never, operacoesService as never);
    const result = await service.vincularPedido('cam-1', { pedidoVendaId: 'pv1' } as never, 'u1');
    expect(result).toEqual(existente);
  });

  it('abrirCarga → aceita status aguardando_carga sem checar transição', async () => {
    const caminhao = { id: 'cam-1', statusCaminhao: 'aguardando_carga', deletedAt: null };
    const atualizado = { id: 'cam-1', statusCaminhao: 'em_carga' };
    const tx = {
      select: jest.fn(() => makeSelectChain([caminhao])),
      update: jest.fn(() => ({
        set: () => ({
          where: () => ({
            returning: jest.fn(async () => [atualizado]),
          }),
        }),
      })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new CaminhaoService({ db } as never, auditoria as never, operacoesService as never);
    const result = await service.abrirCarga('cam-1', 'u1');
    expect(result).toEqual(atualizado);
  });

  it('abrirCarga → status incompatível lança 409 via assertTransicao', async () => {
    const caminhao = { id: 'cam-1', statusCaminhao: 'expedido', deletedAt: null };
    const tx = { select: jest.fn(() => makeSelectChain([caminhao])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new CaminhaoService({ db } as never, auditoria as never, operacoesService as never);
    await expect(service.abrirCarga('cam-1', 'u1')).rejects.toThrow('Transição inválida');
  });
});
