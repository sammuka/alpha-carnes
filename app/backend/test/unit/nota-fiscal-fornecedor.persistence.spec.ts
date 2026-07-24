import {
  mapearCamposNfParaRegistrar,
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
});
