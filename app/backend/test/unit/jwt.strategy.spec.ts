import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../../src/modules/auth/jwt.strategy';

describe('JwtStrategy (unit)', () => {
  const config = {
    getOrThrow: () => 'test-access-secret-min-32-chars-ok',
  };
  const strategy = new JwtStrategy(config as never);

  it('retorna o payload do usuário quando há sub', () => {
    const user = strategy.validate({
      sub: 'u1',
      nome: 'Admin',
      perfis: ['administrador'],
      permissoes: ['USUARIOS_GERENCIAR'],
      iat: 1,
      exp: 2,
    });
    expect(user.sub).toBe('u1');
    expect(user.permissoes).toContain('USUARIOS_GERENCIAR');
  });

  it('lança UnauthorizedException quando o payload não tem sub', () => {
    expect(() =>
      strategy.validate({ sub: '', nome: '', perfis: [], permissoes: [], iat: 1, exp: 2 }),
    ).toThrow(UnauthorizedException);
  });
});
