import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CATALOGO_SIF } from '../../src/modules/gestao/sif/catalogo-sif';
import { SifCalculoService } from '../../src/modules/gestao/sif/sif-calculo.service';
import { SifService } from '../../src/modules/gestao/sif/sif.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

function selectRelatorios(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        orderBy: () => Promise.resolve(rows),
      }),
    }),
  };
}

function selectUltimaVersao(row: unknown[] | null) {
  return {
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(row ?? []),
        }),
      }),
    }),
  };
}

describe('SifService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = { emit: jest.fn() } as unknown as EventEmitter2;
  let calculo: jest.Mocked<Pick<SifCalculoService, 'pendencias' | 'conteudo'>>;

  beforeEach(() => {
    calculo = {
      pendencias: jest.fn().mockResolvedValue([]),
      conteudo: jest.fn().mockResolvedValue({ numeros: {} }),
    };
    jest.clearAllMocks();
  });

  function service(db: object) {
    return new SifService({ db } as never, auditoria as never, emitter, calculo as never);
  }

  it('listar cria relatórios faltantes e atualiza status/pendências', async () => {
    const relatorio = {
      id: 'r1',
      operacaoId: 'op-1',
      tipo: 'mapa_recebimento',
      codigo: 'SIF-01',
      status: 'pendente_dados',
      versaoAtual: 0,
      pendenciasJson: ['x'],
    };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn(() => ({
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        })),
        insert: jest.fn(() => ({ values: () => Promise.resolve(undefined) })),
      })),
      select: jest.fn()
        .mockReturnValueOnce(selectRelatorios([relatorio]))
        .mockReturnValueOnce(selectUltimaVersao([])),
      update: jest.fn(() => ({
        set: () => ({ where: () => Promise.resolve(undefined) }),
      })),
    };

    const res = await service(db).listar('op-1');
    expect(res).toHaveLength(1);
    expect(res[0]?.status).toBe('pronto_para_gerar');
    expect(db.update).toHaveBeenCalled();
  });

  it('gerar bloqueia quando há pendências', async () => {
    calculo.pendencias.mockResolvedValueOnce(['falta dado']);
    const relatorio = {
      id: 'r1',
      operacaoId: 'op-1',
      tipo: 'mapa_recebimento',
      versaoAtual: 0,
      status: 'pendente_dados',
    };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn(() => ({
          from: () => ({
            where: () => ({
              for: () => Promise.resolve([relatorio]),
            }),
          }),
        })),
      })),
    };
    await expect(service(db).gerar('r1', 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('retificar bloqueia sem versão anterior', async () => {
    calculo.pendencias.mockResolvedValueOnce([]);
    const relatorio = {
      id: 'r1',
      operacaoId: 'op-1',
      tipo: 'mapa_recebimento',
      versaoAtual: 0,
    };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn(() => ({
          from: () => ({
            where: () => ({
              for: () => Promise.resolve([relatorio]),
            }),
          }),
        })),
      })),
    };
    await expect(service(db).retificar('r1', 'user-1', 'correção'))
      .rejects.toMatchObject({ response: { codigo: 'SEM_VERSAO_PARA_RETIFICAR' } });
  });

  it('gerar cria versão e emite evento', async () => {
    const relatorio = {
      id: 'r1',
      operacaoId: 'op-1',
      tipo: 'mapa_recebimento',
      versaoAtual: 1,
      status: 'gerado',
    };
    const atualizado = { ...relatorio, versaoAtual: 2, status: 'gerado' };
    const versao = { id: 'v2', versao: 2, tipoGeracao: 'gerado' };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn()
          .mockReturnValueOnce({
            from: () => ({
              where: () => ({
                for: () => Promise.resolve([relatorio]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: () => ({
              where: () => Promise.resolve([{ data: '2026-06-23' }]),
            }),
          }),
        insert: jest.fn(() => ({
          values: () => ({ returning: () => Promise.resolve([versao]) }),
        })),
        update: jest.fn(() => ({
          set: () => ({
            where: () => ({ returning: () => Promise.resolve([atualizado]) }),
          }),
        })),
      })),
    };

    const res = await service(db).gerar('r1', 'user-1');
    expect(res.versao.versao).toBe(2);
    expect(emitter.emit).toHaveBeenCalledWith(
      EVENTOS.RELATORIO_SIF_GERADO,
      expect.objectContaining({ relatorioId: 'r1', versao: 2 }),
    );
  });

  it('preview 404 sem versão gerada', async () => {
    const db = { select: jest.fn(() => selectUltimaVersao([])) };
    await expect(service(db).preview('r1')).rejects.toMatchObject({
      response: { codigo: 'SEM_VERSAO_GERADA' },
    });
  });

  it('versoes lista histórico ordenado', async () => {
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([
                { id: 'v1', versao: 1, tipoGeracao: 'gerado', geradoPorNome: 'Ana' },
              ]),
            }),
          }),
        }),
      })),
    };
    const res = await service(db).versoes('r1');
    expect(res).toHaveLength(1);
  });

  it('gerar 404 quando relatório inexistente', async () => {
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn(() => ({
          from: () => ({
            where: () => ({
              for: () => Promise.resolve([]),
            }),
          }),
        })),
      })),
    };
    await expect(service(db).gerar('r-missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listar não atualiza quando status e pendências permanecem iguais', async () => {
    const relatorio = {
      id: 'r1',
      operacaoId: 'op-1',
      tipo: 'mapa_recebimento',
      codigo: 'SIF-01',
      status: 'pronto_para_gerar',
      versaoAtual: 0,
      pendenciasJson: [],
    };
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn(() => ({
          from: () => ({
            where: () => Promise.resolve([{ id: 'r1' }]),
          }),
        })),
        insert: jest.fn(),
      })),
      select: jest.fn()
        .mockReturnValueOnce(selectRelatorios([relatorio]))
        .mockReturnValueOnce(selectUltimaVersao([])),
      update: jest.fn(),
    };

    const res = await service(db).listar('op-1');
    expect(res).toHaveLength(1);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('listar sincroniza todos os tipos do catálogo', async () => {
    const relatorios = CATALOGO_SIF.map((def, i) => ({
      id: `r${i}`,
      operacaoId: 'op-1',
      tipo: def.tipo,
      codigo: def.codigo,
      status: 'gerado',
      versaoAtual: 1,
      pendenciasJson: [],
    }));
    let ultimaCall = 0;
    const db = {
      transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({
        select: jest.fn(() => ({
          from: () => ({
            where: () => Promise.resolve([{ id: 'existente' }]),
          }),
        })),
        insert: jest.fn(),
      })),
      select: jest.fn((...args: unknown[]) => {
        if (ultimaCall === 0) {
          ultimaCall += 1;
          return selectRelatorios(relatorios);
        }
        return selectUltimaVersao([{ tipoGeracao: 'gerado', versao: 1 }]);
      }),
      update: jest.fn(),
    };

    const res = await service(db).listar('op-1');
    expect(res).toHaveLength(CATALOGO_SIF.length);
  });
});
