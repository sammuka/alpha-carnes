/**
 * Testes de branch para CorteService e SubitemService.
 * Cobrem ramos não alcançados pelos e2e (mocks sem DB).
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CorteService } from '../../src/modules/operacao/corte/corte.service';
import { SubitemService } from '../../src/modules/operacao/corte/subitem.service';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEmitter() {
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  return emitter;
}

function makeAuditoria() {
  return { registrar: jest.fn() };
}

/**
 * Cria um select-chain mock que retorna `rows` ao final da cadeia.
 * Suporta encadeamentos arbitrários de .where(), .orderBy(), .innerJoin().
 */
function makeSelectChain(rows: unknown[]) {
  const terminal: {
    then: (cb: (r: unknown[]) => unknown) => unknown;
    orderBy: (...args: unknown[]) => typeof terminal;
    where: (...args: unknown[]) => typeof terminal;
    innerJoin: (...args: unknown[]) => typeof terminal;
  } = {
    then: (cb) => cb(rows),
    orderBy: function() { return terminal; },
    where: function() { return terminal; },
    innerJoin: function() { return terminal; },
  };
  return {
    from: (_tbl?: unknown) => terminal,
  };
}

/**
 * Cria db mock cujas transações executam fn(tx) diretamente.
 * Cada chamada a select() avança para a próxima resposta da sequência.
 */
function makeDb(
  txSelectResponses: unknown[][],
  directSelectResponses: unknown[][] = [],
  updateReturning: unknown = { id: 'u' },
) {
  // tx select (usado dentro de transaction)
  let txIdx = 0;
  const txSelect = jest.fn((_tbl?: unknown) => makeSelectChain(txSelectResponses[txIdx++] ?? []));
  const txUpdate = jest.fn((_tbl?: unknown) => ({
    set: (_v?: unknown) => ({
      where: (_c?: unknown) => ({
        returning: jest.fn(async () => [updateReturning]),
      }),
    }),
  }));
  const txInsert = jest.fn((_tbl?: unknown) => ({
    values: (_v?: unknown) => ({ returning: jest.fn(async () => [{ id: 'new' }]) }),
  }));
  const tx = { select: txSelect, update: txUpdate, insert: txInsert };

  // direct select (usado fora de transaction, e.g. this.db.select())
  let dIdx = 0;
  const directSelect = jest.fn((_tbl?: unknown) => makeSelectChain(directSelectResponses[dIdx++] ?? []));

  const db = {
    transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    select: directSelect,
    update: txUpdate,
  };
  return { db, tx };
}

// ── CorteService ──────────────────────────────────────────────────────────────

describe('CorteService — branches unitários', () => {

  // ─── concluir: transformação cancelada ───────────────────────────────────────
  it('concluir → lança 409 se transformação cancelada', async () => {
    const transfCancelada = { id: 't1', statusTransformacao: 'cancelada', pecaOrigemId: 'pc1', pesoOriginal: '10.000', deletedAt: null };

    function makeServiceWithCanceled() {
      const { db } = makeDb([[transfCancelada]]);
      return new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    }

    await expect(makeServiceWithCanceled().concluir('t1', {} as never, 'u1')).rejects.toThrow(ConflictException);
    await expect(makeServiceWithCanceled().concluir('t1', {} as never, 'u1')).rejects.toThrow('cancelada não pode ser concluída');
  });

  // ─── cancelar: transformação não encontrada ──────────────────────────────────
  it('cancelar → lança 404 se transformação não encontrada', async () => {
    function make() {
      const { db } = makeDb([[]]);
      return new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    }
    await expect(make().cancelar('t-inexistente', 'u1')).rejects.toThrow(NotFoundException);
  });

  // ─── cancelar: transformação concluída ───────────────────────────────────────
  it('cancelar → lança 409 se transformação concluída', async () => {
    const transfConcluida = { id: 't1', statusTransformacao: 'concluida', pecaOrigemId: 'pc1', deletedAt: null };

    function make() {
      const { db } = makeDb([[transfConcluida]]);
      return new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    }

    await expect(make().cancelar('t1', 'u1')).rejects.toThrow(ConflictException);
    await expect(make().cancelar('t1', 'u1')).rejects.toThrow('concluída não pode ser cancelada');
  });

  // ─── cancelar: já cancelada (idempotente) ────────────────────────────────────
  it('cancelar → retorna sem alterar se já cancelada', async () => {
    const transfJaCancelada = { id: 't1', statusTransformacao: 'cancelada', pecaOrigemId: 'pc1', deletedAt: null };
    const { db } = makeDb([[transfJaCancelada]]);
    const service = new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    const result = await service.cancelar('t1', 'u1');
    expect(result).toEqual(transfJaCancelada);
  });

  // ─── cancelar: aberta, sem subitens, sem histórico → status pesada ────────────
  it('cancelar → restaura status pesada quando não há subitens nem histórico', async () => {
    const transf = { id: 't1', statusTransformacao: 'aberta', pecaOrigemId: 'pc1', pesoOriginal: '10.000', deletedAt: null };
    const atualizada = { id: 't1', statusTransformacao: 'cancelada' };
    const auditoria = makeAuditoria();

    // Sequence: [transf], [subitens vazia], [historico vazio]
    const { db, tx } = makeDb([[transf], [], []], [], atualizada);
    const service = new CorteService({ db } as never, auditoria as never, makeEmitter());
    const result = await service.cancelar('t1', 'u1');
    expect(result).toEqual(atualizada);
    // update: pecas(statusPeca=pesada) + transformacoes(cancelada)
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  // ─── cancelar: subitem sem pedidoVendaItemId (não devolvemos saldo) ───────────
  it('cancelar → subitem sem pedidoVendaItemId não afeta saldo', async () => {
    const transf = { id: 't1', statusTransformacao: 'aberta', pecaOrigemId: 'pc1', deletedAt: null };
    const subitemSemPedido = { id: 's1', transformacaoId: 't1', pedidoVendaItemId: null };
    const atualizada = { id: 't1', statusTransformacao: 'cancelada' };

    // Sequence: [transf], [subitem], [historico vazio]
    const { db } = makeDb([[transf], [subitemSemPedido], []], [], atualizada);
    const service = new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    const result = await service.cancelar('t1', 'u1');
    expect(result).toEqual(atualizada);
  });

  // ─── cancelar: com historico, saldo disponível → restaura como 'associada' ────
  it('cancelar → restaura como associada quando historico tem destino e saldo disponível', async () => {
    const transf = { id: 't1', statusTransformacao: 'aberta', pecaOrigemId: 'pc1', deletedAt: null };
    const historico = [{
      pecaId: 'pc1',
      acao: 'confirmar',
      pedidoItemDestinoId: 'pvi1',
      pedidoDestinoId: 'pv1',
      createdAt: new Date('2026-01-01'),
    }];
    const atualizada = { id: 't1', statusTransformacao: 'cancelada' };
    const auditoria = makeAuditoria();

    // Sequence: [transf], [subitens vazia], [historico com entrada]
    let updateCall = 0;
    const customTx = {
      select: jest.fn(() => {
        const idx = (customTx.select as jest.Mock).mock.calls.length - 1;
        if (idx === 0) return makeSelectChain([transf]);
        if (idx === 1) return makeSelectChain([]);
        return makeSelectChain(historico);
      }),
      update: jest.fn((_tbl?: unknown) => {
        updateCall++;
        return {
          set: (_v?: unknown) => ({
            where: (_c?: unknown) => ({
              returning: jest.fn(async () => updateCall >= 3 ? [atualizada] : [{ id: 'u' }]),
            }),
          }),
        };
      }),
      insert: jest.fn(),
    };
    const db = {
      transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)),
    };

    const service = new CorteService({ db } as never, auditoria as never, makeEmitter());
    const result = await service.cancelar('t1', 'u1');
    expect(result).toEqual(atualizada);
    // consumirSaldo (update pedidosVendaItens) + pecas(associada) + transformacoes(cancelada) = 3 updates
    expect(customTx.update).toHaveBeenCalledTimes(3);
  });

  // ─── cancelar: com historico, saldo indisponível → restaura como 'pesada' ────
  it('cancelar → restaura como pesada quando historico tem destino mas saldo indisponível', async () => {
    const transf = { id: 't1', statusTransformacao: 'aberta', pecaOrigemId: 'pc1', deletedAt: null };
    const historico = [{
      pecaId: 'pc1',
      acao: 'confirmar',
      pedidoItemDestinoId: 'pvi1',
      pedidoDestinoId: 'pv1',
      createdAt: new Date('2026-01-01'),
    }];
    const atualizada = { id: 't1', statusTransformacao: 'cancelada' };
    const auditoria = makeAuditoria();

    let updateCall = 0;
    const customTx = {
      select: jest.fn(() => {
        const idx = (customTx.select as jest.Mock).mock.calls.length - 1;
        if (idx === 0) return makeSelectChain([transf]);
        if (idx === 1) return makeSelectChain([]);
        return makeSelectChain(historico);
      }),
      update: jest.fn((_tbl?: unknown) => {
        updateCall++;
        return {
          set: (_v?: unknown) => ({
            where: (_c?: unknown) => ({
              // consumirSaldo (call 1) returns [] → saldo indisponível
              // pecas (call 2) e transformacoes (call 3) retornam normalmente
              returning: jest.fn(async () => updateCall === 1 ? [] : [updateCall >= 3 ? atualizada : { id: 'u' }]),
            }),
          }),
        };
      }),
      insert: jest.fn(),
    };
    const db = {
      transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)),
    };

    const service = new CorteService({ db } as never, auditoria as never, makeEmitter());
    const result = await service.cancelar('t1', 'u1');
    expect(result).toEqual(atualizada);
    // consumirSaldo + pecas(pesada) + transformacoes = 3 updates
    expect(customTx.update).toHaveBeenCalledTimes(3);
  });

  // ─── detalhar: transformação não encontrada ───────────────────────────────────
  it('detalhar → lança 404 se transformação não encontrada', async () => {
    // detalhar usa this.db diretamente
    const { db } = makeDb([], [[]]);
    const service = new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    await expect(service.detalhar('t-inexistente')).rejects.toThrow(NotFoundException);
  });

  // ─── detalhar: sucesso — retorna transformação e lista de subitens ────────────
  it('detalhar → retorna transformação e subitens quando encontrada', async () => {
    const transf = { id: 't1', statusTransformacao: 'aberta', pecaOrigemId: 'pc1', deletedAt: null };
    const subitem = { id: 's1', transformacaoId: 't1', deletedAt: null };

    // detalhar usa this.db (direct): 1ª=transf, 2ª=subitens
    const { db } = makeDb([], [[transf], [subitem]]);
    const service = new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    const result = await service.detalhar('t1');
    expect(result.transformacao).toEqual(transf);
    expect(result.subitens).toEqual([subitem]);
  });

  // ─── rastrear: sem pecaId e sem subitemId ────────────────────────────────────
  it('rastrear → lança 404 se nem pecaId nem subitemId informados', async () => {
    const { db } = makeDb([], []);
    const service = new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    await expect(service.rastrear({})).rejects.toThrow(NotFoundException);
    await expect(service.rastrear({})).rejects.toThrow('Informe pecaId ou subitemId');
  });

  // ─── rastrear: subitemId não encontrado ──────────────────────────────────────
  it('rastrear → lança 404 se subitemId não encontrado', async () => {
    // rastrear usa this.db (direct)
    function make() {
      const { db } = makeDb([], [[]]);
      return new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    }
    await expect(make().rastrear({ subitemId: 's-inexistente' })).rejects.toThrow(NotFoundException);
    await expect(make().rastrear({ subitemId: 's-inexistente' })).rejects.toThrow('Subitem não encontrado');
  });

  // ─── rastrear: pecaId não encontrado ────────────────────────────────────────
  it('rastrear → lança 404 se pecaId não encontrado', async () => {
    function make() {
      const { db } = makeDb([], [[]]);
      return new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    }
    await expect(make().rastrear({ pecaId: 'pc-inexistente' })).rejects.toThrow(NotFoundException);
    await expect(make().rastrear({ pecaId: 'pc-inexistente' })).rejects.toThrow('Peça não encontrada');
  });

  // ─── rastrear: sem subitens não consulta etiquetas de subitens ──────────────
  it('rastrear → subIds vazio não consulta etiquetas de subitens', async () => {
    const peca = { id: 'pc1', deletedAt: null };
    const { db } = makeDb([], [[peca], [], [], [], []]);
    const service = new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    const result = await service.rastrear({ pecaId: 'pc1' });
    expect(result.etiquetasSubitens).toEqual([]);
  });

  // ─── iniciar: peça não encontrada ────────────────────────────────────────────
  it('iniciar → lança 404 se peça não encontrada', async () => {
    const { db } = makeDb([[]]);
    const service = new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    await expect(
      service.iniciar('pc-x', { tipoTransformacao: 'desossa' } as never, 'u1'),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── iniciar: sucesso sem data de operação resolvida (recebimento sem operação vinculada) ──
  it('iniciar → sucesso mesmo quando data de operação não é resolvida', async () => {
    const pecaElegivel = {
      id: 'pc1',
      statusPeca: 'pesada',
      pedidoVendaItemId: null,
      pesoOriginal: '10.000',
      recebimentoId: 'rec1',
      deletedAt: null,
    };
    const emitter = makeEmitter();
    const emitSpy = jest.spyOn(emitter, 'emit');
    // txSelect: 1ª = pecaAtiva, 2ª = dataOperacaoPorRecebimento (vazio)
    const { db } = makeDb([[pecaElegivel], []]);
    const service = new CorteService({ db } as never, makeAuditoria() as never, emitter);
    await service.iniciar('pc1', { tipoTransformacao: 'desossa' } as never, 'u1');
    expect(emitSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dataOperacao: '' }));
  });

  // ─── concluir: transformação não encontrada ──────────────────────────────────
  it('concluir → lança 404 se transformação não encontrada', async () => {
    const { db } = makeDb([[]]);
    const service = new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    await expect(service.concluir('t-x', {} as never, 'u1')).rejects.toThrow(NotFoundException);
  });

  // ─── concluir: sem subitens ───────────────────────────────────────────────────
  it('concluir → lança 409 se não há subitens', async () => {
    const transf = { id: 't1', statusTransformacao: 'aberta', pecaOrigemId: 'pc1', pesoOriginal: '10.000', deletedAt: null };
    const { db } = makeDb([[transf], []]);
    const service = new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    await expect(service.concluir('t1', {} as never, 'u1')).rejects.toThrow('Não há subitens');
  });

  // ─── concluir: subitem sem peso ──────────────────────────────────────────────
  it('concluir → lança 409 se subitem está sem peso', async () => {
    const transf = { id: 't1', statusTransformacao: 'aberta', pecaOrigemId: 'pc1', pesoOriginal: '10.000', deletedAt: null };
    const subitemSemPeso = { id: 's1', peso: null, statusSubitem: 'associado', etiquetaAtual: 'QR1' };
    const { db } = makeDb([[transf], [subitemSemPeso]]);
    const service = new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    await expect(service.concluir('t1', {} as never, 'u1')).rejects.toThrow('sem peso');
  });

  // ─── concluir: sucesso com peça de origem não recuperável e totais nulos ─────
  it('concluir → conclui mesmo quando peça de origem some e totais retornam nulos', async () => {
    const transf = { id: 't1', statusTransformacao: 'aberta', pecaOrigemId: 'pc1', pesoOriginal: '10.000', deletedAt: null };
    const subitem = { id: 's1', peso: '10.000', statusSubitem: 'associado', etiquetaAtual: 'QR1' };
    const atualizada = {
      id: 't1',
      statusTransformacao: 'concluida',
      pecaOrigemId: 'pc1',
      pesoOriginal: '10.000',
      pesoSubitensTotal: null,
      diferencaPeso: null,
    };
    const emitter = makeEmitter();
    const emitSpy = jest.spyOn(emitter, 'emit');
    // txSelect: 1ª = transformacaoAtiva, 2ª = lista de subitens, 3ª = pecaAtiva final (vazia)
    const { db } = makeDb([[transf], [subitem], []], [], atualizada);
    const service = new CorteService({ db } as never, makeAuditoria() as never, emitter);
    const result = await service.concluir('t1', {} as never, 'u1');
    expect(result).toEqual(atualizada);
    expect(emitSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dataOperacao: '', pesoSubitensTotal: '0.000', diferencaPeso: '0.000' }),
    );
  });

  // ─── cancelar: devolve saldo do subitem e reconhece redirecionamento sem destino disponível ──
  it('cancelar → devolve saldo do subitem com pedido e reconhece histórico de redirecionamento', async () => {
    const transf = { id: 't1', statusTransformacao: 'aberta', pecaOrigemId: 'pc1', deletedAt: null };
    const subitemComPedido = { id: 's1', transformacaoId: 't1', pedidoVendaItemId: 'pvi1', deletedAt: null };
    const historicoRedirecionar = [{
      pecaId: 'pc1',
      acao: 'redirecionar',
      pedidoItemDestinoId: null,
      pedidoDestinoId: null,
      createdAt: new Date('2026-01-01'),
    }];
    const atualizada = { id: 't1', statusTransformacao: 'cancelada' };

    let selectCall = 0;
    let updateCall = 0;
    const customTx = {
      select: jest.fn(() => {
        selectCall++;
        if (selectCall === 1) return makeSelectChain([transf]);
        if (selectCall === 2) return makeSelectChain([subitemComPedido]);
        return makeSelectChain(historicoRedirecionar);
      }),
      update: jest.fn(() => {
        updateCall++;
        return {
          set: () => ({
            where: () => ({
              returning: jest.fn(async () => (updateCall >= 4 ? [atualizada] : [{ id: 'u' }])),
            }),
          }),
        };
      }),
      insert: jest.fn(),
    };
    const db = { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)) };
    const service = new CorteService({ db } as never, makeAuditoria() as never, makeEmitter());
    const result = await service.cancelar('t1', 'u1');
    expect(result).toEqual(atualizada);
    // devolverSaldo + soft-delete subitem + pecas(pesada) + transformacoes(cancelada) = 4 updates
    expect(customTx.update).toHaveBeenCalledTimes(4);
  });
});

// ── SubitemService — branches ─────────────────────────────────────────────────

describe('SubitemService — branches unitários', () => {

  function newService(db: ReturnType<typeof makeDb>['db']) {
    return new SubitemService(
      { db } as never,
      makeAuditoria() as never,
      makeEmitter(),
      {} as never,
      {} as never,
      {} as never,
    );
  }

  // ─── remover: subitem não encontrado ─────────────────────────────────────────
  it('remover → lança 404 se subitem não encontrado', async () => {
    function make() {
      const { db } = makeDb([[]]);
      return newService(db);
    }
    await expect(make().remover('s-inexistente', 'u1')).rejects.toThrow(NotFoundException);
    await expect(make().remover('s-inexistente', 'u1')).rejects.toThrow('Subitem não encontrado');
  });

  // ─── remover: subitem já pesado/associado ─────────────────────────────────────
  it('remover → lança 409 se subitem não está em status gerado', async () => {
    const subitemPesado = { id: 's1', transformacaoId: 't1', statusSubitem: 'pesado', pecaOrigemId: 'pc1', deletedAt: null };
    const transfAberta = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };

    function make() {
      const { db } = makeDb([[subitemPesado], [transfAberta]]);
      return newService(db);
    }
    await expect(make().remover('s1', 'u1')).rejects.toThrow(ConflictException);
    await expect(make().remover('s1', 'u1')).rejects.toThrow('Só é possível remover subitem ainda não pesado');
  });

  // ─── remover: happy path (status gerado) ─────────────────────────────────────
  it('remover → soft-deletes quando status gerado', async () => {
    const subitemGerado = { id: 's1', transformacaoId: 't1', statusSubitem: 'gerado', pecaOrigemId: 'pc1', deletedAt: null };
    const transfAberta = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };
    const auditoriaMock = makeAuditoria();

    const { db, tx } = makeDb([[subitemGerado], [transfAberta]], [], { id: 's1', deletedAt: new Date() });
    const service = new SubitemService(
      { db } as never,
      auditoriaMock as never,
      makeEmitter(),
      {} as never,
      {} as never,
      {} as never,
    );
    await service.remover('s1', 'u1');
    expect(tx.update).toHaveBeenCalled();
    expect(auditoriaMock.registrar).toHaveBeenCalled();
  });

  // ─── pesar: subitem não encontrado ───────────────────────────────────────────
  it('pesar → lança 404 se subitem não encontrado', async () => {
    // pesar usa this.db diretamente para subitemAtivo
    const { db } = makeDb([], [[]]);
    const service = new SubitemService(
      { db } as never,
      makeAuditoria() as never,
      makeEmitter(),
      {} as never,
      {} as never,
      {} as never,
    );
    const user = { sub: 'u1', nome: 'Op', perfis: ['corte'], permissoes: ['CORTE_GERENCIAR'] };
    await expect(
      service.pesar('s-inexistente', { modoCaptura: 'manual', pesoManual: '5.000' } as never, user as never),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── associar: subitem não encontrado ────────────────────────────────────────
  it('associar → lança 404 se subitem não encontrado', async () => {
    function make() {
      const { db } = makeDb([[]]);
      return newService(db);
    }
    await expect(make().associar('s-inexistente', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow(NotFoundException);
  });

  // ─── associar: subitem não pesado ────────────────────────────────────────────
  it('associar → lança 409 se subitem não está pesado', async () => {
    const subitem = { id: 's1', transformacaoId: 't1', statusSubitem: 'gerado', pecaOrigemId: 'pc1', deletedAt: null };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };

    function make() {
      const { db } = makeDb([[subitem], [transf]]);
      return newService(db);
    }
    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow(ConflictException);
    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow('pesado antes de associar');
  });

  // ─── redirecionar: subitem não encontrado ────────────────────────────────────
  it('redirecionar → lança 404 se subitem não encontrado', async () => {
    function make() {
      const { db } = makeDb([[]]);
      return newService(db);
    }
    await expect(make().redirecionar('s-inexistente', { pedidoVendaItemId: 'pvi2', motivo: 'x' } as never, 'u1')).rejects.toThrow(NotFoundException);
  });

  // ─── redirecionar: subitem não associado ─────────────────────────────────────
  it('redirecionar → lança 409 se subitem não associado', async () => {
    const subitem = { id: 's1', transformacaoId: 't1', statusSubitem: 'pesado', pedidoVendaItemId: null, pecaOrigemId: 'pc1', deletedAt: null };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };

    function make() {
      const { db } = makeDb([[subitem], [transf]]);
      return newService(db);
    }
    await expect(make().redirecionar('s1', { pedidoVendaItemId: 'pvi2', motivo: 'x' } as never, 'u1')).rejects.toThrow(ConflictException);
    await expect(make().redirecionar('s1', { pedidoVendaItemId: 'pvi2', motivo: 'x' } as never, 'u1')).rejects.toThrow('Só é possível redirecionar subitem já associado');
  });

  // ─── redirecionar: mesmo item ────────────────────────────────────────────────
  it('redirecionar → lança 409 se destino é o mesmo item atual', async () => {
    const subitem = { id: 's1', transformacaoId: 't1', statusSubitem: 'associado', pedidoVendaItemId: 'pvi1', pecaOrigemId: 'pc1', deletedAt: null };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };

    function make() {
      const { db } = makeDb([[subitem], [transf]]);
      return newService(db);
    }
    await expect(make().redirecionar('s1', { pedidoVendaItemId: 'pvi1', motivo: 'x' } as never, 'u1')).rejects.toThrow(ConflictException);
    await expect(make().redirecionar('s1', { pedidoVendaItemId: 'pvi1', motivo: 'x' } as never, 'u1')).rejects.toThrow('já está neste item do pedido');
  });

  // ─── sugerir: subitem não encontrado ─────────────────────────────────────────
  it('sugerir → lança 404 se subitem não encontrado', async () => {
    // sugerir usa this.db diretamente
    function make() {
      const { db } = makeDb([], [[]]);
      return newService(db);
    }
    await expect(make().sugerir('s-inexistente')).rejects.toThrow(NotFoundException);
    await expect(make().sugerir('s-inexistente')).rejects.toThrow('Subitem não encontrado');
  });

  // ─── sugerir: caminho completo (peca encontrada, compativeis retorna lista) ──
  it('sugerir → retorna sugestão quando subitem e peça encontrados', async () => {
    const subitem = {
      id: 's1',
      transformacaoId: 't1',
      statusSubitem: 'pesado',
      pecaOrigemId: 'pc1',
      itemComercialId: 'ic1',
      peso: '5.000',
      deletedAt: null,
    };
    const peca = { id: 'pc1', compraProgramadaId: 'cp1', deletedAt: null };

    // sugerir usa this.db: 1ª call = subitemAtivo, 2ª call = pecaAtiva, 3ª = calcularCompativeisItem
    let dCall = 0;
    const dbDirect = {
      select: jest.fn(() => {
        dCall++;
        if (dCall === 1) return makeSelectChain([subitem]);
        if (dCall === 2) return makeSelectChain([peca]);
        return makeSelectChain([]); // calcularCompativeisItem returns empty
      }),
      transaction: jest.fn(),
    };

    const service = newService(dbDirect as never);
    const result = await service.sugerir('s1');
    expect(result.subitemId).toBe('s1');
    expect(result.compativeis).toEqual([]);
    expect(result.sugestao).toBeNull(); // compativeis[0] ?? null
  });

  // ─── sugerir: peça de origem não encontrada (branch interno de compativeis) ──
  it('sugerir → lança 404 se peça de origem não encontrada (compativeis)', async () => {
    const subitem = {
      id: 's1',
      transformacaoId: 't1',
      statusSubitem: 'pesado',
      pecaOrigemId: 'pc1',
      itemComercialId: 'ic1',
      peso: '5.000',
      deletedAt: null,
    };
    // sugerir usa this.db: 1ª call = subitemAtivo(found), 2ª call = pecaAtiva(not found)
    // directSelectResponses: [subitem], [peca vazia]
    const { db } = makeDb([], [[subitem], []]);
    const service = newService(db);
    // Única asserção — a segunda chamada consumiria os mocks
    await expect(service.sugerir('s1')).rejects.toThrow('Peça de origem não encontrada');
  });

  // ─── semCobertura: subitem não encontrado ────────────────────────────────────
  it('semCobertura → lança 404 se subitem não encontrado', async () => {
    function make() {
      const { db } = makeDb([[]]);
      return newService(db);
    }
    await expect(make().semCobertura('s-inexistente', { destino: 'sobra' } as never, 'u1')).rejects.toThrow(NotFoundException);
  });

  // ─── adicionar: transformação encerrada (concluida) ──────────────────────────
  it('adicionar → lança 409 se transformação está concluída', async () => {
    const transfConcluida = { id: 't1', statusTransformacao: 'concluida', deletedAt: null };

    function make() {
      const { db } = makeDb([[transfConcluida]]);
      return newService(db);
    }
    await expect(make().adicionar('t1', { itemComercialId: 'ic1', classificacao: 'extra' } as never, 'u1')).rejects.toThrow(ConflictException);
    await expect(make().adicionar('t1', { itemComercialId: 'ic1', classificacao: 'extra' } as never, 'u1')).rejects.toThrow('Transformação encerrada não aceita alterações');
  });

  // ─── adicionar: transformação cancelada ──────────────────────────────────────
  it('adicionar → lança 409 se transformação está cancelada', async () => {
    const transfCancelada = { id: 't1', statusTransformacao: 'cancelada', deletedAt: null };

    function make() {
      const { db } = makeDb([[transfCancelada]]);
      return newService(db);
    }
    await expect(make().adicionar('t1', { itemComercialId: 'ic1', classificacao: 'extra' } as never, 'u1')).rejects.toThrow(ConflictException);
    await expect(make().adicionar('t1', { itemComercialId: 'ic1', classificacao: 'extra' } as never, 'u1')).rejects.toThrow('Transformação encerrada não aceita alterações');
  });

  // ─── adicionar: transformação não encontrada ──────────────────────────────────
  it('adicionar → lança 404 se transformação não encontrada', async () => {
    function make() {
      const { db } = makeDb([[]]);
      return newService(db);
    }
    await expect(make().adicionar('t-inexistente', { itemComercialId: 'ic1', classificacao: 'extra' } as never, 'u1')).rejects.toThrow(NotFoundException);
  });

  // ─── redirecionar: destino com saldo zerado ────────────────────────────────────
  it('redirecionar → lança 409 se item de destino está completo (consumirSaldo=false)', async () => {
    const subitem = { id: 's1', transformacaoId: 't1', statusSubitem: 'associado', pedidoVendaItemId: 'pvi1', pecaOrigemId: 'pc1', itemComercialId: 'ic1', deletedAt: null };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };
    const peca = { id: 'pc1', compraProgramadaId: 'cp1', deletedAt: null };
    const itemPedido = { id: 'pvi2', pedidoVendaId: 'pv2', itemComercialId: 'ic1', compraProgramadaId: 'cp1', statusPedido: 'aberto', deletedAt: null };

    function make() {
      let selectCall = 0;
      const customTx = {
        select: jest.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeSelectChain([subitem]);
          if (selectCall === 2) return makeSelectChain([transf]);
          if (selectCall === 3) return makeSelectChain([peca]);
          return makeSelectChain([itemPedido]);
        }),
        update: jest.fn((_tbl?: unknown) => ({
          set: (_v?: unknown) => ({
            where: (_c?: unknown) => ({
              returning: jest.fn(async () => []),  // consumirSaldo retorna [] = completo
            }),
          }),
        })),
        insert: jest.fn(),
      };
      return { db: { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)) } };
    }

    await expect(newService(make().db as never).redirecionar('s1', { pedidoVendaItemId: 'pvi2', motivo: 'x' } as never, 'u1')).rejects.toThrow(ConflictException);
    await expect(newService(make().db as never).redirecionar('s1', { pedidoVendaItemId: 'pvi2', motivo: 'x' } as never, 'u1')).rejects.toThrow('Item de destino já está completo');
  });

  // ─── itemCompativel: item não encontrado ──────────────────────────────────────
  it('associar → lança 404 se item do pedido não encontrado (itemCompativel)', async () => {
    const subitem = { id: 's1', transformacaoId: 't1', statusSubitem: 'pesado', pecaOrigemId: 'pc1', itemComercialId: 'ic1', deletedAt: null };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };
    const peca = { id: 'pc1', compraProgramadaId: 'cp1', deletedAt: null };

    function make() {
      let selectCall = 0;
      const customTx = {
        select: jest.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeSelectChain([subitem]);  // subitemAtivo
          if (selectCall === 2) return makeSelectChain([transf]);   // transformacaoEditavel
          if (selectCall === 3) return makeSelectChain([peca]);     // itemCompativel.pecaAtiva
          return makeSelectChain([]);                               // item não encontrado
        }),
        update: jest.fn(),
        insert: jest.fn(),
      };
      const db = {
        transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)),
      };
      return newService(db as never);
    }

    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow(NotFoundException);
    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow('Item de pedido não encontrado');
  });

  // ─── itemCompativel: pedido cancelado ─────────────────────────────────────────
  it('associar → lança 409 se pedido está cancelado (itemCompativel)', async () => {
    const subitem = { id: 's1', transformacaoId: 't1', statusSubitem: 'pesado', pecaOrigemId: 'pc1', itemComercialId: 'ic1', deletedAt: null };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };
    const peca = { id: 'pc1', compraProgramadaId: 'cp1', deletedAt: null };
    const itemCancelado = { id: 'pvi1', pedidoVendaId: 'pv1', itemComercialId: 'ic1', compraProgramadaId: 'cp1', statusPedido: 'cancelado', deletedAt: null };

    function make() {
      let selectCall = 0;
      const customTx = {
        select: jest.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeSelectChain([subitem]);
          if (selectCall === 2) return makeSelectChain([transf]);
          if (selectCall === 3) return makeSelectChain([peca]);
          return makeSelectChain([itemCancelado]);
        }),
        update: jest.fn(),
        insert: jest.fn(),
      };
      const db = {
        transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)),
      };
      return newService(db as never);
    }

    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow(ConflictException);
    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow('Pedido cancelado não aceita associação');
  });

  // ─── itemCompativel: item comercial incompatível ──────────────────────────────
  it('associar → lança 409 se item comercial incompatível (itemCompativel)', async () => {
    const subitem = { id: 's1', transformacaoId: 't1', statusSubitem: 'pesado', pecaOrigemId: 'pc1', itemComercialId: 'ic1', deletedAt: null };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };
    const peca = { id: 'pc1', compraProgramadaId: 'cp1', deletedAt: null };
    const itemDiferente = { id: 'pvi1', pedidoVendaId: 'pv1', itemComercialId: 'ic-OUTRO', compraProgramadaId: 'cp1', statusPedido: 'aberto', deletedAt: null };

    function make() {
      let selectCall = 0;
      const customTx = {
        select: jest.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeSelectChain([subitem]);
          if (selectCall === 2) return makeSelectChain([transf]);
          if (selectCall === 3) return makeSelectChain([peca]);
          return makeSelectChain([itemDiferente]);
        }),
        update: jest.fn(),
        insert: jest.fn(),
      };
      const db = {
        transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)),
      };
      return newService(db as never);
    }

    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow(ConflictException);
    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow('incompatível');
  });

  // ─── itemCompativel: compra programada diferente ──────────────────────────────
  it('associar → lança 409 se pedido pertence a outra compra programada', async () => {
    const subitem = { id: 's1', transformacaoId: 't1', statusSubitem: 'pesado', pecaOrigemId: 'pc1', itemComercialId: 'ic1', deletedAt: null };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };
    const peca = { id: 'pc1', compraProgramadaId: 'cp1', deletedAt: null };
    const itemOutraCompra = { id: 'pvi1', pedidoVendaId: 'pv1', itemComercialId: 'ic1', compraProgramadaId: 'cp-OUTRA', statusPedido: 'aberto', deletedAt: null };

    function make() {
      let selectCall = 0;
      const customTx = {
        select: jest.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeSelectChain([subitem]);
          if (selectCall === 2) return makeSelectChain([transf]);
          if (selectCall === 3) return makeSelectChain([peca]);
          return makeSelectChain([itemOutraCompra]);
        }),
        update: jest.fn(),
        insert: jest.fn(),
      };
      const db = {
        transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)),
      };
      return newService(db as never);
    }

    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow(ConflictException);
    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow('outra compra programada');
  });

  // ─── itemCompativel: item deletado ────────────────────────────────────────────
  it('associar → lança 404 se item do pedido está deletado (deletedAt set)', async () => {
    const subitem = { id: 's1', transformacaoId: 't1', statusSubitem: 'pesado', pecaOrigemId: 'pc1', itemComercialId: 'ic1', deletedAt: null };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };
    const peca = { id: 'pc1', compraProgramadaId: 'cp1', deletedAt: null };
    const itemDeletado = { id: 'pvi1', pedidoVendaId: 'pv1', itemComercialId: 'ic1', compraProgramadaId: 'cp1', statusPedido: 'aberto', deletedAt: new Date() };

    function make() {
      let selectCall = 0;
      const customTx = {
        select: jest.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeSelectChain([subitem]);
          if (selectCall === 2) return makeSelectChain([transf]);
          if (selectCall === 3) return makeSelectChain([peca]);
          return makeSelectChain([itemDeletado]);
        }),
        update: jest.fn(),
        insert: jest.fn(),
      };
      const db = {
        transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)),
      };
      return newService(db as never);
    }

    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow(NotFoundException);
    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow('Item de pedido não encontrado');
  });

  // ─── itemCompativel: peça de origem não encontrada ────────────────────────────
  it('associar → lança 404 se peça de origem não encontrada em itemCompativel', async () => {
    const subitem = { id: 's1', transformacaoId: 't1', statusSubitem: 'pesado', pecaOrigemId: 'pc1', itemComercialId: 'ic1', deletedAt: null };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };

    function make() {
      let selectCall = 0;
      const customTx = {
        select: jest.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeSelectChain([subitem]);
          if (selectCall === 2) return makeSelectChain([transf]);
          return makeSelectChain([]); // peca não encontrada
        }),
        update: jest.fn(),
        insert: jest.fn(),
      };
      const db = {
        transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)),
      };
      return newService(db as never);
    }

    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow(NotFoundException);
    await expect(make().associar('s1', { pedidoVendaItemId: 'pvi1' } as never, 'u1')).rejects.toThrow('Peça de origem não encontrada');
  });

  // ─── semCobertura: com pedidoVendaItemId (devolve saldo) ─────────────────────
  it('semCobertura → devolve saldo se subitem tem pedidoVendaItemId', async () => {
    const subitem = {
      id: 's1',
      transformacaoId: 't1',
      statusSubitem: 'associado',
      pedidoVendaItemId: 'pvi1',
      pecaOrigemId: 'pc1',
      deletedAt: null,
      observacoes: null,
    };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };
    const atualizado = { id: 's1', statusSubitem: 'em_sobra' };
    const auditoriaMock = makeAuditoria();
    const emitter = makeEmitter();

    let selectCall = 0;
    const customTx = {
      select: jest.fn(() => {
        selectCall++;
        if (selectCall === 1) return makeSelectChain([subitem]);
        return makeSelectChain([transf]);
      }),
      update: jest.fn((_tbl?: unknown) => ({
        set: (_v?: unknown) => ({
          where: (_c?: unknown) => ({
            returning: jest.fn(async () => [atualizado]),
          }),
        }),
      })),
      insert: jest.fn(),
    };
    const db = {
      transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)),
    };

    const service = new SubitemService(
      { db } as never,
      auditoriaMock as never,
      emitter,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await service.semCobertura('s1', { destino: 'sobra' } as never, 'u1');
    expect(result).toEqual(atualizado);
    // update deve ser chamado: devolverSaldo (pedidosVendaItens) + subitens
    expect(customTx.update).toHaveBeenCalledTimes(2);
  });

  // ─── recebimentoItemDaPeca: peca não encontrada ───────────────────────────────
  it('semCobertura → lança 404 se peca não encontrada em recebimentoItemDaPeca', async () => {
    const subitem = {
      id: 's1',
      transformacaoId: 't1',
      statusSubitem: 'pesado',
      pecaOrigemId: 'pc1',
      pedidoVendaItemId: null,
      deletedAt: null,
    };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };

    function make() {
      let selectCall = 0;
      const customTx = {
        select: jest.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeSelectChain([subitem]);
          if (selectCall === 2) return makeSelectChain([transf]);
          return makeSelectChain([]); // peca não encontrada em recebimentoItemDaPeca
        }),
        update: jest.fn((_tbl?: unknown) => ({
          set: (_v?: unknown) => ({
            where: (_c?: unknown) => ({
              returning: jest.fn(async () => [{ id: 's1', statusSubitem: 'em_analise' }]),
            }),
          }),
        })),
        insert: jest.fn(),
      };
      return { db: { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)) } };
    }

    await expect(
      newService(make().db as never).semCobertura('s1', { destino: 'divergencia', divergencia: { tipo: 'PESO', descricao: 'x' } } as never, 'u1'),
    ).rejects.toThrow(NotFoundException);
    await expect(
      newService(make().db as never).semCobertura('s1', { destino: 'divergencia', divergencia: { tipo: 'PESO', descricao: 'x' } } as never, 'u1'),
    ).rejects.toThrow('Peça não encontrada');
  });

  // ─── recebimentoItemDaPeca: item de recebimento não encontrado ────────────────
  it('semCobertura → lança 409 se item de recebimento não encontrado', async () => {
    const subitem = {
      id: 's1',
      transformacaoId: 't1',
      statusSubitem: 'pesado',
      pecaOrigemId: 'pc1',
      pedidoVendaItemId: null,
      deletedAt: null,
    };
    const transf = { id: 't1', statusTransformacao: 'aberta', deletedAt: null };
    const peca = { id: 'pc1', recebimentoId: 'r1', itemComercialBaseId: 'ic1', deletedAt: null };

    function make() {
      let selectCall = 0;
      const customTx = {
        select: jest.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeSelectChain([subitem]);
          if (selectCall === 2) return makeSelectChain([transf]);
          if (selectCall === 3) return makeSelectChain([peca]);
          return makeSelectChain([]);
        }),
        update: jest.fn((_tbl?: unknown) => ({
          set: (_v?: unknown) => ({
            where: (_c?: unknown) => ({
              returning: jest.fn(async () => [{ id: 's1', statusSubitem: 'em_analise' }]),
            }),
          }),
        })),
        insert: jest.fn(),
      };
      return { db: { transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)) } };
    }

    await expect(
      newService(make().db as never).semCobertura('s1', { destino: 'divergencia', divergencia: { tipo: 'PESO', descricao: 'x' } } as never, 'u1'),
    ).rejects.toThrow(ConflictException);
    await expect(
      newService(make().db as never).semCobertura('s1', { destino: 'divergencia', divergencia: { tipo: 'PESO', descricao: 'x' } } as never, 'u1'),
    ).rejects.toThrow('Item de recebimento não encontrado');
  });

  // ─── sugerir: subitem sem peso (peso ?? '0' branch) ───────────────────────────
  it('sugerir → subitem com peso null usa 0 na busca de compatíveis', async () => {
    const subitemSemPeso = {
      id: 's1',
      transformacaoId: 't1',
      statusSubitem: 'gerado',
      pecaOrigemId: 'pc1',
      itemComercialId: 'ic1',
      peso: null,
      deletedAt: null,
    };
    const peca = { id: 'pc1', compraProgramadaId: 'cp1', deletedAt: null };

    let dCall = 0;
    const dbDirect = {
      select: jest.fn(() => {
        dCall++;
        if (dCall === 1) return makeSelectChain([subitemSemPeso]);
        if (dCall === 2) return makeSelectChain([peca]);
        return makeSelectChain([]);
      }),
      transaction: jest.fn(),
    };

    const service = newService(dbDirect as never);
    const result = await service.sugerir('s1');
    expect(result.subitemId).toBe('s1');
    expect(result.sugestao).toBeNull();
  });

  // ─── adicionar: dto.quantidade definido (branch true) ────────────────────────
  it('adicionar → quantidade definida no dto é usada', async () => {
    const transf = { id: 't1', statusTransformacao: 'aberta', pecaOrigemId: 'pc1', deletedAt: null };
    const recebimento = { id: 'r1', dataOperacao: '2026-01-01' };
    const novoSubitem = { id: 'new', transformacaoId: 't1', statusSubitem: 'gerado' };
    const auditoriaMock = makeAuditoria();
    const emitter = makeEmitter();

    let selectCall = 0;
    const customTx = {
      select: jest.fn(() => {
        selectCall++;
        if (selectCall === 1) return makeSelectChain([transf]); // transformacaoEditavel
        return makeSelectChain([recebimento]);                  // dataOperacao
      }),
      update: jest.fn(),
      insert: jest.fn((_tbl?: unknown) => ({
        values: (_v?: unknown) => ({ returning: jest.fn(async () => [novoSubitem]) }),
      })),
    };
    const db = {
      transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(customTx)),
    };

    const service = new SubitemService(
      { db } as never,
      auditoriaMock as never,
      emitter,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await service.adicionar('t1', { itemComercialId: 'ic1', classificacao: 'extra', quantidade: 3 } as never, 'u1');
    expect(result).toEqual(novoSubitem);
    // verifica que insert.values foi chamado (covers linha 48 com quantidade definido)
    expect(customTx.insert).toHaveBeenCalled();
  });
});
