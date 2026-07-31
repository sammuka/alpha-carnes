import { calcularScores, type CandidatoPedido } from '../../src/modules/operacao/pesagem/associacao-score';

function candidato(over: Partial<CandidatoPedido>): CandidatoPedido {
  return {
    pedidoVendaId: 'pv-1',
    pedidoVendaItemId: 'pvi-1',
    itemComercialId: 'item-A',
    clienteId: 'cli-1',
    saldoPendente: '5.000',
    prioridade: null,
    rotaPrevista: null,
    preferencias: {},
    ...over,
  };
}

describe('associacao-score (motor de sugestão — função pura)', () => {
  const peca = { itemComercialBaseId: 'item-A', pesoOriginal: '12.500' };

  it('exclui itens incompatíveis e sem saldo', () => {
    const r = calcularScores(peca, [
      candidato({ pedidoVendaItemId: 'incompativel', itemComercialId: 'item-B' }),
      candidato({ pedidoVendaItemId: 'sem-saldo', saldoPendente: '0.000' }),
      candidato({ pedidoVendaItemId: 'ok' }),
    ]);
    expect(r.map((s) => s.pedidoVendaItemId)).toEqual(['ok']);
  });

  it('peso dentro da faixa preferida pontua mais que fora da faixa', () => {
    const r = calcularScores(peca, [
      candidato({ pedidoVendaItemId: 'fora', preferencias: { faixaPesoMin: 20, faixaPesoMax: 30 } }),
      candidato({ pedidoVendaItemId: 'dentro', preferencias: { faixaPesoMin: 10, faixaPesoMax: 15 } }),
    ]);
    expect(r[0]!.pedidoVendaItemId).toBe('dentro');
    expect(r[0]!.score).toBeGreaterThan(r[1]!.score);
  });

  it('prioridade comercial mais alta ordena na frente em empate de faixa', () => {
    const r = calcularScores(peca, [
      candidato({ pedidoVendaItemId: 'baixa', prioridade: 3 }),
      candidato({ pedidoVendaItemId: 'alta', prioridade: 1 }),
    ]);
    expect(r[0]!.pedidoVendaItemId).toBe('alta');
  });

  it('justificativa é transparente (RF-PS-10)', () => {
    const r = calcularScores(peca, [candidato({ preferencias: { faixaPesoMin: 10, faixaPesoMax: 15 }, prioridade: 1 })]);
    expect(r[0]!.justificativa).toContain('item compatível');
    expect(r[0]!.justificativa).toContain('faixa preferida');
    expect(r[0]!.justificativa).toContain('prioridade comercial');
  });

  it('sem candidatos compatíveis retorna lista vazia', () => {
    const r = calcularScores(peca, [candidato({ itemComercialId: 'item-X' })]);
    expect(r).toEqual([]);
  });

  it('marca prefCompativel sem alterar score nem ordenação', () => {
    const candidatos = [
      candidato({
        pedidoVendaItemId: 'pvi-match',
        prioridade: 2,
        preferencias: { caracteristicasPreferidas: ['maisPesada'] },
      }),
      candidato({
        pedidoVendaItemId: 'pvi-prio',
        prioridade: 1,
        preferencias: { caracteristicasPreferidas: ['maisGorda'] },
      }),
    ];
    const sem = calcularScores(peca, candidatos);
    const com = calcularScores(
      { ...peca, caracteristicas: ['maisPesada'] },
      candidatos,
    );
    expect(com.map((s) => s.pedidoVendaItemId)).toEqual(sem.map((s) => s.pedidoVendaItemId));
    expect(com.map((s) => s.score)).toEqual(sem.map((s) => s.score));
    expect(com.find((s) => s.pedidoVendaItemId === 'pvi-match')!.prefCompativel).toBe(true);
    expect(com.find((s) => s.pedidoVendaItemId === 'pvi-prio')!.prefCompativel).toBe(false);
  });
});
