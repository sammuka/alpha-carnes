/**
 * Testes de branch (mocks, sem DB) para HistoricoEstoqueService: dispatch por tipo
 * (peca/subitem/entrada), 404 quando o alvo não existe, mapeamento de ROTULO_ACAO
 * (incluindo ação desconhecida sem rótulo mapeado), eventos de ajuste por status
 * (aplicado/rejeitado/aguardando) e o branch condicional de "Destinada ao pedido"
 * em entrada (com/sem pedidoId).
 */
import { NotFoundException } from '@nestjs/common';
import { HistoricoEstoqueService } from '../../src/modules/operacao/estoque/historico.service';

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> & PromiseLike<unknown[]> = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  } as never;
  return chain;
}

function makeDb(responses: unknown[][]) {
  let call = 0;
  return { select: jest.fn(() => makeChain(responses[call++] ?? [])) };
}

describe('HistoricoEstoqueService — obter por tipo (peca/subitem/entrada)', () => {
  const dataBase = new Date('2026-08-01T10:00:00Z');

  it('tipo=peca não encontrada → 404', async () => {
    const service = new HistoricoEstoqueService({ db: makeDb([[]]) } as never);
    await expect(service.obter({ tipo: 'peca', id: 'p1' })).rejects.toThrow(NotFoundException);
  });

  it('tipo=peca encontrada → monta eventos (histórico + ajustes) ordenados e rotulados', async () => {
    const db = makeDb([
      [{ createdAt: dataBase }], // peca
      [
        { acao: 'destinar_estoque', createdAt: new Date('2026-08-01T11:00:00Z') },
        { acao: 'acao_desconhecida', createdAt: new Date('2026-08-01T12:00:00Z') },
      ], // historico
      [
        { status: 'aplicado', decididoEm: new Date('2026-08-01T13:00:00Z'), createdAt: new Date('2026-08-01T09:00:00Z') },
        { status: 'rejeitado', decididoEm: new Date('2026-08-01T14:00:00Z'), createdAt: new Date('2026-08-01T09:30:00Z') },
        { status: 'aguardando_aprovacao', decididoEm: null, createdAt: new Date('2026-08-01T15:00:00Z') },
      ], // ajustes
    ]);
    const service = new HistoricoEstoqueService({ db } as never);

    const eventos = await service.obter({ tipo: 'peca', id: 'p1' });

    expect(eventos.map((e) => e.descricao)).toEqual([
      'Recebida e destinada ao estoque',
      'Destinada ao pedido',
      'acao_desconhecida',
      'Ajuste de estoque aplicado',
      'Ajuste de estoque rejeitado',
      'Ajuste de estoque aguardando aprovação',
    ]);
    const datas = eventos.map((e) => e.dataHora);
    expect(datas).toEqual([...datas].sort());
  });

  it('tipo=subitem não encontrado → 404', async () => {
    const service = new HistoricoEstoqueService({ db: makeDb([[]]) } as never);
    await expect(service.obter({ tipo: 'subitem', id: 's1' })).rejects.toThrow(NotFoundException);
  });

  it('tipo=subitem encontrado → evento de geração na desossa + histórico rotulado', async () => {
    const db = makeDb([
      [{ createdAt: dataBase }],
      [{ acao: 'sobra', createdAt: new Date('2026-08-01T11:00:00Z') }],
      [],
    ]);
    const service = new HistoricoEstoqueService({ db } as never);
    const eventos = await service.obter({ tipo: 'subitem', id: 's1' });
    expect(eventos.map((e) => e.descricao)).toEqual([
      'Gerada na desossa e enviada ao estoque',
      'Enviada ao estoque',
    ]);
  });

  it('tipo=entrada não encontrada → 404', async () => {
    const service = new HistoricoEstoqueService({ db: makeDb([[]]) } as never);
    await expect(service.obter({ tipo: 'entrada', id: 'e1' })).rejects.toThrow(NotFoundException);
  });

  it('tipo=entrada sem pedido vinculado → não gera evento "Destinada ao pedido"', async () => {
    const db = makeDb([
      [{ createdAt: dataBase, destino: 'estoque', pedidoId: null }],
      [],
    ]);
    const service = new HistoricoEstoqueService({ db } as never);
    const eventos = await service.obter({ tipo: 'entrada', id: 'e1' });
    expect(eventos.map((e) => e.descricao)).toEqual(['Entrada registrada (Entrada de Itens)']);
  });

  it('tipo=entrada com pedido vinculado → inclui "Destinada ao pedido"', async () => {
    const db = makeDb([
      [{ createdAt: dataBase, destino: 'pedido', pedidoId: 'pv1' }],
      [],
    ]);
    const service = new HistoricoEstoqueService({ db } as never);
    const eventos = await service.obter({ tipo: 'entrada', id: 'e1' });
    expect(eventos.map((e) => e.descricao)).toEqual([
      'Entrada registrada (Entrada de Itens)',
      'Destinada ao pedido',
    ]);
  });
});
