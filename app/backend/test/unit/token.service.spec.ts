import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../../src/modules/auth/token.service';

describe('TokenService', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    const jwtService = new JwtService({ secret: 'test-secret-min-32-chars-for-test' });
    tokenService = new TokenService(jwtService, {
      get: (key: string) => {
        const map: Record<string, string> = {
          JWT_ACCESS_SECRET: 'test-access-secret-min-32-chars-ok',
          JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-chars-ok',
          JWT_ACCESS_TTL: '15m',
          JWT_REFRESH_TTL: '8h',
        };
        return map[key];
      },
    } as never);
  });

  it('gera access token com TTL de 15 minutos', () => {
    const token = tokenService.signAccessToken({ sub: 'user-id', nome: 'Test', perfis: [], permissoes: [] });
    expect(token).toBeTruthy();
    const decoded = tokenService.verifyAccessToken(token);
    expect(decoded.sub).toBe('user-id');
    expect(decoded.exp - decoded.iat).toBe(900); // 15min = 900s
  });

  it('gera refresh token como string aleatória suficientemente longa', () => {
    const token = tokenService.generateRefreshToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it('verifyAccessToken lança em token inválido', () => {
    expect(() => tokenService.verifyAccessToken('token.invalido.assinado')).toThrow();
  });
});
