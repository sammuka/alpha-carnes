import { DisponibilidadeService } from '../../src/modules/comercial/disponibilidade/disponibilidade.service';

describe('DisponibilidadeService — branches', () => {
  function makeChain(rows: unknown[]) {
    const chain: {
      innerJoin: (...args: unknown[]) => typeof chain;
      where: (...args: unknown[]) => typeof chain;
      groupBy: (...args: unknown[]) => typeof chain;
      orderBy: (...args: unknown[]) => Promise<unknown[]>;
      from: (...args: unknown[]) => typeof chain;
    } = {
      innerJoin: () => chain,
      where: () => chain,
      groupBy: () => chain,
      orderBy: () => Promise.resolve(rows),
      from: () => chain,
    };
    return chain;
  }

  const auditoria = { registrar: jest.fn() };

  function serviceWithDb(db: object) {
    return new DisponibilidadeService({ db } as never, auditoria as never);
  }

  beforeEach(() => {
    auditoria.registrar.mockReset();
  });

  it('listar → com dataOperacao e compraProgramadaId aplica os dois filtros', async () => {
    const chain = makeChain([{ id: 'd1' }]);
    const db = { select: jest.fn(() => chain) };
    const result = await serviceWithDb(db).listar({ dataOperacao: '2026-06-23', compraProgramadaId: 'cp1' } as never);
    expect(result).toEqual([{ id: 'd1' }]);
  });

  it('listar → sem dataOperacao mas com compraProgramadaId filtra por compra', async () => {
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([{ id: 'd2' }]),
          }),
        }),
      })),
    };
    const result = await serviceWithDb(db).listar({ compraProgramadaId: 'cp1' } as never);
    expect(result).toEqual([{ id: 'd2' }]);
    expect(db.select).toHaveBeenCalled();
  });

  it('listar → sem compraProgramadaId agrega por data da operacao', async () => {
    const chain = makeChain([]);
    const db = { select: jest.fn(() => chain) };
    const result = await serviceWithDb(db).listar({ dataOperacao: '2026-12-20' } as never);
    expect(result).toEqual([]);
    expect(db.select).toHaveBeenCalled();
  });

  it('listar → agregado filtra só por operacaoId', async () => {
    const chain = makeChain([{ modo: 'agregado', operacaoId: 'op1' }]);
    const db = { select: jest.fn(() => chain) };
    const result = await serviceWithDb(db).listar({
      operacaoId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    } as never);
    expect(result).toEqual([{ modo: 'agregado', operacaoId: 'op1' }]);
  });

  it('listar → agregado aplica operacaoId e dataOperacao juntos', async () => {
    const chain = makeChain([{ modo: 'agregado' }]);
    const db = { select: jest.fn(() => chain) };
    const result = await serviceWithDb(db).listar({
      operacaoId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      dataOperacao: '2026-12-20',
    } as never);
    expect(result).toEqual([{ modo: 'agregado' }]);
  });

  it('listar → agregado sem operacaoId nem dataOperacao ainda consulta', async () => {
    const chain = makeChain([]);
    const db = { select: jest.fn(() => chain) };
    const result = await serviceWithDb(db).listar({} as never);
    expect(result).toEqual([]);
  });

  it('gerarParaCompra → sem linhas não audita', async () => {
    const tx = { execute: jest.fn().mockResolvedValue({ rows: [] }) };
    const compra = { id: 'cp1', operacaoId: 'op1', usuarioConfirmacaoId: 'u1' };
    const result = await serviceWithDb({}).gerarParaCompra(tx as never, compra as never);
    expect(result).toEqual([]);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('gerarParaCompra → audita cada linha inserida', async () => {
    const tx = {
      execute: jest.fn().mockResolvedValue({
        rows: [{ id: 'd1', produto_id: 'ic1', quantidade_total_gerada: '10.000' }],
      }),
    };
    const compra = { id: 'cp1', operacaoId: 'op1', usuarioConfirmacaoId: 'u1' };
    const result = await serviceWithDb({}).gerarParaCompra(tx as never, compra as never);
    expect(result).toEqual([{ id: 'd1', produtoId: 'ic1', quantidadeTotalGerada: '10.000' }]);
    expect(auditoria.registrar).toHaveBeenCalledTimes(1);
  });

  it('listarEsperadoDaCompra → devolve as linhas da compra', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([{ disponibilidadeId: 'd1', produtoId: 'ic1', quantidadeTotalGerada: '6' }]),
        }),
      })),
    };
    const result = await serviceWithDb({}).listarEsperadoDaCompra(tx as never, 'cp1');
    expect(result).toHaveLength(1);
    expect(result[0]?.disponibilidadeId).toBe('d1');
  });

  it('aplicarRecebimentoDelta → retorna null quando não há disponibilidade', async () => {
    const tx = { execute: jest.fn().mockResolvedValue({ rows: [] }) };
    const result = await serviceWithDb({}).aplicarRecebimentoDelta(tx as never, {
      compraProgramadaId: 'cp1',
      produtoId: 'ic1',
      deltaRecebido: '1',
      deltaComDivergencia: '0',
    });
    expect(result).toBeNull();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('aplicarRecebimentoDelta → atualiza e audita quando há linha', async () => {
    const tx = {
      execute: jest.fn().mockResolvedValue({
        rows: [{ id: 'd1', quantidade_recebida: '6.000', quantidade_com_divergencia: '0.000' }],
      }),
    };
    const result = await serviceWithDb({}).aplicarRecebimentoDelta(
      tx as never,
      { compraProgramadaId: 'cp1', produtoId: 'ic1', deltaRecebido: '6', deltaComDivergencia: '0' },
      'u1',
    );
    expect(result).toEqual({ quantidadeRecebida: '6.000', quantidadeComDivergencia: '0.000' });
    expect(auditoria.registrar).toHaveBeenCalledTimes(1);
  });

  it('listarPedidosEmRisco → mapeia as linhas SQL', async () => {
    const tx = {
      execute: jest.fn().mockResolvedValue({
        rows: [{
          pedido_id: 'pv1',
          produto_id: 'ic1',
          quantidade_reservada: '6.000',
          quantidade_recebida: '4.000',
        }],
      }),
    };
    const result = await serviceWithDb({}).listarPedidosEmRisco(tx as never, 'op1', 'ic1');
    expect(result).toEqual([{
      pedidoId: 'pv1',
      produtoId: 'ic1',
      quantidadeReservada: '6.000',
      quantidadeRecebida: '4.000',
    }]);
  });

  it('projetarImpacto → simulação vazia usa override SQL vazio e saldo sem déficit', async () => {
    const tx = {
      execute: jest.fn().mockResolvedValue({
        rows: [{
          produto_id: 'ic1',
          codigo: 'TZ',
          descricao: 'Traseiro',
          gerada_atual: '10',
          gerada_projetada: '20',
          reservada: '5',
          saldo_atual: '10',
        }],
      }),
    };
    const result = await serviceWithDb({}).projetarImpacto(tx as never, 'cp1', new Map());
    expect(result[0]?.saldoProjetado).toBe('15.000');
    expect(result[0]?.deficitProjetado).toBe('0.000');
    expect(result[0]?.delta).toBe('10.000');
  });

  it('projetarImpacto → simulação com override e déficit quando reservada > projetada', async () => {
    const tx = {
      execute: jest.fn().mockResolvedValue({
        rows: [{
          produto_id: 'ic1',
          codigo: 'TZ',
          descricao: 'Traseiro',
          gerada_atual: '20',
          gerada_projetada: '10',
          reservada: '15',
          saldo_atual: '5',
        }],
      }),
    };
    const result = await serviceWithDb({}).projetarImpacto(
      tx as never,
      'cp1',
      new Map([['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1', '4']]),
    );
    expect(result[0]?.saldoProjetado).toBe('0.000');
    expect(result[0]?.deficitProjetado).toBe('5.000');
  });

  it('recalcularParaCompra → audita com anterior encontrado e sem anterior', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([{ id: 'd1' }]),
        }),
      })),
      execute: jest.fn().mockResolvedValue({
        rows: [
          { id: 'd1', produto_id: 'ic1', quantidade_total_gerada: '10', quantidade_reservada: '0', quantidade_disponivel: '10', status: 'gerada' },
          { id: 'd2', produto_id: 'ic2', quantidade_total_gerada: '4', quantidade_reservada: '1', quantidade_disponivel: '3', status: 'parcialmente_reservada' },
        ],
      }),
    };
    await serviceWithDb({}).recalcularParaCompra(
      tx as never,
      { id: 'cp1' } as never,
      'u1',
    );
    expect(auditoria.registrar).toHaveBeenCalledTimes(2);
    expect(auditoria.registrar.mock.calls[0][1].dadosAnteriores).toEqual({ id: 'd1' });
    expect(auditoria.registrar.mock.calls[1][1].dadosAnteriores).toEqual({});
  });
});
