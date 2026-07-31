import { NotFoundException } from '@nestjs/common';
import { SifCalculoService } from '../../src/modules/gestao/sif/sif-calculo.service';

describe('SifCalculoService — branches', () => {
  function service(db: object) {
    return new SifCalculoService({ db } as never);
  }

  it('pendencias mapa_recebimento lista pecas e NF sem chave', async () => {
    const db = {
      execute: jest.fn().mockResolvedValue({
        rows: [{ pecas_sem_destino: 2, nfs_sem_chave: 1 }],
      }),
    };
    const res = await service(db).pendencias('op-1', 'mapa_recebimento');
    expect(res).toEqual([
      '2 pesagem(ns) sem origem informada',
      '1 NF-e sem chave completa cadastrada',
    ]);
  });

  it('pendencias mapa_recebimento vazio quando linha ausente', async () => {
    const db = { execute: jest.fn().mockResolvedValue({ rows: [] }) };
    expect(await service(db).pendencias('op-1', 'mapa_recebimento')).toEqual([]);
  });

  it.each([
    ['producao_desossa', 3, ['3 transformação(ões) em aberto na desossa']],
    ['controle_expedicao', 2, ['2 caminhão(ões) com carga não fechada']],
    ['perdas_destinacao', 1, ['1 divergência(s) de recebimento em aberto']],
  ] as const)('pendencias %s com total > 0', async (tipo, total, esperado) => {
    const db = { execute: jest.fn().mockResolvedValue({ rows: [{ total }] }) };
    expect(await service(db).pendencias('op-1', tipo)).toEqual(esperado);
  });

  it.each([
    'producao_desossa',
    'controle_expedicao',
    'perdas_destinacao',
  ] as const)('pendencias %s retorna vazio quando total = 0', async (tipo) => {
    const db = { execute: jest.fn().mockResolvedValue({ rows: [{ total: 0 }] }) };
    expect(await service(db).pendencias('op-1', tipo)).toEqual([]);
  });

  it('conteudo 404 quando operação inexistente', async () => {
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      })),
    };
    await expect(service(db).conteudo('op-missing', 'mapa_recebimento'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('conteudo monta payload com numeros vazios quando query não retorna linha', async () => {
    const db = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([{
            id: 'op-1',
            data: '2026-06-23',
            rotulo: 'Dia',
          }]),
        }),
      })),
      execute: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const res = await service(db).conteudo('op-1', 'controle_expedicao');
    expect(res.tipo).toBe('controle_expedicao');
    expect(res.operacao).toEqual({ id: 'op-1', data: '2026-06-23', rotulo: 'Dia' });
    expect(res.numeros).toEqual({});
  });
});
