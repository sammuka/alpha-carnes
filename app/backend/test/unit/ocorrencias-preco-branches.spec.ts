import { ConflictException, NotFoundException } from '@nestjs/common';
import { OcorrenciasPrecoService } from '../../src/modules/comercial/ocorrencias-preco/ocorrencias-preco.service';

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

describe('OcorrenciasPrecoService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = { emit: jest.fn() };

  function make(db: Record<string, unknown>) {
    return new OcorrenciasPrecoService({ db } as never, auditoria as never, emitter as never);
  }

  it('listar com filtros e total vazio usa 0', async () => {
    const svc = make({ select: jest.fn(() => chain([])) });
    const result = await svc.listar({
      operacaoId: 'op1',
      status: 'aberta',
      clienteId: 'c1',
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
      page: 1,
      pageSize: 20,
    } as never);
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('detalhar → 404', async () => {
    const svc = make({ select: jest.fn(() => chain([])) });
    await expect(svc.detalhar('o-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marcarCiente → 404 se ocorrência não existe', async () => {
    const tx = { select: jest.fn(() => chain([])) };
    const svc = make({ transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) });
    await expect(svc.marcarCiente('o-x', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marcarCiente → 409 se já ciente', async () => {
    const tx = { select: jest.fn(() => chain([{ id: 'o1', status: 'ciente' }])) };
    const svc = make({ transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) });
    await expect(svc.marcarCiente('o1', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('marcarCiente → Error se update não devolve linha', async () => {
    const tx = {
      select: jest.fn(() => chain([{ id: 'o1', status: 'aberta' }])),
      update: jest.fn(() => ({
        set: () => ({ where: () => ({ returning: async () => [] }) }),
      })),
    };
    const svc = make({ transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) });
    await expect(svc.marcarCiente('o1', 'u1')).rejects.toThrow('Falha ao marcar ocorrência como ciente');
  });

  it('relatorio com filtros e página vazia não busca itens', async () => {
    const select = jest.fn(() => chain([]));
    const svc = make({ select });
    const result = await svc.relatorio({
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
      clienteId: 'c1',
      representanteId: 'r1',
      faixaPreco: 'A',
      produtoId: 'p1',
      page: 1,
      pageSize: 20,
    } as never);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('relatorio com página e itens vazios usa [] e total 0', async () => {
    const pagina = [{
      ocorrenciaId: 'o1',
      pedidoVendaId: 'p1',
      clienteNomeFantasia: 'Cli',
      representanteNome: 'Rep',
      dataPedido: '2026-01-01',
      faixaPreco: 'A',
      quantidadeItensAjustados: 1,
      valorTotalAjustado: '1.50',
    }];
    const select = jest.fn()
      .mockImplementationOnce(() => chain(pagina))
      .mockImplementationOnce(() => chain([]))
      .mockImplementationOnce(() => chain([]));
    const svc = make({ select });
    const result = await svc.relatorio({
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
      page: 1,
      pageSize: 20,
    } as never);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.itens).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('marcarCiente sucesso com operação ausente emite data vazia', async () => {
    const ocorrencia = { id: 'o1', status: 'aberta', pedidoVendaId: 'p1', clienteId: 'c1' };
    const atualizada = { ...ocorrencia, status: 'ciente' };
    const cabecalho = {
      id: 'o1',
      pedidoVendaId: 'p1',
      clienteNomeFantasia: 'Cli',
      status: 'ciente',
      dataHoraOcorrencia: new Date('2026-01-01T12:00:00Z'),
      usuarioFinalizacaoNome: 'U',
      quantidadeItensAjustados: 1,
      diferencaTotal: '1.00',
      usuarioCienteNome: 'G',
      dataHoraCiente: null,
    };
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => chain([ocorrencia]))
        .mockImplementationOnce(() => chain([])),
      update: jest.fn(() => ({
        set: () => ({ where: () => ({ returning: async () => [atualizada] }) }),
      })),
    };
    const db = {
      transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      select: jest.fn()
        .mockImplementationOnce(() => chain([cabecalho]))
        .mockImplementationOnce(() => chain([])),
    };
    const svc = make(db);
    const detalhe = await svc.marcarCiente('o1', 'u1');
    expect(detalhe.dataHoraCiente).toBeNull();
    expect(emitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ dataOperacao: '' }),
    );
  });
});
