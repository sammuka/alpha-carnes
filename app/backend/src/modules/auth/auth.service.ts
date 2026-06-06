import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verify } from '@node-rs/argon2';
import { createHash } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AuthRepository } from './auth.repository';
import { TokenService } from './token.service';
import { RbacService } from './rbac.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
    private readonly rbacService: RbacService,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
  ) {}

  async login(
    email: string,
    senha: string,
    meta: { userAgent?: string; ip?: string },
  ) {
    const usuario = await this.authRepository.findUsuarioByEmail(email);
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

    const senhaValida = await verify(usuario.senhaHash, senha);
    if (!senhaValida) throw new UnauthorizedException('Credenciais inválidas');

    if (!usuario.ativo) throw new UnauthorizedException('Usuário inativo');

    const usuarioComPerfis = await this.authRepository.findUsuarioComPerfisPermissoes(usuario.id);
    if (!usuarioComPerfis) throw new UnauthorizedException();

    const payload = {
      sub: usuario.id,
      nome: usuario.nome,
      perfis: usuarioComPerfis.perfis,
      permissoes: usuarioComPerfis.permissoes,
    };

    const accessToken = this.tokenService.signAccessToken(payload);
    const refreshTokenRaw = this.tokenService.generateRefreshToken();
    const refreshTokenHash = createHash('sha256').update(refreshTokenRaw).digest('hex');

    await this.authRepository.saveRefreshToken({
      usuarioId: usuario.id,
      tokenHash: refreshTokenHash,
      expiresAt: this.tokenService.getRefreshExpiresAt(),
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    await this.authRepository.updateUltimoAcesso(usuario.id);

    return { accessToken, refreshToken: refreshTokenRaw, usuario: payload };
  }

  async refresh(refreshTokenRaw: string, meta: { userAgent?: string; ip?: string }) {
    const tokenHash = createHash('sha256').update(refreshTokenRaw).digest('hex');

    const storedToken = await this.authRepository.findRefreshToken(tokenHash);

    if (!storedToken) throw new UnauthorizedException('Refresh token inválido');
    if (storedToken.revokedAt) throw new UnauthorizedException('Refresh token revogado');
    if (storedToken.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expirado');

    const usuarioComPerfis = await this.authRepository.findUsuarioComPerfisPermissoes(storedToken.usuarioId);
    if (!usuarioComPerfis) throw new UnauthorizedException();

    const payload = {
      sub: usuarioComPerfis.id,
      nome: usuarioComPerfis.nome,
      perfis: usuarioComPerfis.perfis,
      permissoes: usuarioComPerfis.permissoes,
    };

    const newAccessToken = this.tokenService.signAccessToken(payload);
    const newRefreshTokenRaw = this.tokenService.generateRefreshToken();
    const newRefreshTokenHash = createHash('sha256').update(newRefreshTokenRaw).digest('hex');

    const newStored = await this.authRepository.saveRefreshToken({
      usuarioId: storedToken.usuarioId,
      tokenHash: newRefreshTokenHash,
      expiresAt: this.tokenService.getRefreshExpiresAt(),
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    // Revogar o token anterior com referência ao novo
    await this.authRepository.revokeRefreshToken(tokenHash, newStored.id);

    return { accessToken: newAccessToken, refreshToken: newRefreshTokenRaw, usuario: payload };
  }

  async logout(refreshTokenRaw: string) {
    try {
      const tokenHash = createHash('sha256').update(refreshTokenRaw).digest('hex');
      await this.authRepository.revokeRefreshToken(tokenHash);
    } catch {
      this.logger.warn('Falha ao revogar refresh token no logout');
    }
  }
}
