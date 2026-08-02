/**
 * Testes de branch (mocks, sem DB) para AjustesEstoqueService e DestinarEstoqueService:
 * limiar de aprovação, segregação criador≠aprovador, aplicação física (D8.10) e
 * DoD 8.15 — rollback na transação de destinar não emite evento.
 */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AjustesEstoqueService } from '../../src/modules/operacao/estoque/ajustes.service';
import { DestinarEstoqueService } from '../../src/modules/operacao/estoque/destinar.service';

function makeEmitter() {
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  return emitter;
}

function makeAuditoria() {
  return { registrar: jest.fn() };
}

/**
 * Chain thenable genérica: cada método devolve a própria chain (encadeável em
 * qualquer ordem) e resolve para `rows` quando `await`ada ou via `.then()`.
 */
function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> & PromiseLike<unknown[]> = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    for: () => chain,
    then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  } as never;
  return chain;
}

function makeUpdateChain(returning: unknown[]) {
  return {
    set: () => ({
      where: () => ({
        returning: jest.fn(async () => returning),
      }),
    }),
  };
}

function makeInsertChain(returning: unknown[]) {
  return {
    values: () => ({
      returning: jest.fn(async () => returning),
    }),
  };
}

describe('AjustesEstoqueService — limiar, segregação e aplicação (D8.8/8.9/8.10)', () => {
  const entrada = { id: 'e1', quantidade: 20, quantidadeDestinada: 0, produtoId: 'p1', deletedAt: null };

  function makeAprovacoesMock() {
    return { abrirNaTx: jest.fn(async () => ({ id: 'aprov1' })) };
  }

  it('|delta| dentro do limiar → aplica imediatamente (status aplicado, sem abrirNaTx)', async () => {
    let selectCall = 0;
    const selectResponses = [
      [entrada], // capturarAlvo: SELECT entrada FOR UPDATE
      [{ codigo: 'CXMIU' }], // codigo do produto (subselect via limit(1))
      [{ valorJson: { valor: 5 } }], // lerLimiar
    ];
    const insertReturning = [{
      id: 'a1', tipoAlvo: 'entrada', entradaId: 'e1', pecaId: null, subitemId: null,
      quantidadeDelta: -3, quantidadeAnterior: 20, status: 'aplicado', aprovacaoOperacionalId: null,
    }];
    const executeResult = { rows: [{ id: 'e1' }] };
    const tx = {
      select: jest.fn(() => makeChain(selectResponses[selectCall++] ?? [])),
      insert: jest.fn(() => makeInsertChain(insertReturning)),
      execute: jest.fn(async () => executeResult),
    };
    const db = { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)) };
    const aprovacoes = makeAprovacoesMock();
    const emitter = makeEmitter();
    const service = new AjustesEstoqueService(
      { db } as never, makeAuditoria() as never, emitter, aprovacoes as never,
    );

    const resultado = await service.criar(
      { tipo: 'entrada', id: 'e1', quantidadeDelta: -3, motivo: 'quebra' },
      'user1',
    );

    expect(resultado.status).toBe('aplicado');
    expect(aprovacoes.abrirNaTx).not.toHaveBeenCalled();
    expect(tx.execute).toHaveBeenCalledTimes(1); // aplicação física da entrada
    expect(emitter.emit).toHaveBeenCalledWith('ajuste_estoque_criado', expect.objectContaining({ ajusteId: 'a1' }));
  });

  it('|delta| acima do limiar → aguardando_aprovacao + abrirNaTx chamado + SEM efeito físico', async () => {
    let selectCall = 0;
    const selectResponses = [
      [entrada],
      [{ codigo: 'CXMIU' }],
      [{ valorJson: { valor: 5 } }],
      [{ id: 'op1' }], // operacaoAtualId
    ];
    const insertReturning = [{
      id: 'a2', tipoAlvo: 'entrada', entradaId: 'e1', pecaId: null, subitemId: null,
      quantidadeDelta: -8, quantidadeAnterior: 20, status: 'aguardando_aprovacao', aprovacaoOperacionalId: 'aprov1',
    }];
    const tx = {
      select: jest.fn(() => makeChain(selectResponses[selectCall++] ?? [])),
      insert: jest.fn(() => makeInsertChain(insertReturning)),
      execute: jest.fn(async () => ({ rows: [] })),
    };
    const db = { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)) };
    const aprovacoes = makeAprovacoesMock();
    const service = new AjustesEstoqueService(
      { db } as never, makeAuditoria() as never, makeEmitter(), aprovacoes as never,
    );

    const resultado = await service.criar(
      { tipo: 'entrada', id: 'e1', quantidadeDelta: -8, motivo: 'erro_contagem' },
      'user1',
    );

    expect(resultado.status).toBe('aguardando_aprovacao');
    expect(aprovacoes.abrirNaTx).toHaveBeenCalledTimes(1);
    expect(aprovacoes.abrirNaTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ tipo: 'ajuste_estoque_relevante', operacaoId: 'op1' }),
      'user1',
    );
    expect(tx.execute).not.toHaveBeenCalled(); // sem efeito físico
  });

  it('decidir → criador tenta aprovar o próprio ajuste → 403 SEGREGACAO_CRIADOR_APROVADOR', async () => {
    const ajustePendente = {
      id: 'a1', status: 'aguardando_aprovacao', criadoPor: 'user1',
      tipoAlvo: 'entrada', entradaId: 'e1', aprovacaoOperacionalId: 'aprov1',
    };
    const tx = { select: jest.fn(() => makeChain([ajustePendente])) };
    const db = { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new AjustesEstoqueService(
      { db } as never, makeAuditoria() as never, makeEmitter(), makeAprovacoesMock() as never,
    );

    await expect(service.aprovar('a1', 'user1')).rejects.toThrow(ForbiddenException);
    await expect(service.aprovar('a1', 'user1')).rejects.toMatchObject({
      response: expect.objectContaining({ codigo: 'SEGREGACAO_CRIADOR_APROVADOR' }),
    });
  });

  it('aplicarNaTx entrada: saldo insuficiente (0 linhas) → 409 SALDO_INSUFICIENTE', async () => {
    const ajustePendente = {
      id: 'a1', status: 'aguardando_aprovacao', criadoPor: 'user1',
      tipoAlvo: 'entrada', entradaId: 'e1', quantidadeDelta: -50, aprovacaoOperacionalId: null,
    };
    const tx = {
      select: jest.fn(() => makeChain([ajustePendente])),
      execute: jest.fn(async () => ({ rows: [] })), // UPDATE condicional falhou
    };
    const db = { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new AjustesEstoqueService(
      { db } as never, makeAuditoria() as never, makeEmitter(), makeAprovacoesMock() as never,
    );

    await expect(service.aprovar('a1', 'gestor1')).rejects.toThrow(ConflictException);
    await expect(service.aprovar('a1', 'gestor1')).rejects.toMatchObject({
      response: expect.objectContaining({ codigo: 'SALDO_INSUFICIENTE' }),
    });
  });

  it('aplicarNaTx peça: delta ≠ -1 → 409 AJUSTE_INVALIDO_PARA_PECA (peça nunca é criada)', async () => {
    const ajustePendente = {
      id: 'a1', status: 'aguardando_aprovacao', criadoPor: 'user1',
      tipoAlvo: 'peca', pecaId: 'p1', quantidadeDelta: 1, aprovacaoOperacionalId: null,
    };
    const tx = { select: jest.fn(() => makeChain([ajustePendente])) };
    const db = { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new AjustesEstoqueService(
      { db } as never, makeAuditoria() as never, makeEmitter(), makeAprovacoesMock() as never,
    );

    await expect(service.aprovar('a1', 'gestor1')).rejects.toMatchObject({
      response: expect.objectContaining({ codigo: 'AJUSTE_INVALIDO_PARA_PECA' }),
    });
  });

  it('aplicarNaTx peça: delta = -1 mas UPDATE não afeta linha (não em_sobra) → 409 AJUSTE_INVALIDO_PARA_PECA', async () => {
    const ajustePendente = {
      id: 'a1', status: 'aguardando_aprovacao', criadoPor: 'user1',
      tipoAlvo: 'peca', pecaId: 'p1', quantidadeDelta: -1, aprovacaoOperacionalId: null,
    };
    const tx = {
      select: jest.fn(() => makeChain([ajustePendente])),
      update: jest.fn(() => makeUpdateChain([])), // 0 linhas retornadas
    };
    const db = { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new AjustesEstoqueService(
      { db } as never, makeAuditoria() as never, makeEmitter(), makeAprovacoesMock() as never,
    );

    await expect(service.aprovar('a1', 'gestor1')).rejects.toMatchObject({
      response: expect.objectContaining({ codigo: 'AJUSTE_INVALIDO_PARA_PECA' }),
    });
  });
});

describe('DestinarEstoqueService — DoD 8.15: rollback não emite evento', () => {
  it('falha dentro da transação de destinar → zero evento emitido', async () => {
    const emitter = makeEmitter();
    const db = {
      transaction: jest.fn(async () => {
        throw new ConflictException({ codigo: 'ITEM_NAO_DISPONIVEL', mensagem: 'Peça não está disponível em estoque' });
      }),
    };
    const service = new DestinarEstoqueService({ db } as never, makeAuditoria() as never, emitter);

    await expect(
      service.destinar({ tipo: 'peca', id: 'p1', pedidoVendaItemId: 'pvi1' }, 'user1'),
    ).rejects.toThrow(ConflictException);

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('destinarPeca: peça já associada (não em_sobra) → 409 sem consumir saldo nem emitir evento', async () => {
    const pecaAssociada = { id: 'p1', statusPeca: 'associada', itemComercialBaseId: 'ic1', recebimentoId: 'r1', deletedAt: null };
    const tx = { select: jest.fn(() => makeChain([pecaAssociada])) };
    const emitter = makeEmitter();
    const db = { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)) };
    const service = new DestinarEstoqueService({ db } as never, makeAuditoria() as never, emitter);

    await expect(
      service.destinar({ tipo: 'peca', id: 'p1', pedidoVendaItemId: 'pvi1' }, 'user1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ codigo: 'ITEM_NAO_DISPONIVEL' }) });

    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
