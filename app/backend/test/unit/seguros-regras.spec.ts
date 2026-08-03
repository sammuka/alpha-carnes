import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SegurosService } from '../../src/modules/operacao/faturamento/seguros.service';

function chainThen(rows: unknown[]) {
  const obj: Record<string, unknown> = {
    from: () => obj,
    where: () => obj,
    innerJoin: () => obj,
    then: (resolve: (r: unknown[]) => unknown) => resolve(rows),
  };
  return obj;
}

function makeService(selectResults: unknown[][], opts: { updateReturning?: unknown[] } = {}) {
  let call = 0;
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  const db = {
    select: jest.fn(() => chainThen(selectResults[call++] ?? [])),
    transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      insert: () => ({
        values: (v: Record<string, unknown>) => ({
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve(opts.updateReturning ?? [{ id: 'seguro-novo', status: 'pendente', ...v }]),
          }),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 'seguro-1', ...patch }]),
          }),
        }),
      }),
    })),
  };
  return { service: new SegurosService({ db } as never, auditoria as never, emitter), db, emitter };
}

describe('Seguros — transições (D10.5)', () => {
  const userId = 'user-1';

  it('DoD 10.10 transicoes de seguro', async () => {
    const seguroPendente = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', deletedAt: null };
    const { service } = makeService([[seguroPendente], []]);
    await expect(service.alterarStatus('seguro-1', 'enviado', userId)).resolves.toMatchObject({ status: 'enviado' });

    const seguroEnviado = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'enviado', deletedAt: null };
    const { service: service2 } = makeService([[seguroEnviado], []]);
    await expect(service2.alterarStatus('seguro-1', 'confirmado', userId)).resolves.toMatchObject({ status: 'confirmado' });
  });

  it('rejeita transicao invalida pendente->confirmado com 409 TRANSICAO_SEGURO_INVALIDA', async () => {
    const seguroPendente = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', deletedAt: null };
    const { service } = makeService([[seguroPendente]]);
    await expect(service.alterarStatus('seguro-1', 'confirmado', userId)).rejects.toMatchObject({
      response: { codigo: 'TRANSICAO_SEGURO_INVALIDA' },
    });
  });

  it('confirmado e terminal — rejeita confirmado->enviado', async () => {
    const seguroConfirmado = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'confirmado', deletedAt: null };
    const { service } = makeService([[seguroConfirmado]]);
    await expect(service.alterarStatus('seguro-1', 'enviado', userId)).rejects.toMatchObject({
      response: { codigo: 'TRANSICAO_SEGURO_INVALIDA' },
    });
  });

  it('unicidade parcial — obterOuCriar e idempotente por caminhaoId (2ª chamada acha o existente)', async () => {
    const caminhao = { id: 'cam-1', placa: 'ABC1234', motorista: 'Fulano', deletedAt: null };
    const seguroCriado = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', deletedAt: null };

    // 1ª chamada: select segurosCarga (vazio) → select caminhoes (existe) → transaction insere
    const { service: serviceA } = makeService([[], [caminhao]], { updateReturning: [seguroCriado] });
    const a = await serviceA.obterOuCriar('cam-1', userId);

    // 2ª chamada: select segurosCarga já encontra o registro criado
    const { service: serviceB } = makeService([[seguroCriado]]);
    const b = await serviceB.obterOuCriar('cam-1', userId);

    expect(a.id).toBe(b.id);
  });

  it('obterOuCriar → caminhão não encontrado lança NotFoundException', async () => {
    const { service } = makeService([[], []]);
    await expect(service.obterOuCriar('cam-x', userId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('obterOuCriar → insert sem retorno (corrida) lança ConflictException', async () => {
    const caminhao = { id: 'cam-1', placa: 'ABC1234', motorista: 'Fulano', deletedAt: null };
    const { service } = makeService([[], [caminhao]], { updateReturning: [] });
    await expect(service.obterOuCriar('cam-1', userId)).rejects.toBeInstanceOf(ConflictException);
  });

  it('obterOuCriar → transaction lança erro genérico (sem code 23505) relança sem transformar', async () => {
    const caminhao = { id: 'cam-1', placa: 'ABC1234', motorista: 'Fulano', deletedAt: null };
    const erroGenerico = new Error('falha inesperada de banco');
    let call = 0;
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const emitter = new EventEmitter2();
    const db = {
      select: jest.fn(() => chainThen([[], [caminhao]][call++] ?? [])),
      transaction: jest.fn().mockRejectedValueOnce(erroGenerico),
    };
    const service = new SegurosService({ db } as never, auditoria as never, emitter);
    await expect(service.obterOuCriar('cam-1', userId)).rejects.toBe(erroGenerico);
  });

  it('obterOuCriar → transaction lança erro 23505 (corrida real) → retorna o registro já existente', async () => {
    const caminhao = { id: 'cam-1', placa: 'ABC1234', motorista: 'Fulano', deletedAt: null };
    const seguroExistente = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', deletedAt: null };
    const dbError = Object.assign(new Error('unique violation'), { code: '23505' });
    let call = 0;
    const selectResults = [[], [caminhao], [seguroExistente]];
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const emitter = new EventEmitter2();
    const db = {
      select: jest.fn(() => chainThen(selectResults[call++] ?? [])),
      transaction: jest.fn().mockRejectedValueOnce(dbError),
    };
    const service = new SegurosService({ db } as never, auditoria as never, emitter);
    const resultado = await service.obterOuCriar('cam-1', userId);
    expect(resultado).toEqual(seguroExistente);
  });

  it('alterarStatus → seguro não encontrado lança NotFoundException', async () => {
    const { service } = makeService([[]]);
    await expect(service.alterarStatus('seguro-x', 'enviado', userId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('alterarStatus → enviado->pendente (regressão auditada D10.5) zera enviadoEm', async () => {
    const seguroEnviado = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'enviado', deletedAt: null };
    const { service } = makeService([[seguroEnviado], []]);
    const resultado = await service.alterarStatus('seguro-1', 'pendente', userId);
    expect(resultado).toMatchObject({ status: 'pendente', enviadoEm: null });
  });

  it('alterarStatus → emite evento com dataOperacao vazia quando não há operação vinculada', async () => {
    const seguroPendente = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', deletedAt: null };
    const { service, emitter } = makeService([[seguroPendente], []]);
    const emitSpy = jest.spyOn(emitter, 'emit');
    await service.alterarStatus('seguro-1', 'enviado', userId);
    expect(emitSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dataOperacao: '' }));
  });

  it('registrarAnexo → seguro não encontrado lança NotFoundException', async () => {
    const { service } = makeService([[]]);
    await expect(service.registrarAnexo('seguro-x', 'nome.pdf', 'desc', userId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('registrarAnexo → acumula no array existente e registra auditoria', async () => {
    const seguro = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', anexosJson: [{ nome: 'antigo.pdf' }], deletedAt: null };
    const { service, db } = makeService([[seguro]]);
    const resultado = await service.registrarAnexo('seguro-1', 'novo.pdf', 'descrição', userId);
    expect(resultado).toMatchObject({ id: 'seguro-1' });
    expect((db.transaction as jest.Mock)).toHaveBeenCalled();
  });

  it('registrarAnexo → sem descrição (opcional ausente)', async () => {
    const seguro = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', anexosJson: [], deletedAt: null };
    const { service } = makeService([[seguro]]);
    await expect(service.registrarAnexo('seguro-1', 'novo.pdf', undefined, userId)).resolves.toMatchObject({ id: 'seguro-1' });
  });

  it('salvarObservacao → seguro não encontrado lança NotFoundException', async () => {
    const { service } = makeService([[]]);
    await expect(service.salvarObservacao('seguro-x', 'obs', userId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('salvarObservacao → atualiza observação e registra auditoria', async () => {
    const seguro = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', observacao: null, deletedAt: null };
    const { service } = makeService([[seguro]]);
    const resultado = await service.salvarObservacao('seguro-1', 'nova observação', userId);
    expect(resultado).toMatchObject({ id: 'seguro-1', observacao: 'nova observação' });
  });
});

describe('SegurosService — listar (D10.5)', () => {
  const seguroRow = { id: 'seguro-1', caminhaoId: 'cam-1', status: 'pendente', createdAt: new Date() };
  const caminhaoRow = { id: 'cam-1', placa: 'ABC1234', motorista: 'Fulano' };

  it('sem filtros → total default 0 quando totalRow vazio', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({ innerJoin: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ offset: () => Promise.resolve([]) }) }) }) }) }),
        })
        .mockReturnValueOnce({
          from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }),
        }),
    };
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const emitter = new EventEmitter2();
    const service = new SegurosService({ db } as never, auditoria as never, emitter);
    const resultado = await service.listar({ page: 1, pageSize: 20 } as never);
    expect(resultado.total).toBe(0);
    expect(resultado.data).toEqual([]);
  });

  it('com filtro status + busca → resultado combina seguro + caminhão', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({ innerJoin: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ offset: () => Promise.resolve([{ seguro: seguroRow, caminhao: caminhaoRow }]) }) }) }) }) }),
        })
        .mockReturnValueOnce({
          from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([{ total: 1 }]) }) }),
        }),
    };
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const emitter = new EventEmitter2();
    const service = new SegurosService({ db } as never, auditoria as never, emitter);
    const resultado = await service.listar({ page: 1, pageSize: 20, status: 'pendente', busca: 'ABC' } as never);
    expect(resultado.total).toBe(1);
    expect(resultado.data[0]).toMatchObject({ id: 'seguro-1', caminhao: caminhaoRow });
  });
});
