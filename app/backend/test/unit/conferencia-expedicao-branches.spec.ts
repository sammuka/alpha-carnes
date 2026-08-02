import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConferenciaService } from '../../src/modules/operacao/expedicao/conferencia.service';

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

describe('ConferenciaService (expedição) — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  const etiqueta = { resolverQr: jest.fn(), resolverQrSubitem: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  function makeService(tx: unknown, caminhaoAtivo: unknown) {
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const caminhaoService = { caminhaoAtivo: jest.fn().mockResolvedValue(caminhaoAtivo) };
    return new ConferenciaService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
      etiqueta as never,
    );
  }

  it('registrarItem → 409 se caminhão não está em conferência', async () => {
    etiqueta.resolverQr.mockResolvedValue({ id: 'peca-1' });
    const tx = {};
    const service = makeService(tx, { id: 'cam-1', statusCaminhao: 'em_carga' });
    await expect(
      service.registrarItem('cam-1', { tipoOrigem: 'peca', modoCaptura: 'automatico' } as never, { sub: 'u1' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('registrarItem → 409 se não há conferência ativa', async () => {
    etiqueta.resolverQr.mockResolvedValue({ id: 'peca-1' });
    const tx = { select: jest.fn(() => makeSelectChain([])) };
    const service = makeService(tx, { id: 'cam-1', statusCaminhao: 'em_conferencia' });
    await expect(
      service.registrarItem('cam-1', { tipoOrigem: 'peca', modoCaptura: 'automatico' } as never, { sub: 'u1' } as never),
    ).rejects.toThrow('Nenhuma conferência ativa');
  });

  it('registrarItem (subitem) → 409 excedente quando item não pertence à carga', async () => {
    etiqueta.resolverQrSubitem.mockResolvedValue({ id: 'sub-1' });
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call++;
        if (call === 1) return makeSelectChain([{ id: 'conf-1', statusConferencia: 'aberta' }]);
        return makeSelectChain([]);
      }),
    };
    const service = makeService(tx, { id: 'cam-1', statusCaminhao: 'em_conferencia' });
    await expect(
      service.registrarItem('cam-1', { tipoOrigem: 'subitem', modoCaptura: 'automatico' } as never, { sub: 'u1' } as never),
    ).rejects.toThrow('excedente');
  });

  it('divergencia → 409 se caminhão não está em conferência', async () => {
    const tx = {};
    const service = makeService(tx, { id: 'cam-1', statusCaminhao: 'fechado' });
    await expect(
      service.divergencia('cam-1', { cargaItemId: 'item-1', motivo: 'outro' } as never, { sub: 'u1' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('divergencia → 409 se não há conferência ativa', async () => {
    const tx = { select: jest.fn(() => makeSelectChain([])) };
    const service = makeService(tx, { id: 'cam-1', statusCaminhao: 'em_conferencia' });
    await expect(
      service.divergencia('cam-1', { cargaItemId: 'item-1', motivo: 'outro' } as never, { sub: 'u1' } as never),
    ).rejects.toThrow('Nenhuma conferência ativa para este caminhão');
  });

  it('divergencia → 409 se item não está vinculado à carga', async () => {
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call++;
        if (call === 1) return makeSelectChain([{ id: 'conf-1', statusConferencia: 'aberta' }]);
        return makeSelectChain([]);
      }),
    };
    const service = makeService(tx, { id: 'cam-1', statusCaminhao: 'em_conferencia' });
    await expect(
      service.divergencia('cam-1', { cargaItemId: 'item-1', motivo: 'outro' } as never, { sub: 'u1' } as never),
    ).rejects.toThrow('Item não está vinculado a esta carga');
  });

  it('concluir → 409 se caminhão não está em conferência', async () => {
    const tx = {};
    const service = makeService(tx, { id: 'cam-1', statusCaminhao: 'fechado' });
    await expect(service.concluir('cam-1', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('concluir → 409 se não há conferência ativa', async () => {
    const tx = { select: jest.fn(() => makeSelectChain([])) };
    const service = makeService(tx, { id: 'cam-1', statusCaminhao: 'em_conferencia' });
    await expect(service.concluir('cam-1', 'u1')).rejects.toThrow('Nenhuma conferência ativa');
  });
});
