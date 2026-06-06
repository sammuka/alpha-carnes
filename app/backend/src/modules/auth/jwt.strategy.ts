import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  nome: string;
  perfis: string[];
  permissoes: string[];
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: { cookies?: Record<string, string> } | null) =>
          req?.cookies?.['access_token'] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload): CurrentUserPayload {
    if (!payload.sub) throw new UnauthorizedException();
    return {
      sub: payload.sub,
      nome: payload.nome,
      perfis: payload.perfis,
      permissoes: payload.permissoes,
    };
  }
}
