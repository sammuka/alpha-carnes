import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DivergenciaRecebimentoService } from '../../src/modules/operacao/recebimento/divergencia/divergencia-recebimento.service';

function makeSelectChain(rows: unknown[]) {
  const chain: {
    innerJoin: (...args: unknown[]) => typeof chain;
    where: (...args: unknown[]) => typeof chain;
    then: (cb: (r: unknown[]) => unknown) => unknown;
  } = {
    innerJoin: () => chain,
    where: () => chain,
    then: (cb) => cb(rows),
  };
  return { from: () => chain };
}

describe('DivergenciaRecebimentoService — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  const ocorrencias = { abrirNaTx: jest.fn() };

  function makeService(selectSequence: unknown[][], updateReturn: unknown = { id: 'd1' }) {
    let call = 0;
    const tx = {
      select: jest.fn(() => makeSelectChain(selectSequence[call++] ?? [])),
      update: jest.fn(() => ({
        set: () => ({
          where: () => ({
            returning: jest.fn(async () => [updateReturn]),
          }),
        }),
      })),
      insert: jest.fn(() => ({ values: () => ({ returning: jest.fn(async () => [updateReturn]) }) })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new DivergenciaRecebimentoService({ db } as never, auditoria as never, emitter, ocorrencias as never);
    return { service, tx };
  }

  beforeEach(() => jest.clearAllMocks());

  it('abrirNaTx → lança 404 se item de recebimento não encontrado', async () => {
    const { service, tx } = makeService([]);
    await expect(
      service.abrirNaTx(tx as never, {
        recebimentoId: 'r1',
        recebimentoItemId: 'ri-inexistente',
        tipo: 'PESO',
        descricao: 'x',
      } as never, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('contarAbertasSemTratativa → retorna 0 quando linha ausente', async () => {
    const { service, tx } = makeService([[]]);
    const total = await service.contarAbertasSemTratativa(tx as never, 'r1');
    expect(total).toBe(0);
  });

  it('contarAbertasSemTratativa → retorna total quando linha presente', async () => {
    const { service, tx } = makeService([[{ total: 3 }]]);
    const total = await service.contarAbertasSemTratativa(tx as never, 'r1');
    expect(total).toBe(3);
  });

  it('atualizar → lança 404 se divergência não encontrada', async () => {
    const { service } = makeService([[]]);
    await expect(service.atualizar('d-x', {} as never, 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualizar → lança 409 se já resolvida', async () => {
    const anterior = { id: 'd1', status: 'resolvida', recebimentoId: 'r1' };
    const { service } = makeService([[anterior]]);
    await expect(service.atualizar('d1', {} as never, 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('atualizar → sem dto.status preserva status anterior e não abre ocorrência', async () => {
    const anterior = { id: 'd1', status: 'aberta', recebimentoId: 'r1', impactoOperacional: 'baixo', impactoComercial: 'baixo', acaoImediata: 'nenhuma' };
    const atualizada = { id: 'd1', status: 'aberta', recebimentoId: 'r1', tipo: 'PESO', descricao: 'x' };
    // sequence: anterior, resolverDataOperacao(sem resultado)
    const { service } = makeService([[anterior], []], atualizada);
    const result = await service.atualizar('d1', {} as never, 'u1');
    expect(result).toEqual(atualizada);
    expect(ocorrencias.abrirNaTx).not.toHaveBeenCalled();
  });

  it('atualizar → aguardando_fornecedor com ocorrência já existente não duplica', async () => {
    const anterior = { id: 'd1', status: 'aberta', recebimentoId: 'r1' };
    const atualizada = { id: 'd1', status: 'aguardando_fornecedor', recebimentoId: 'r1', tipo: 'PESO', descricao: 'x' };
    const jaTem = { id: 'oc-existente' };
    // sequence: anterior, resolverDataOperacao(vazio), jaTem(existente)
    const { service } = makeService([[anterior], [], [jaTem]], atualizada);
    const result = await service.atualizar('d1', { status: 'aguardando_fornecedor' } as never, 'u1');
    expect(result).toEqual(atualizada);
    expect(ocorrencias.abrirNaTx).not.toHaveBeenCalled();
  });

  it('atualizar → aguardando_fornecedor sem recebimento vinculado não abre ocorrência', async () => {
    const anterior = { id: 'd1', status: 'aberta', recebimentoId: 'r1' };
    const atualizada = { id: 'd1', status: 'aguardando_fornecedor', recebimentoId: 'r1', tipo: 'PESO', descricao: 'x' };
    // sequence: anterior, resolverDataOperacao(vazio), jaTem(vazio), recebimento(vazio)
    const { service } = makeService([[anterior], [], [], []], atualizada);
    const result = await service.atualizar('d1', { status: 'aguardando_fornecedor' } as never, 'u1');
    expect(result).toEqual(atualizada);
    expect(ocorrencias.abrirNaTx).not.toHaveBeenCalled();
  });

  it('atualizar → aguardando_fornecedor abre ocorrência quando recebimento é encontrado', async () => {
    const anterior = { id: 'd1', status: 'aberta', recebimentoId: 'r1' };
    const atualizada = { id: 'd1', status: 'aguardando_fornecedor', recebimentoId: 'r1', tipo: 'PESO', descricao: 'x', impactoOperacional: null };
    const recebimento = { fornecedorId: 'f1', compraId: 'cp1' };
    ocorrencias.abrirNaTx.mockResolvedValue({ id: 'oc1', fornecedorId: 'f1' });
    // sequence: anterior, resolverDataOperacao(vazio), jaTem(vazio), recebimento(encontrado)
    const { service } = makeService([[anterior], [], [], [recebimento]], atualizada);
    const result = await service.atualizar('d1', { status: 'aguardando_fornecedor' } as never, 'u1');
    expect(result).toEqual(atualizada);
    expect(ocorrencias.abrirNaTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fornecedorId: 'f1', compraProgramadaId: 'cp1', impacto: undefined }),
      'u1',
    );
  });
});
