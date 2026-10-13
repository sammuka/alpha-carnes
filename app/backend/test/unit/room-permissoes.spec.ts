import { PERMISSOES } from '../../src/common/rbac/permissoes';
import { permissaoParaRoom, ROOMS_PROTEGIDAS } from '../../src/realtime/room-permissoes';

describe('room-permissoes', () => {
  it('fiscal-empresas exige FISCAL_EMPRESAS_LER', () => {
    expect(ROOMS_PROTEGIDAS['fiscal-empresas']).toBe(PERMISSOES.FISCAL_EMPRESAS_LER);
    expect(permissaoParaRoom('fiscal-empresas')).toBe('FISCAL_EMPRESAS_LER');
  });

  it('room legada continua exigindo DISPONIBILIDADE_LER', () => {
    expect(permissaoParaRoom('dashboard')).toBe(PERMISSOES.DISPONIBILIDADE_LER);
    expect(permissaoParaRoom('operacao:2026-10-13')).toBe('DISPONIBILIDADE_LER');
  });
});
