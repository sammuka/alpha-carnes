import { NotFoundException } from '@nestjs/common';
import { ComparativoService } from '../../src/modules/gestao/aprovacoes/comparativo.service';

function chain(result: unknown) {
  const terminal: Record<string, unknown> = {};
  const self = () => terminal;
  terminal.where = self;
  terminal.leftJoin = self;
  terminal.from = self;
  terminal.then = (cb: (r: unknown) => unknown) => Promise.resolve(result).then(cb as never);
  return { from: () => terminal };
}

describe('ComparativoService — branches', () => {
  function service(db: object) {
    return new ComparativoService({ db } as never);
  }

  it('doOcorrencia 404 quando ocorrência inexistente', async () => {
    const db = { select: jest.fn(() => chain([])) };
    await expect(service(db).doOcorrencia('occ-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('doOcorrencia 404 quando ocorrência sem conclusão de conferência', async () => {
    const db = {
      select: jest.fn(() => chain([{ id: 'occ-1', conclusaoConferenciaId: null }])),
    };
    await expect(service(db).doOcorrencia('occ-1')).rejects.toMatchObject({
      response: { codigo: 'CONCLUSAO_INEXISTENTE' },
    });
  });

  it('doOcorrencia 404 quando conclusão não encontrada', async () => {
    let call = 0;
    const db = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) return chain([{ id: 'occ-1', conclusaoConferenciaId: 'cc-1' }]);
        return chain([]);
      }),
    };
    await expect(service(db).doOcorrencia('occ-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('doOcorrencia monta comparativo com difPeso e catálogo parcial', async () => {
    let call = 0;
    const db = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) {
          return chain([{ id: 'occ-1', conclusaoConferenciaId: 'cc-1' }]);
        }
        if (call === 2) {
          return chain([{
            id: 'cc-1',
            quadroJson: [
              {
                produtoId: 'item-1',
                qtdPedido: '10.000',
                qtdNf: '9.000',
                qtdApurada: '9.500',
                pesoNf: '100.000',
                pesoApurado: '101.000',
                situacao: 'divergente',
              },
              {
                produtoId: 'item-desconhecido',
                qtdPedido: '1.000',
                qtdNf: '1.000',
                qtdApurada: '1.000',
                pesoNf: null,
                pesoApurado: '5.000',
                situacao: 'ok',
              },
            ],
            resultado: 'com_divergencia',
            concluidaEm: new Date('2026-06-23T10:00:00Z'),
            concluidaPorNome: null,
          }]);
        }
        return chain([{ id: 'item-1', codigo: 'TZ', descricao: 'Traseiro' }]);
      }),
    };

    const res = await service(db).doOcorrencia('occ-1');
    expect(res.imutavel).toBe(true);
    expect(res.concluidaPorNome).toBeNull();
    expect(res.itens[0]?.difPeso).toBe('1.000');
    expect(res.itens[0]?.codigo).toBe('TZ');
    expect(res.itens[1]?.difPeso).toBeNull();
    expect(res.itens[1]?.codigo).toBeNull();
  });
});
