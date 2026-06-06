import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../../src/modules/auth/token.service';

describe('TokenService', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    const jwtService = new JwtService({ secret: 'test-secret-min-32-chars-for-test' });
    const cfgMap: Record<string, string> = {
      JWT_ACCESS_SECRET: 'test-access-secret-min-32-chars-ok',
      JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-chars-ok',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '8h',
    };
    tokenService = new TokenService(jwtService, {
      get: (key: string) => cfgMap[key],
      getOrThrow: (key: string) => {
        const v = cfgMap[key];
        if (!v) throw new Error(`Config key not found: ${key}`);
        return v;
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

  it('getRefreshExpiresAt retorna ~8h à frente', () => {
    const exp = tokenService.getRefreshExpiresAt().getTime();
    const esperado = Date.now() + 8 * 60 * 60 * 1000;
    // tolerância de 5s
    expect(Math.abs(exp - esperado)).toBeLessThan(5000);
  });

  describe('defaults quando a config não define TTL', () => {
    let svc: TokenService;
    beforeEach(() => {
      const jwtService = new JwtService({ secret: 'test-secret-min-32-chars-for-test' });
      // get retorna undefined p/ os TTLs → exercita os branches `?? '15m'` e `?? '8h'`
      const cfg = {
        get: () => undefined,
        getOrThrow: () => 'test-access-secret-min-32-chars-ok',
      };
      svc = new TokenService(jwtService, cfg as never);
    });

    it('usa 15m como TTL default do access token', () => {
      const token = svc.signAccessToken({ sub: 'u', nome: 'n', perfis: [], permissoes: [] });
      const decoded = svc.verifyAccessToken(token);
      expect(decoded.exp - decoded.iat).toBe(900);
    });

    it('usa 8h como TTL default do refresh', () => {
      const exp = svc.getRefreshExpiresAt().getTime();
      const esperado = Date.now() + 8 * 60 * 60 * 1000;
      expect(Math.abs(exp - esperado)).toBeLessThan(5000);
    });
  });
});
