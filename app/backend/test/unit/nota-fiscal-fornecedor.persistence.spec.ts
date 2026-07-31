import {
  extrairPayloadNfUi,
  mapearCamposNfParaRegistrar,
  mesclarPayloadNfCabecalho,
  mesclarPayloadNfCompleta,
  montarPatchCabecalhoUi,
  temCamposNfEstruturados,
} from '../../src/modules/operacao/recebimento/nota-fiscal-fornecedor.persistence';

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
      [{ itemComercialId: '019ea000-0000-7000-8000-0000000000ic', quantidadeDeclarada: 1 }],
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
      [{ itemComercialId: '019ea000-0000-7000-8000-0000000000ic', quantidadeDeclarada: 1 }],
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
      [{ itemComercialId: '019ea000-0000-7000-8000-0000000000ic', quantidadeDeclarada: 1 }],
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
});