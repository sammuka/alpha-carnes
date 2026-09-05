import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  buscarNfAtivaDoRecebimento,
  extrairPayloadNfUi,
  mapearCamposNfParaRegistrar,
  mesclarPayloadNfCabecalho,
  mesclarPayloadNfCompleta,
  montarPatchCabecalhoUi,
  persistirNfDeCamposUiNaTx,
  persistirNfEstruturadaNaTx,
  temCamposNfEstruturados,
} from '../../src/modules/operacao/recebimento/nota-fiscal-fornecedor.persistence';

function chainRows(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  c.from = self;
  c.where = self;
  c.orderBy = self;
  c.limit = self;
  c.for = self;
  c.then = (cb: (r: unknown[]) => unknown) => Promise.resolve(cb(rows));
  return c;
}

function nfBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nf-1',
    pedidoFornecedorId: 'pf-1',
    recebimentoId: 'rec-1',
    numero: '100',
    serie: '1',
    chave: null,
    dataEmissao: null,
    pesoTotalDeclarado: null,
    payloadJson: {},
    deletedAt: null,
    ...overrides,
  };
}

const itemDto = [{ produtoId: '019ea000-0000-7000-8000-0000000000ic', quantidadeDeclarada: 1 }];

describe('nota-fiscal-fornecedor.persistence', () => {
  it('temCamposNfEstruturados detecta campos parciais', () => {
    expect(temCamposNfEstruturados({ nfeSerie: '1' })).toBe(true);
    expect(temCamposNfEstruturados({ romaneio: 'x' } as never)).toBe(false);
  });

  it('mapearCamposNfParaRegistrar grava pesoLiquido no payload sem usar como bruto', () => {
    const dto = mapearCamposNfParaRegistrar(
      {
        nfeNumero: '123',
        nfePesoLiquido: 900,
        nfeVolumes: 12,
      },
      'rec-1',
      [{ produtoId: '019ea000-0000-7000-8000-0000000000ic', quantidadeDeclarada: 1 }],
    );
    expect(dto.pesoTotalDeclarado).toBeUndefined();
    expect(dto.payload).toEqual({ pesoLiquido: 900, volumes: 12 });
  });

  it('mapearCamposNfParaRegistrar prefere peso bruto explícito', () => {
    const dto = mapearCamposNfParaRegistrar(
      {
        nfeNumero: '123',
        nfePesoBruto: 1000,
        nfePesoLiquido: 900,
      },
      'rec-1',
      [{ produtoId: '019ea000-0000-7000-8000-0000000000ic', quantidadeDeclarada: 1 }],
    );
    expect(dto.pesoTotalDeclarado).toBe(1000);
    expect(dto.payload).toEqual({ pesoLiquido: 900 });
  });

  it('mesclarPayloadNfCabecalho preserva campos existentes e não carimba migracao', () => {
    const merged = mesclarPayloadNfCabecalho(
      { pesoLiquido: 3000, volumes: 45, migracao: 'legado_sem_itens_nf' },
      { nfeSerie: '2' },
      true,
    );
    expect(merged).toEqual({
      pesoLiquido: 3000,
      volumes: 45,
      cabecalho_sem_itens: true,
    });
    expect(merged).not.toHaveProperty('migracao');
  });

  it('mesclarPayloadNfCabecalho atualiza só chaves enviadas no patch parcial', () => {
    const merged = mesclarPayloadNfCabecalho(
      { pesoLiquido: 3000, volumes: 45 },
      { nfeVolumes: 50 },
      true,
    );
    expect(merged).toEqual({
      pesoLiquido: 3000,
      volumes: 50,
      cabecalho_sem_itens: true,
    });
  });

  it('mesclarPayloadNfCompleta remove marcadores de cabeçalho ao completar com itens', () => {
    const merged = mesclarPayloadNfCompleta(
      { cabecalho_sem_itens: true, migracao: 'legado_sem_itens_nf', pesoLiquido: 900 },
      { volumes: 12 },
    );
    expect(merged).toEqual({ pesoLiquido: 900, volumes: 12 });
    expect(merged).not.toHaveProperty('cabecalho_sem_itens');
    expect(merged).not.toHaveProperty('migracao');
  });

  it('cabecalho_sem_itens é true apenas com itensAtivos === 0', () => {
    expect(mesclarPayloadNfCabecalho(null, { nfeVolumes: 1 }, true)).toHaveProperty('cabecalho_sem_itens', true);
    expect(mesclarPayloadNfCabecalho({ cabecalho_sem_itens: true }, { nfeVolumes: 1 }, false))
      .not.toHaveProperty('cabecalho_sem_itens');
  });

  it('montarPatchCabecalhoUi mantém peso do existente quando o patch não traz peso', () => {
    const patch = montarPatchCabecalhoUi(
      { nfeSerie: '9' },
      { pesoTotalDeclarado: '123.456' } as never,
    );
    expect(patch.serie).toBe('9');
    expect(patch.pesoTotalDeclarado).toBe('123.456');
  });

  it('mapearCamposNfParaRegistrar exige nfeNumero e lança BadRequest sem ele', () => {
    expect(() => mapearCamposNfParaRegistrar(
      { nfeSerie: '1' },
      'rec-1',
      [{ produtoId: '019ea000-0000-7000-8000-0000000000ic', quantidadeDeclarada: 1 }],
    )).toThrow(/nfeNumero/i);
  });

  it('extrairPayloadNfUi omite chaves não enviadas e preserva extras', () => {
    expect(extrairPayloadNfUi({ nfeVolumes: 3 }, { origem: 'ui' })).toEqual({ origem: 'ui', volumes: 3 });
    expect(extrairPayloadNfUi({})).toEqual({});
  });

  it('mesclarPayloadNfCompleta remove cabecalho_sem_itens ao completar com itens', () => {
    const merged = mesclarPayloadNfCompleta({ cabecalho_sem_itens: true, volumes: 1 }, { pesoLiquido: 10 });
    expect(merged).not.toHaveProperty('cabecalho_sem_itens');
    expect(merged).toEqual({ volumes: 1, pesoLiquido: 10 });
  });

  it('temCamposNfEstruturados cobre cada um dos sete campos isoladamente', () => {
    const campos = [
      'nfeNumero', 'nfeSerie', 'nfeChave', 'nfeDataEmissao',
      'nfePesoBruto', 'nfePesoLiquido', 'nfeVolumes',
    ] as const;
    for (const c of campos) {
      expect(temCamposNfEstruturados({ [c]: c === 'nfeNumero' ? '1' : 1 })).toBe(true);
    }
    expect(temCamposNfEstruturados({})).toBe(false);
  });

  it('mesclarPayloadNfCompleta aceita existente e novo null/undefined', () => {
    expect(mesclarPayloadNfCompleta(null, undefined)).toEqual({});
    expect(mesclarPayloadNfCompleta(undefined, { a: 1 })).toEqual({ a: 1 });
  });

  it('montarPatchCabecalhoUi preenche todos os campos quando informados', () => {
    const patch = montarPatchCabecalhoUi({
      nfeSerie: '2',
      nfeChave: 'chave',
      nfeDataEmissao: '2026-01-01',
      nfePesoBruto: 1500.5,
    });
    expect(patch).toEqual({
      serie: '2',
      chave: 'chave',
      dataEmissao: '2026-01-01',
      pesoTotalDeclarado: '1500.500',
    });
  });

  it('mapearCamposNfParaRegistrar omite payload quando vazio', () => {
    const dto = mapearCamposNfParaRegistrar({ nfeNumero: '999' }, 'rec-1', itemDto);
    expect(dto.payload).toBeUndefined();
  });

  it('buscarNfAtivaDoRecebimento retorna null quando vazio', async () => {
    const tx = { select: jest.fn(() => chainRows([])) };
    const res = await buscarNfAtivaDoRecebimento(tx as never, 'rec-1');
    expect(res).toBeNull();
  });

  it('buscarNfAtivaDoRecebimento retorna primeira NF', async () => {
    const tx = { select: jest.fn(() => chainRows([nfBase({ numero: '200' })])) };
    const res = await buscarNfAtivaDoRecebimento(tx as never, 'rec-1');
    expect(res?.numero).toBe('200');
  });
});

describe('persistirNfEstruturadaNaTx — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejeita NF sem itens', async () => {
    const tx = {};
    await expect(
      persistirNfEstruturadaNaTx(tx as never, auditoria as never, {
        pedidoFornecedorId: 'pf-1',
        recebimentoId: 'rec-1',
        dto: {
          numero: '1',
          itens: [],
          recebimentoId: 'rec-1',
          confirmarSubstituicaoCabecalho: false,
        },
        usuarioId: 'u1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('NotFoundException se pedido ao fornecedor não existe', async () => {
    const tx = { select: jest.fn(() => chainRows([])) };
    await expect(
      persistirNfEstruturadaNaTx(tx as never, auditoria as never, {
        pedidoFornecedorId: 'pf-x',
        recebimentoId: 'rec-1',
        dto: { numero: '1', itens: itemDto, recebimentoId: 'rec-1', confirmarSubstituicaoCabecalho: false },
        usuarioId: 'u1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('NotFoundException se recebimento não pertence ao pedido', async () => {
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) return chainRows([{ id: 'pf-1' }]);
        return chainRows([]);
      }),
    };
    await expect(
      persistirNfEstruturadaNaTx(tx as never, auditoria as never, {
        pedidoFornecedorId: 'pf-1',
        recebimentoId: 'rec-x',
        dto: { numero: '1', itens: itemDto, recebimentoId: 'rec-x', confirmarSubstituicaoCabecalho: false },
        usuarioId: 'u1',
      }),
    ).rejects.toThrow('Recebimento não encontrado');
  });

  it('ConflictException CABECALHO_ORFAO_DIVERGENTE sem confirmação', async () => {
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) return chainRows([{ id: 'pf-1' }]);
        if (call === 2) return chainRows([{ id: 'rec-1', pedidoFornecedorId: 'pf-1' }]);
        // D6.10 — existeOrfaoNoRecebimento: snapshot pré-lock (sem candidatas, não influi neste caso)
        if (call === 3) return chainRows([]);
        if (call === 4) return chainRows([]);
        if (call === 5) return chainRows([nfBase({ numero: '50' })]);
        return chainRows([]);
      }),
    };
    await expect(
      persistirNfEstruturadaNaTx(tx as never, auditoria as never, {
        pedidoFornecedorId: 'pf-1',
        recebimentoId: 'rec-1',
        dto: {
          numero: '99',
          itens: itemDto,
          recebimentoId: 'rec-1',
          confirmarSubstituicaoCabecalho: false,
        },
        usuarioId: 'u1',
      }),
    ).rejects.toMatchObject({ response: { codigo: 'CABECALHO_ORFAO_DIVERGENTE' } });
  });

  it('completa cabeçalho órfão divergente com confirmação', async () => {
    const orfao = nfBase({ numero: '50', pesoTotalDeclarado: '100.000' });
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) return chainRows([{ id: 'pf-1' }]);
        if (call === 2) return chainRows([{ id: 'rec-1', pedidoFornecedorId: 'pf-1' }]);
        // D6.10 — existeOrfaoNoRecebimento: snapshot pré-lock (irrelevante, confirmarSubstituicaoCabecalho=true bypassa o guard novo)
        if (call === 3) return chainRows([]);
        if (call === 4) return chainRows([]);
        if (call === 5) return chainRows([orfao]);
        return chainRows([]);
      }),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...orfao, numero: '99' }])),
          })),
        })),
      })),
      insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
    };
    const res = await persistirNfEstruturadaNaTx(tx as never, auditoria as never, {
      pedidoFornecedorId: 'pf-1',
      recebimentoId: 'rec-1',
      dto: {
        numero: '99',
        serie: '3',
        chave: 'k1',
        dataEmissao: '2026-02-01',
        itens: [{ ...itemDto[0]!, pesoDeclarado: undefined }],
        recebimentoId: 'rec-1',
        confirmarSubstituicaoCabecalho: true,
      },
      usuarioId: 'u1',
    });
    expect(res.numero).toBe('99');
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('completa cabeçalho órfão com mesmo número', async () => {
    const orfao = nfBase({ numero: '100' });
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) return chainRows([{ id: 'pf-1' }]);
        if (call === 2) return chainRows([{ id: 'rec-1', pedidoFornecedorId: 'pf-1' }]);
        // D6.10 — existeOrfaoNoRecebimento: snapshot pré-lock (candidatas + contagem de itens);
        // irrelevante para este teste — numero===dto.numero nunca aciona o guard novo
        if (call === 3) return chainRows([orfao]);
        if (call === 4) return chainRows([]);
        // buscarNfCabecalhoAtivaPorNumero: candidatas + contagem de itens
        if (call === 5) return chainRows([orfao]);
        if (call === 6) return chainRows([]);
        return chainRows([]);
      }),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([orfao])),
          })),
        })),
      })),
      insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
    };
    const res = await persistirNfEstruturadaNaTx(tx as never, auditoria as never, {
      pedidoFornecedorId: 'pf-1',
      recebimentoId: 'rec-1',
      dto: {
        numero: '100',
        pesoTotalDeclarado: undefined,
        payload: { volumes: 2 },
        itens: itemDto,
        recebimentoId: 'rec-1',
        confirmarSubstituicaoCabecalho: false,
      },
      usuarioId: 'u1',
    });
    expect(res.id).toBe('nf-1');
  });

  it('insere NF nova quando não há cabeçalho órfão', async () => {
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) return chainRows([{ id: 'pf-1' }]);
        if (call === 2) return chainRows([{ id: 'rec-1', pedidoFornecedorId: 'pf-1' }]);
        return chainRows([]);
      }),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([nfBase({ numero: '300' })])),
        })),
      })),
    };
    const res = await persistirNfEstruturadaNaTx(tx as never, auditoria as never, {
      pedidoFornecedorId: 'pf-1',
      recebimentoId: 'rec-1',
      dto: {
        numero: '300',
        itens: [{ ...itemDto[0]!, pesoDeclarado: 12.5 }],
        recebimentoId: 'rec-1',
        confirmarSubstituicaoCabecalho: false,
      },
      usuarioId: 'u1',
    });
    expect(res.numero).toBe('300');
  });

  it('ignora NF candidata que já possui itens ativos', async () => {
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) return chainRows([{ id: 'pf-1' }]);
        if (call === 2) return chainRows([{ id: 'rec-1', pedidoFornecedorId: 'pf-1' }]);
        if (call === 3) return chainRows([nfBase({ id: 'nf-com-itens', numero: '10' })]);
        if (call === 4) return chainRows([{ id: 'item-1' }]);
        return chainRows([]);
      }),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([nfBase({ id: 'nf-nova', numero: '10' })])),
        })),
      })),
    };
    const res = await persistirNfEstruturadaNaTx(tx as never, auditoria as never, {
      pedidoFornecedorId: 'pf-1',
      recebimentoId: 'rec-1',
      dto: { numero: '10', itens: itemDto, recebimentoId: 'rec-1', confirmarSubstituicaoCabecalho: false },
      usuarioId: 'u1',
    });
    expect(res.id).toBe('nf-nova');
  });
});

describe('persistirNfDeCamposUiNaTx — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => jest.clearAllMocks());

  it('persiste só cabeçalho UI quando não há itens', async () => {
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) return chainRows([{ id: 'pf-1' }]);
        if (call === 2) return chainRows([{ id: 'rec-1', pedidoFornecedorId: 'pf-1' }]);
        return chainRows([]);
      }),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([nfBase({ numero: '400' })])),
        })),
      })),
    };
    const res = await persistirNfDeCamposUiNaTx(tx as never, auditoria as never, {
      pedidoFornecedorId: 'pf-1',
      recebimentoId: 'rec-1',
      campos: { nfeNumero: '400', nfeSerie: '1', nfeChave: 'c', nfeDataEmissao: '2026-01-01' },
      usuarioId: 'u1',
    });
    expect(res.numero).toBe('400');
  });

  it('BadRequestException sem nfeNumero no cabeçalho UI', async () => {
    const tx = { select: jest.fn(() => chainRows([{ id: 'pf-1' }])) };
    await expect(
      persistirNfDeCamposUiNaTx(tx as never, auditoria as never, {
        pedidoFornecedorId: 'pf-1',
        recebimentoId: 'rec-1',
        campos: { nfeSerie: '1' },
        usuarioId: 'u1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('atualiza cabeçalho existente sem itens', async () => {
    const existente = nfBase({ numero: '500', payloadJson: { volumes: 1 } });
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) return chainRows([{ id: 'pf-1' }]);
        if (call === 2) return chainRows([{ id: 'rec-1', pedidoFornecedorId: 'pf-1' }]);
        if (call === 3) return chainRows([existente]);
        return chainRows([]);
      }),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...existente, numero: '501' }])),
          })),
        })),
      })),
    };
    const res = await persistirNfDeCamposUiNaTx(tx as never, auditoria as never, {
      pedidoFornecedorId: 'pf-1',
      recebimentoId: 'rec-1',
      campos: { nfeNumero: '501', nfeVolumes: 5, nfePesoBruto: 2000 },
      usuarioId: 'u1',
    });
    expect(res.numero).toBe('501');
  });

  it('prefere NF com itens ao atualizar cabeçalho', async () => {
    const comItens = nfBase({ id: 'nf-ci', numero: '600' });
    const orfao = nfBase({ id: 'nf-orf', numero: '601' });
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) return chainRows([{ id: 'pf-1' }]);
        if (call === 2) return chainRows([{ id: 'rec-1', pedidoFornecedorId: 'pf-1' }]);
        if (call === 3) return chainRows([comItens, orfao]);
        if (call === 4) return chainRows([{ id: 'i1' }, { id: 'i2' }]);
        return chainRows([]);
      }),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([comItens])),
          })),
        })),
      })),
    };
    const res = await persistirNfDeCamposUiNaTx(tx as never, auditoria as never, {
      pedidoFornecedorId: 'pf-1',
      recebimentoId: 'rec-1',
      campos: { nfeNumero: '600', nfePesoLiquido: 900 },
      usuarioId: 'u1',
    });
    expect(res.id).toBe('nf-ci');
  });

  it('delega para persistirNfEstruturadaNaTx quando itens informados', async () => {
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call += 1;
        if (call === 1) return chainRows([{ id: 'pf-1' }]);
        if (call === 2) return chainRows([{ id: 'rec-1', pedidoFornecedorId: 'pf-1' }]);
        return chainRows([]);
      }),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([nfBase({ numero: '700' })])),
        })),
      })),
    };
    const res = await persistirNfDeCamposUiNaTx(tx as never, auditoria as never, {
      pedidoFornecedorId: 'pf-1',
      recebimentoId: 'rec-1',
      campos: { nfeNumero: '700', nfePesoBruto: 100 },
      itens: itemDto,
      usuarioId: 'u1',
    });
    expect(res.numero).toBe('700');
  });
});