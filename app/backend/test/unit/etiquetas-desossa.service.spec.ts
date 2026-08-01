import { EtiquetasDesossaService } from '../../src/modules/operacao/desossa/etiquetas-desossa.service';

type Chain = {
  from: (...a: unknown[]) => Chain;
  where: (...a: unknown[]) => Chain;
  innerJoin: (...a: unknown[]) => Chain;
  leftJoin: (...a: unknown[]) => Chain;
  orderBy: (...a: unknown[]) => Chain;
  then: (cb: (r: unknown[]) => unknown) => unknown;
};

function selectChain(rows: unknown[]): Chain {
  const terminal: Chain = {
    from: () => terminal,
    where: () => terminal,
    innerJoin: () => terminal,
    leftJoin: () => terminal,
    orderBy: () => terminal,
    then: (cb) => cb(rows),
  };
  return terminal;
}

const operacaoId = '11111111-1111-4111-8111-111111111111';
const transformacaoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('EtiquetasDesossaService', () => {
  it('projeta origemPeso, destino, clientePedido, bloqueada e paginação', async () => {
    const rows = [
      {
        id: 'e1',
        codigo: 'QR-1',
        estado: 'emitida',
        peso: '1.200',
        modoCapturaPeso: 'automatico',
        produtoCodigo: 'CB',
        produtoNome: 'Coxão-bola',
        parteCodigo: 'CB-01',
        pecaMaeCodigo: 'TZ-001',
        transformacaoId,
        subitemId: 's1',
        pedidoVendaId: 'ped-1',
        clienteNome: 'Cliente A',
        pedidoCodigo: 'ped-1',
        createdAt: new Date('2026-07-31T10:00:00.000Z'),
        invalidadaEm: null,
        statusImpressao: 'pendente',
        bloqueada: true,
      },
      {
        id: 'e2',
        codigo: 'QR-2',
        estado: 'ativa',
        peso: '1.100',
        modoCapturaPeso: 'manual_assistido',
        produtoCodigo: 'JAC',
        produtoNome: 'Jacaré',
        parteCodigo: 'JAC-01',
        pecaMaeCodigo: 'TZ-001',
        transformacaoId,
        subitemId: 's2',
        pedidoVendaId: 'ped-2',
        clienteNome: null,
        pedidoCodigo: 'ped-2',
        createdAt: new Date('2026-07-31T11:00:00.000Z'),
        invalidadaEm: new Date('2026-07-31T12:00:00.000Z'),
        statusImpressao: 'impressa',
        bloqueada: 0,
      },
      {
        id: 'e3',
        codigo: null,
        estado: 'emitida',
        peso: null,
        modoCapturaPeso: 'outro',
        produtoCodigo: 'CB',
        produtoNome: 'Coxão-bola',
        parteCodigo: null,
        pecaMaeCodigo: null,
        transformacaoId,
        subitemId: 's3',
        pedidoVendaId: null,
        clienteNome: null,
        pedidoCodigo: null,
        createdAt: new Date('2026-07-31T09:00:00.000Z'),
        invalidadaEm: null,
        statusImpressao: 'impressa',
        bloqueada: false,
      },
    ];
    const db = {
      select: jest.fn(() => selectChain(rows)),
    };
    const svc = new EtiquetasDesossaService({ db } as never);
    const page1 = await svc.listar({
      operacaoId,
      transformacaoId,
      estado: 'emitida',
      page: 1,
      pageSize: 2,
    });
    expect(page1.total).toBe(3);
    expect(page1.data).toHaveLength(2);
    expect(page1.data[0]).toMatchObject({
      origemPeso: 'balanca',
      destino: 'pedido',
      clientePedido: 'Cliente A / ped-1',
      bloqueada: true,
      pendenteImpressao: true,
      invalidadaEm: null,
    });
    expect(page1.data[1]).toMatchObject({
      origemPeso: 'manual',
      destino: 'pedido',
      clientePedido: 'ped-2',
      bloqueada: false,
      pendenteImpressao: false,
      invalidadaEm: '2026-07-31T12:00:00.000Z',
    });

    const page2 = await svc.listar({
      operacaoId,
      page: 2,
      pageSize: 2,
    });
    expect(page2.data).toHaveLength(1);
    expect(page2.data[0]).toMatchObject({
      origemPeso: 'outro',
      destino: 'estoque',
      clientePedido: null,
      bloqueada: false,
    });
  });
});
