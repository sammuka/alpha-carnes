import { mascararCep, mascararCpfCnpj, mascararPlaca, mascararTelefone } from '../masks';

describe('mascararCpfCnpj', () => {
  it('formata CPF conforme digita', () => {
    expect(mascararCpfCnpj('12345678901')).toBe('123.456.789-01');
  });
  it('formata CNPJ quando passa de 11 dígitos', () => {
    expect(mascararCpfCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
  it('ignora pontuação colada e corta em 14 dígitos', () => {
    expect(mascararCpfCnpj('11.222.333/0001-81xx99')).toBe('11.222.333/0001-81');
  });
});

describe('mascararCep', () => {
  it('formata 00000-000', () => {
    expect(mascararCep('06010100')).toBe('06010-100');
  });
});

describe('mascararTelefone', () => {
  it('fixo com 10 dígitos', () => {
    expect(mascararTelefone('1136540000')).toBe('(11) 3654-0000');
  });
  it('celular com 11 dígitos', () => {
    expect(mascararTelefone('11987654321')).toBe('(11) 98765-4321');
  });
});

describe('mascararPlaca', () => {
  it('remove pontuação, sobe caixa e corta em 7', () => {
    expect(mascararPlaca('abc-1d23')).toBe('ABC1D23');
    expect(mascararPlaca('abc1234xy')).toBe('ABC1234');
  });
});
