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
});
