import { ComprasProgramadasService } from '../../src/modules/comercial/compras-programadas/compras-programadas.service';
import type { ItemImpacto } from '../../src/modules/comercial/disponibilidade/disponibilidade.service';

describe('montarImpacto', () => {
  const auditoria = { registrar: jest.fn() };
  const emitter = { emit: jest.fn() };
  const disponibilidadeService = {
    projetarImpacto: jest.fn(),
    gerarParaCompra: jest.fn(),
  };
  const operacoesService = { garantirOperacao: jest.fn() };

  function service(db: object) {
    return new ComprasProgramadasService(
      { db } as never,
      auditoria as never,
      emitter as never,
      disponibilidadeService as never,
      operacoesService as never,
    );
  }

  const compra = {
    id: 'cp1',
    operacaoId: 'op1',
    status: 'confirmada',
  };

  it('déficit = reservada - projetada, nunca negativo', async () => {
    const itens: ItemImpacto[] = [{
      produtoId: 'ic1',
      codigo: 'TZ',
      descricao: 'Traseiro',
      quantidadeGeradaAtual: '200.000',
      quantidadeGeradaProjetada: '120.000',
      delta: '-80.000',
      quantidadeReservada: '150.000',
      saldoAtual: '50.000',
      saldoProjetado: '0.000',
      deficitProjetado: '30.000',
    }];
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([compra]),
        }),
      })),
    };
    disponibilidadeService.projetarImpacto.mockResolvedValue(itens);
    const result = await service(db).impacto('cp1', new Map());
    expect(result.deficitTotal).toBe('30.000');
    expect(result.exigeConfirmacao).toBe(true);
    expect(result.itens[0]?.deficitProjetado).toBe('30.000');

    const semDeficit: ItemImpacto[] = [{
      ...itens[0]!,
      quantidadeGeradaProjetada: '200.000',
      delta: '0.000',
      saldoProjetado: '50.000',
      deficitProjetado: '0.000',
    }];
    disponibilidadeService.projetarImpacto.mockResolvedValue(semDeficit);
    const ok = await service(db).impacto('cp1', new Map());
    expect(ok.deficitTotal).toBe('0.000');
    expect(ok.exigeConfirmacao).toBe(false);
  });

  it('resumo do protótipo lista sinal, sigla e déficit por item', async () => {
    const itens: ItemImpacto[] = [{
      produtoId: 'ic1',
      codigo: 'TZ',
      descricao: 'Traseiro',
      quantidadeGeradaAtual: '200.000',
      quantidadeGeradaProjetada: '120.000',
      delta: '-80.000',
      quantidadeReservada: '150.000',
      saldoAtual: '50.000',
      saldoProjetado: '0.000',
      deficitProjetado: '30.000',
    }];
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([compra]),
        }),
      })),
    };
    disponibilidadeService.projetarImpacto.mockResolvedValue(itens);
    const result = await service(db).impacto('cp1', new Map());
    expect(result.resumo).toContain('-80.000 TZ virtuais');
    expect(result.resumo).toContain('déficit projetado: 30.000 TZ');
  });

  it('exigeConfirmacao só quando deficitTotal > 0', async () => {
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([compra]),
        }),
      })),
    };
    disponibilidadeService.projetarImpacto.mockResolvedValue([{
      produtoId: 'ic1',
      codigo: 'TZ',
      descricao: 'Traseiro',
      quantidadeGeradaAtual: '200.000',
      quantidadeGeradaProjetada: '200.000',
      delta: '0.000',
      quantidadeReservada: '0.000',
      saldoAtual: '200.000',
      saldoProjetado: '200.000',
      deficitProjetado: '0.000',
    }]);
    const result = await service(db).impacto('cp1', new Map());
    expect(result.exigeConfirmacao).toBe(false);
  });
});
