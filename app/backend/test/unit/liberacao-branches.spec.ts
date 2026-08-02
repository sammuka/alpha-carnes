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

  it('liberarSaida transiciona faturado → liberado_saida quando faturamento concluído', async () => {
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue(caminhao('faturado')),
      dataOperacaoDoCaminhao: jest.fn().mockResolvedValue('2026-06-23'),
    };
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([{ statusFaturamento: 'concluido' }])),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([caminhao('liberado_saida')])),
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

    const res = await service.liberarSaida('cam-1', 'op-1');
    expect(res.statusCaminhao).toBe('liberado_saida');
    expect(auditoria.registrar).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(EVENTOS.EXPEDICAO_LIBERADA_SAIDA, {
      caminhaoId: 'cam-1',
      dataOperacao: '2026-06-23',
    });
  });

  it('listarParaEnvio agrega responsável da liberação quando há caminhões liberados', async () => {
    const caminhaoService = { caminhaoAtivo: jest.fn(), dataOperacaoDoCaminhao: jest.fn() };
    const horaLiberacao = new Date('2026-06-23T10:00:00Z');
    const respostas: unknown[][] = [
      [{ id: 'cam-1', placa: 'ABC1234', motorista: 'M1', rota: 'R1', statusCaminhao: 'liberado_faturamento', horaLiberacao }],
      [{ caminhaoId: 'cam-1', pedidoVendaId: 'pv1', etiqueta: 'ET1', produtoNome: 'Traseiro', peso: '10.000' }],
      [],
      [{ id: 'pv1', nomeFantasia: 'Cliente Fantasia', razaoSocial: 'Cliente SA' }],
      [{ registroId: 'cam-1', responsavelNome: 'Operador Expedição' }],
    ];
    let call = 0;
    const db = {
      select: jest.fn(() => {
        const rows = respostas[call++] ?? [];
        const chain = {
          from: () => chain,
          innerJoin: () => chain,
          leftJoin: () => chain,
          where: () => chain,
          orderBy: () => Promise.resolve(rows),
          then: (resolve: (r: unknown[]) => unknown) => Promise.resolve(resolve(rows)),
        };
        return chain;
      }),
    };
    const service = new LiberacaoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    const resultado = await service.listarParaEnvio('2026-06-23');
    expect(resultado).toHaveLength(1);
    const item = resultado[0]!;
    expect(item.totalPecas).toBe(1);
    expect(item.pedidos[0]!.clienteNome).toBe('Cliente Fantasia');
    expect(item.envio).toEqual({ dataHora: horaLiberacao, responsavelNome: 'Operador Expedição' });
  });

  it('listarParaLiberacao retorna caminhões elegíveis com status de faturamento', async () => {
    const linhas = [{ id: 'cam-1', placa: 'ABC1234', motorista: 'M1', rota: 'R1', statusCaminhao: 'faturado', dataOperacao: '2026-06-23', statusFaturamento: 'concluido' }];
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => Promise.resolve(linhas),
    };
    const db = { select: jest.fn(() => chain) };
    const caminhaoService = { caminhaoAtivo: jest.fn(), dataOperacaoDoCaminhao: jest.fn() };
    const service = new LiberacaoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    const resultado = await service.listarParaLiberacao('2026-06-23');
    expect(resultado).toEqual(linhas);
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

  function makeExec(selectResponses: unknown[][], updateReturns: unknown[][] = []) {
    let sIdx = 0;
    const select = jest.fn(() => ({
      from: () => ({
        where: () => {
          const rows = selectResponses[sIdx++] ?? [];
          return Promise.resolve(rows);
        },
      }),
    }));
    let uIdx = 0;
    const update = jest.fn(() => ({
      set: () => ({
        where: () => ({
          returning: jest.fn(async () => updateReturns[uIdx++] ?? [{ id: 'x' }]),
        }),
      }),
    }));
    return { select, update };
  }

  it('sincronizarPosEmissao retorna null quando não há itens de carga (pedidoIds vazio)', async () => {
    const faturamento = { id: 'f1', statusFaturamento: 'em_consolidacao', caminhaoId: 'cam-1', deletedAt: null };
    const exec = makeExec([[faturamento], []]);
    const caminhaoService = { caminhaoAtivo: jest.fn(), dataOperacaoDoCaminhao: jest.fn() };
    const service = new LiberacaoService(
      { db: exec } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    await expect(service.sincronizarPosEmissao('cam-1', 'u1')).resolves.toBeNull();
    expect(caminhaoService.caminhaoAtivo).not.toHaveBeenCalled();
  });

  it('sincronizarPosEmissao → sem NF emitida mantém em_consolicao→pronto_para_emitir sem alterar caminhão', async () => {
    const faturamento = { id: 'f1', statusFaturamento: 'em_consolidacao', caminhaoId: 'cam-1', deletedAt: null };
    const exec = makeExec(
      [[faturamento], [{ pedidoVendaId: 'p1' }], []],
      [[{ id: 'f1', statusFaturamento: 'pronto_para_emitir' }]],
    );
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue({ id: 'cam-1', statusCaminhao: 'em_carga' }),
      dataOperacaoDoCaminhao: jest.fn(),
    };
    const db = { ...exec, transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(exec)) };
    const service = new LiberacaoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    const resultado = await service.sincronizarPosEmissao('cam-1', 'u1');
    expect(resultado).toEqual({ statusFaturamento: 'pronto_para_emitir', statusCaminhao: 'em_carga' });
    expect(exec.update).toHaveBeenCalledTimes(1);
  });

  it('sincronizarPosEmissao → emissão parcial não atualiza caminhão (fatAtualizado ausente)', async () => {
    const faturamento = { id: 'f1', statusFaturamento: 'pronto_para_emitir', caminhaoId: 'cam-1', deletedAt: null };
    const exec = makeExec(
      [[faturamento], [{ pedidoVendaId: 'p1' }, { pedidoVendaId: 'p2' }], [{ statusNfse: 'emitida' }]],
      [[]],
    );
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue({ id: 'cam-1', statusCaminhao: 'faturado' }),
      dataOperacaoDoCaminhao: jest.fn(),
    };
    const service = new LiberacaoService(
      { db: exec } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    const resultado = await service.sincronizarPosEmissao('cam-1', 'u1', exec as never);
    expect(resultado).toEqual({ statusFaturamento: 'parcialmente_emitido', statusCaminhao: 'faturado' });
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('sincronizarPosEmissao → conclusão a partir de fechado promove caminhão a faturado', async () => {
    const faturamento = { id: 'f1', statusFaturamento: 'pronto_para_emitir', caminhaoId: 'cam-1', deletedAt: null };
    const exec = makeExec(
      [[faturamento], [{ pedidoVendaId: 'p1' }], [{ statusNfse: 'emitida' }]],
      [[{ id: 'f1', statusFaturamento: 'concluido' }], [{ id: 'cam-1', statusCaminhao: 'faturado' }]],
    );
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue({ id: 'cam-1', statusCaminhao: 'fechado' }),
      dataOperacaoDoCaminhao: jest.fn(),
    };
    const db = { ...exec, transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(exec)) };
    const service = new LiberacaoService(
      { db } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    const resultado = await service.sincronizarPosEmissao('cam-1', 'u1');
    expect(resultado).toEqual({ statusFaturamento: 'concluido', statusCaminhao: 'faturado' });
    expect(exec.update).toHaveBeenCalledTimes(2);
    expect(auditoria.registrar).toHaveBeenCalledTimes(2);
  });

  it('sincronizarPosEmissao → conclusão a partir de liberado_faturamento promove caminhão a faturado', async () => {
    const faturamento = { id: 'f1', statusFaturamento: 'pronto_para_emitir', caminhaoId: 'cam-1', deletedAt: null };
    const exec = makeExec(
      [[faturamento], [{ pedidoVendaId: 'p1' }], [{ statusNfse: 'emitida' }]],
      [[{ id: 'f1', statusFaturamento: 'concluido' }], [{ id: 'cam-1', statusCaminhao: 'faturado' }]],
    );
    const caminhaoService = {
      caminhaoAtivo: jest.fn().mockResolvedValue({ id: 'cam-1', statusCaminhao: 'liberado_faturamento' }),
      dataOperacaoDoCaminhao: jest.fn(),
    };
    const service = new LiberacaoService(
      { db: exec } as never,
      auditoria as never,
      emitter,
      caminhaoService as never,
    );

    const resultado = await service.sincronizarPosEmissao('cam-1', 'u1', exec as never);
    expect(resultado).toEqual({ statusFaturamento: 'concluido', statusCaminhao: 'faturado' });
  });
});
