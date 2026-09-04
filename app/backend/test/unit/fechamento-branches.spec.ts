import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FechamentoService } from '../../src/modules/operacao/expedicao/fechamento.service';

describe('FechamentoService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reabrir → bloqueia reabertura quando há NFS-e emitida para o caminhão', async () => {
    const caminhao = { id: 'cam-1', statusCaminhao: 'fechado', dataOperacao: '2026-06-23', operacaoId: 'op-1' };
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue(caminhao),
      dataOperacaoDoCaminhao: jest.fn().mockResolvedValue('2026-06-23'),
    };
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([{ id: 'nf-1' }]),
        }),
      })),
    };
    const db = {
      transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const service = new FechamentoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    await expect(service.reabrir('cam-1', 'engano', 'op-1')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.reabrir('cam-1', 'engano', 'op-1')).rejects.toThrow('NFS-e emitida');
  });

  it('fechar → trata conferência sem pendências registradas (pendencias null) como sem faltas', async () => {
    const caminhao = { id: 'cam-2', statusCaminhao: 'em_conferencia', dataOperacao: '2026-06-23', operacaoId: 'op-1' };
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue(caminhao),
      dataOperacaoDoCaminhao: jest.fn().mockResolvedValue('2026-06-23'),
    };
    let callCount = 0;
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: () => {
              callCount += 1;
              return Promise.resolve([{ id: 'conf-1', pendencias: null }]);
            },
          }),
        }),
      })),
      update: jest.fn(() => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 'cam-2', statusCaminhao: 'fechado' }]),
          }),
        }),
      })),
    };
    const db = {
      transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const service = new FechamentoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    const resultado = await service.fechar('cam-2', {}, 'op-1');

    expect(callCount).toBe(1);
    expect(resultado).toEqual({ id: 'cam-2', statusCaminhao: 'fechado' });
  });

  it('reabrir → não há conferência concluída anterior para invalidar', async () => {
    const caminhao = { id: 'cam-3', statusCaminhao: 'fechado', dataOperacao: '2026-06-23', operacaoId: 'op-1' };
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue(caminhao),
      dataOperacaoDoCaminhao: jest.fn().mockResolvedValue('2026-06-23'),
    };
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            then: (cb: (rows: unknown[]) => unknown) => Promise.resolve(cb([])),
            orderBy: () => Promise.resolve([]),
          }),
        }),
      })),
      update: jest.fn(() => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 'cam-3', statusCaminhao: 'em_carga' }]),
          }),
        }),
      })),
    };
    const db = {
      transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const service = new FechamentoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    const resultado = await service.reabrir('cam-3', 'engano', 'op-1');

    expect(resultado).toEqual({ id: 'cam-3', statusCaminhao: 'em_carga' });
  });

  it('romaneio → caminhão sem pedidos vinculados retorna lista vazia', async () => {
    const caminhao = { id: 'cam-4', statusCaminhao: 'em_carga' };
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue(caminhao),
    };
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }),
      })),
    };
    const service = new FechamentoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    const resultado = await service.romaneio('cam-4');

    expect(resultado).toEqual({ caminhao, pedidos: [] });
  });
});
