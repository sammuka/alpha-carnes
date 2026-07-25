import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verify } from '@node-rs/argon2';
import { createHash } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
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

  async montarMe(user: CurrentUserPayload): Promise<CurrentUserPayload & { menusVisiveis: string[] }> {
    return { ...user, menusVisiveis: await this.rbacService.menusVisiveisDePerfis(user.perfis) };
  }

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
    if (storedToken.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expirado');

    if (storedToken.revokedAt) {
      // Reuse detection (R2): token já foi rotacionado ou revogado — possível ataque de replay.
      // Revogar toda a família de tokens do usuário como medida de segurança.
      this.logger.warn(
        { usuarioId: storedToken.usuarioId },
        'Reuse detection: refresh token já revogado; revogando todos os tokens do usuário',
      );
      await this.authRepository.revokeAllUserRefreshTokens(storedToken.usuarioId);
      throw new UnauthorizedException('Refresh token revogado — sessão encerrada por segurança');
    }

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

    // Rotação atômica (R2): save novo + revogar antigo em uma transação
    await this.authRepository.rotateRefreshToken(tokenHash, {
      usuarioId: storedToken.usuarioId,
      tokenHash: newRefreshTokenHash,
      expiresAt: this.tokenService.getRefreshExpiresAt(),
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

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
