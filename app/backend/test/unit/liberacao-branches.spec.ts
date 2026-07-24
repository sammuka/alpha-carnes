import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LiberacaoService } from '../../src/modules/operacao/expedicao/liberacao.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

function caminhao(status: string, id = 'cam-1') {
  return { id, statusCaminhao: status, dataOperacao: '2026-06-23', operacaoId: 'op-1' };
}

describe('LiberacaoService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  const emitSpy = jest.spyOn(emitter, 'emit');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('liberarFaturamento idempotente quando já liberado', async () => {
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue(caminhao('liberado_faturamento')),
      dataOperacaoDoCaminhao: jest.fn().mockResolvedValue('2026-06-23'),
    };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
    };
    const service = new LiberacaoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    const res = await service.liberarFaturamento('cam-1', 'op-1');
    expect(res.statusCaminhao).toBe('liberado_faturamento');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('liberarFaturamento emite evento ao transicionar de fechado', async () => {
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue(caminhao('fechado')),
      dataOperacaoDoCaminhao: jest.fn().mockResolvedValue('2026-06-23'),
    };
    const tx = {
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([caminhao('liberado_faturamento')])),
          })),
        })),
      })),
    };
    const db = {
      transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const service = new LiberacaoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    await service.liberarFaturamento('cam-1', 'op-1');
    expect(emitSpy).toHaveBeenCalledWith(EVENTOS.EXPEDICAO_LIBERADA_FATURAMENTO, {
      caminhaoId: 'cam-1',
      dataOperacao: '2026-06-23',
    });
  });

  it('liberarSaida exige faturamento concluído', async () => {
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue(caminhao('faturado')),
      dataOperacaoDoCaminhao: jest.fn().mockResolvedValue('2026-06-23'),
    };
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([{ statusFaturamento: 'parcialmente_emitido' }])),
        })),
      })),
    };
    const db = {
      transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const service = new LiberacaoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    await expect(service.liberarSaida('cam-1', 'op-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('liberarSaida idempotente quando já liberado_saida', async () => {
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue(caminhao('liberado_saida')),
      dataOperacaoDoCaminhao: jest.fn().mockResolvedValue('2026-06-23'),
    };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
    };
    const service = new LiberacaoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    const res = await service.liberarSaida('cam-1', 'op-1');
    expect(res.statusCaminhao).toBe('liberado_saida');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('sincronizarPosEmissao retorna null sem faturamento', async () => {
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([])),
        })),
      })),
    };
    const service = new LiberacaoService(
      { db } as never,
      auditoria as never,
      emitter,
      { caminhaoAtivo: jest.fn(), dataOperacaoDoCaminhao: jest.fn().mockResolvedValue('2026-06-23') } as never,
    );

    await expect(service.sincronizarPosEmissao('cam-1', 'op-1')).resolves.toBeNull();
  });
});
