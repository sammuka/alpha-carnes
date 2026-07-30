import { EventEmitter2 } from '@nestjs/event-emitter';
import { EspelhoService } from '../../src/modules/comercial/espelho/espelho.service';

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    then: (cb: (r: unknown[]) => unknown) => cb(rows),
  };
  return chain;
}

describe('EspelhoService — branches', () => {
  const linhaBase = {
    pedidoVendaId: 'pv1',
    pedidoStatus: 'em_elaboracao_reserva_ativa',
    clienteId: 'c1',
    clienteNome: 'Cliente A',
    rotaId: null,
    rotaNome: null,
    representanteId: null,
    representanteNome: null,
    itemPedidoId: 'pvi1',
    itemComercialId: 'ic1',
    produtoCodigo: 'TZ',
    produtoDescricao: 'Traseiro',
    unidadeComercial: 'kg',
    quantidadePedida: '10.000',
    quantidadeAtendida: '0.000',
  };

  function makeService(linhas: unknown[] = [linhaBase], pesos: unknown[] = []) {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce(makeSelectChain(linhas))
        .mockReturnValueOnce(makeSelectChain(pesos)),
    };
    return new EspelhoService({ db } as never);
  }

  it('agrupa por rota com fallback Sem rota', async () => {
    const service = makeService([
      { ...linhaBase, rotaNome: 'Centro', representanteNome: 'Sabrina' },
      { ...linhaBase, pedidoVendaId: 'pv2', clienteNome: 'Cliente B', rotaNome: null, representanteNome: null },
    ]);
    const porRota = await service.consultar({ dataOperacao: '2026-08-01', agrupar: 'rota', formato: 'json' });
    expect(porRota.grupos.map((g) => g.chave).sort()).toEqual(['Centro', 'Sem rota']);
  });

  it('agrupa por representante com fallback Sem representante', async () => {
    const service = makeService([
      { ...linhaBase, rotaNome: 'Centro', representanteNome: 'Sabrina' },
      { ...linhaBase, pedidoVendaId: 'pv2', clienteNome: 'Cliente B', rotaNome: null, representanteNome: null },
    ]);
    const porRep = await service.consultar({ dataOperacao: '2026-08-01', agrupar: 'representante', formato: 'json' });
    expect(porRep.grupos.map((g) => g.chave).sort()).toEqual(['Sabrina', 'Sem representante']);
  });

  it('exportarCsv escapa valores com aspas ponto-e-virgula ou quebra de linha', async () => {
    const service = makeService([
      {
        ...linhaBase,
        clienteNome: 'Cliente "VIP"; Especial',
        representanteNome: 'Rep\nLinha',
        rotaNome: 'Rota A',
        produtoCodigo: 'TZ',
        produtoDescricao: 'Traseiro',
        quantidadePedida: '1.000',
        quantidadeAtendida: '0.000',
      },
    ]);
    const csv = await service.exportarCsv({ dataOperacao: '2026-08-01', agrupar: 'cliente', formato: 'csv' });
    expect(csv).toContain('"Cliente ""VIP""; Especial"');
    expect(csv).toContain('"Rep\nLinha"');
  });

  it('carregarItens sem pecas associadas usa peso zero', async () => {
    const service = makeService([linhaBase], []);
    const resposta = await service.consultar({ dataOperacao: '2026-08-01', agrupar: 'cliente', formato: 'json' });
    expect(resposta.grupos[0]?.itens[0]?.pesoAtendido).toBe('0.000');
  });
});
