import {
  atualizarNfeSchema,
  iniciarRecebimentoSchema,
} from '../../src/modules/operacao/recebimento/dto/recebimento.dto';

describe('iniciarRecebimentoSchema', () => {
  const base = {
    compraProgramadaId: '019ea000-0000-7000-8000-000000000001',
    nfeNumero: '123456',
  };

  it('aceita payload mínimo com NF', () => {
    const parsed = iniciarRecebimentoSchema.parse(base);
    expect(parsed.nfeNumero).toBe('123456');
    expect(parsed.iniciarConferencia).toBe(false);
  });

  it('rejeita NF vazia', () => {
    expect(() =>
      iniciarRecebimentoSchema.parse({ ...base, nfeNumero: '   ' }),
    ).toThrow();
  });

  it('transforma chave vazia em undefined', () => {
    const parsed = iniciarRecebimentoSchema.parse({ ...base, nfeChave: '' });
    expect(parsed.nfeChave).toBeUndefined();
  });

  it('aceita chave com 44 dígitos', () => {
    const chave = '1'.repeat(44);
    const parsed = iniciarRecebimentoSchema.parse({ ...base, nfeChave: chave });
    expect(parsed.nfeChave).toBe(chave);
  });

  it('rejeita chave com tamanho inválido', () => {
    expect(() =>
      iniciarRecebimentoSchema.parse({ ...base, nfeChave: '123' }),
    ).toThrow();
  });
});

describe('atualizarNfeSchema', () => {
  it('aceita patch parcial só com romaneio', () => {
    const parsed = atualizarNfeSchema.parse({ romaneio: 'ROM-1' });
    expect(parsed.romaneio).toBe('ROM-1');
    expect(parsed.nfeNumero).toBeUndefined();
  });

  it('transforma chave vazia em undefined', () => {
    const parsed = atualizarNfeSchema.parse({ nfeChave: '' });
    expect(parsed.nfeChave).toBeUndefined();
  });

  it('aceita pesos e volumes opcionais', () => {
    const parsed = atualizarNfeSchema.parse({
      nfePesoBruto: 100.5,
      nfePesoLiquido: 90,
      nfeVolumes: 12,
    });
    expect(parsed.nfePesoBruto).toBe(100.5);
    expect(parsed.nfeVolumes).toBe(12);
  });
});
