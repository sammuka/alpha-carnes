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

  it('criar → lança 404 FROTA_NAO_ENCONTRADA se frota inativa/inexistente', async () => {
    const tx = { select: jest.fn(() => makeSelectChain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    operacoesService.garantirOperacao.mockResolvedValue({ operacao: { id: 'op-1' } });
    const service = new CaminhaoService({ db } as never, auditoria as never, operacoesService as never);
    await expect(
      service.criar({ frotaCaminhaoId: 'frota-x', motorista: 'M', dataOperacao: '2026-06-23' } as never, 'u1'),
    ).rejects.toMatchObject({ response: { codigo: 'FROTA_NAO_ENCONTRADA' } });
  });

  it('criar → resolve placa via frota ativa', async () => {
    const frota = { id: 'frota-1', placa: 'FRT-0001', status: 'ativo', deletedAt: null };
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call++;
        return makeSelectChain(call === 1 ? [frota] : []);
      }),
      insert: jest.fn(() => ({
        values: () => ({
          returning: jest.fn(async () => [{ id: 'cam-1', placa: 'FRT-0001', frotaCaminhaoId: 'frota-1' }]),
        }),
      })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    operacoesService.garantirOperacao.mockResolvedValue({ operacao: { id: 'op-1' } });
    const service = new CaminhaoService({ db } as never, auditoria as never, operacoesService as never);
    const result = await service.criar({ frotaCaminhaoId: 'frota-1', motorista: 'M', dataOperacao: '2026-06-23' } as never, 'u1');
    expect(result.placa).toBe('FRT-0001');
  });

  it('detalhar → sem frota e sem vínculos retorna pedidos vazio', async () => {
    const caminhao = { id: 'cam-1', statusCaminhao: 'em_carga', deletedAt: null, frotaCaminhaoId: null };
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => Promise.resolve([]),
      then: (cb: (r: unknown[]) => unknown) => Promise.resolve(cb([caminhao])),
    };
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        selectCall++;
        if (selectCall === 1) return chain; // caminhaoAtivo (via this.db)
        if (selectCall === 2 || selectCall === 3) {
          // somas de peso (peca/subitem) — retornam '0'
          return { from: () => ({ innerJoin: () => ({ where: () => ({ then: (cb: (r: unknown[]) => unknown) => Promise.resolve(cb([{ peso: '0' }])) }) }) }) };
        }
        return chain; // vinculos (orderBy -> [])
      }),
    };
    const service = new CaminhaoService({ db } as never, auditoria as never, operacoesService as never);
    const result = await service.detalhar('cam-1');
    expect(result.caminhao.capacidadeKg).toBeNull();
    expect(result.pedidos).toEqual([]);
  });

  it('detalhar → com frota e vínculos agrega previsto×carregado por pedido', async () => {
    const caminhao = { id: 'cam-1', statusCaminhao: 'em_carga', deletedAt: null, frotaCaminhaoId: 'frota-1' };
    const vinculo = { id: 'vinc-1', caminhaoId: 'cam-1', pedidoVendaId: 'pv1', ordemNaCarga: 1, deletedAt: null };
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        selectCall++;
        switch (selectCall) {
          case 1: // caminhaoAtivo
            return { from: () => ({ where: () => ({ then: (cb: (r: unknown[]) => unknown) => Promise.resolve(cb([caminhao])) }) }) };
          case 2: // capacidadeKg via frota
            return { from: () => ({ where: () => ({ then: (cb: (r: unknown[]) => unknown) => Promise.resolve(cb([{ capacidadeKg: 5000 }])) }) }) };
          case 3: // pesoPecas
          case 4: // pesoSubitens
            return { from: () => ({ innerJoin: () => ({ where: () => ({ then: (cb: (r: unknown[]) => unknown) => Promise.resolve(cb([{ peso: '3.000' }])) }) }) }) };
          case 5: // vinculos
            return { from: () => ({ where: () => ({ orderBy: () => Promise.resolve([vinculo]) }) }) };
          case 6: // itensPedido
            return { from: () => ({ where: () => Promise.resolve([{ pedidoVendaId: 'pv1', quantidadePedida: 10 }]) }) };
          default: // itensCarregados
            return { from: () => ({ where: () => Promise.resolve([{ pedidoVendaId: 'pv1', statusCargaItem: 'em_carga' }]) }) };
        }
      }),
    };
    const service = new CaminhaoService({ db } as never, auditoria as never, operacoesService as never);
    const result = await service.detalhar('cam-1');
    expect(result.caminhao.capacidadeKg).toBe(5000);
    expect(result.pedidos[0]).toMatchObject({ pedidoVendaId: 'pv1', previsto: 10, carregado: 1 });
  });
});
