import { montarPainelDesossa } from '../../src/modules/operacao/desossa/painel.calc';

describe('montarPainelDesossa', () => {
  const faltas = [
    {
      produto: { id: 'p1', codigo: 'CB', nome: 'Coxão-bola' },
      quantidadeFaltante: 5,
      quantidadeEstoque: 1,
      origem: 'TZ',
      rota: 'Carga Centro 11:30',
      representante: 'Alpha Carnes / Sabrina',
      horarioAlvo: '10:45',
    },
  ];
  const regras = [
    {
      id: 'r1',
      codigo: 'TZ_A',
      nome: 'Alternativa A — TZ → Coxão-bola + Jacaré',
      provisorio: true,
      saidasLabel: '1× CB + 1× JAC',
      prioridade: 1,
      saidasCodigos: ['CB', 'JAC'],
    },
  ];

  it('projeta faltam bruto, aProduzir = líquido tip e contexto de carga', () => {
    const p = montarPainelDesossa({
      faltas,
      regras,
      modoTv: false,
      geradoEm: '2026-07-31T12:00:00.000Z',
      tzsNaDesossa: 24,
      operacaoId: '11111111-1111-1111-1111-111111111111',
    });
    expect(p.modoTv).toBe(false);
    expect(p.operacaoId).toBe('11111111-1111-1111-1111-111111111111');
    expect(p.itens).toHaveLength(1);
    const item = p.itens[0]!;
    expect(item).toMatchObject({
      produtoCodigo: 'CB',
      faltam: 6,
      prontoEstoque: 1,
      aProduzir: 5,
      origem: 'TZ',
      rota: 'Carga Centro 11:30',
      representante: 'Alpha Carnes / Sabrina',
      horarioAlvo: '10:45',
    });
    const regra = p.regras[0]!;
    expect(regra.provisorio).toBe(true);
    expect(regra.prioridade).toBe('Alta');
    expect(regra.atende).toBe('Carga Centro 11:30');
    expect(regra.sobras).toMatch(/estoque/);
    expect(regra.impacto).toMatch(/Coxão/);
    expect(regra.status).toBe('Recomendada');
    expect(p.totais.itensFaltantes).toBe(1);
    expect(p.totais.tzsNaDesossa).toBe(24);
    expect(p.totais.prontoEstoque).toBe(1);
  });

  it('modoTv omit regras detalhadas e mantém itens com CARGA/HORÁRIO', () => {
    const p = montarPainelDesossa({
      faltas,
      regras,
      modoTv: true,
      geradoEm: '2026-07-31T12:00:00.000Z',
      tzsNaDesossa: 24,
      operacaoId: '11111111-1111-1111-1111-111111111111',
    });
    expect(p.modoTv).toBe(true);
    expect(p.itens).toHaveLength(1);
    const item = p.itens[0]!;
    expect(item.rota).toBe('Carga Centro 11:30');
    expect(item.horarioAlvo).toBe('10:45');
    expect(p.regras).toEqual([]);
  });
});
