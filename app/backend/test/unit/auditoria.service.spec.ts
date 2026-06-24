import { AuditoriaService } from '../../src/common/auditoria/auditoria.service';

describe('AuditoriaService', () => {
  it('registrar persiste campos opcionais e normaliza payloads', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn(() => ({ values }));
    const tx = { insert };
    const service = new AuditoriaService({ db: {} } as never);

    await service.registrar(tx as never, {
      tabela: 'pecas',
      registroId: 'pec-1',
      operacao: 'UPDATE',
      modulo: 'operacao',
      usuarioId: 'user-1',
      dadosAnteriores: { peso: '10.000', quando: new Date('2026-06-23T10:00:00Z') },
      dadosNovos: null,
      justificativa: 'ajuste',
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'user-1',
        dadosAnteriores: expect.objectContaining({ peso: '10.000' }),
        dadosNovos: {},
        justificativa: 'ajuste',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    );
  });

  it('registrar omite campos opcionais ausentes', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const tx = { insert: jest.fn(() => ({ values })) };
    const service = new AuditoriaService({ db: {} } as never);

    await service.registrar(tx as never, {
      tabela: 'pedidos_venda',
      registroId: 'pv-1',
      operacao: 'INSERT',
      modulo: 'comercial',
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: undefined,
        justificativa: undefined,
        ip: undefined,
        userAgent: undefined,
        dadosAnteriores: {},
        dadosNovos: {},
      }),
    );
  });
});
