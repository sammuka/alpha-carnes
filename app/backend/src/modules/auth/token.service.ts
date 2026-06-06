import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

export interface AccessTokenPayload extends CurrentUserPayload {
  iat: number;
  exp: number;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: CurrentUserPayload): string {
    return this.jwtService.sign(
      {
        sub: payload.sub,
        nome: payload.nome,
        perfis: payload.perfis,
        permissoes: payload.permissoes,
      },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      },
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwtService.verify<AccessTokenPayload>(token, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString('hex');
  }

  getRefreshExpiresAt(): Date {
    const ttl = this.config.get<string>('JWT_REFRESH_TTL') ?? '8h';
    const hours = parseInt(ttl.replace('h', ''), 10);
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }
}
