import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as argon2 from '@node-rs/argon2';
import { AuthService } from '../../src/modules/auth/auth.service';

jest.mock('@node-rs/argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

const mockVerify = argon2.verify as jest.Mock;

function makeService() {
  const authRepository = {
    findUsuarioByEmail: jest.fn(),
    findUsuarioComPerfisPermissoes: jest.fn(),
    saveRefreshToken: jest.fn(),
    findRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllUserRefreshTokens: jest.fn(),
    updateUltimoAcesso: jest.fn(),
  };
  const tokenService = {
    signAccessToken: jest.fn().mockReturnValue('access.jwt'),
    generateRefreshToken: jest.fn().mockReturnValue('raw-refresh'),
    getRefreshExpiresAt: jest.fn().mockReturnValue(new Date(Date.now() + 3600_000)),
  };
  const logger = { warn: jest.fn(), error: jest.fn() };
  const service = new AuthService(
    authRepository as never,
    tokenService as never,
    {} as never,
    logger as never,
  );
  return { service, authRepository, tokenService, logger };
}

const usuarioAtivo = {
  id: 'u1',
  nome: 'Admin',
  email: 'a@b.com',
  senhaHash: 'hash',
  ativo: true,
};

describe('AuthService (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('login', () => {
    it('lança 401 quando usuário não existe', async () => {
      const { service, authRepository } = makeService();
      authRepository.findUsuarioByEmail.mockResolvedValue(null);
      await expect(service.login('x@y.com', 'senha', {})).rejects.toThrow(UnauthorizedException);
    });

    it('lança 401 quando a senha é inválida', async () => {
      const { service, authRepository } = makeService();
      authRepository.findUsuarioByEmail.mockResolvedValue(usuarioAtivo);
      mockVerify.mockResolvedValue(false);
      await expect(service.login('a@b.com', 'errada', {})).rejects.toThrow(UnauthorizedException);
    });

    it('lança 401 quando o usuário está inativo', async () => {
      const { service, authRepository } = makeService();
      authRepository.findUsuarioByEmail.mockResolvedValue({ ...usuarioAtivo, ativo: false });
      mockVerify.mockResolvedValue(true);
      await expect(service.login('a@b.com', 'senha', {})).rejects.toThrow('Usuário inativo');
    });

    it('lança 401 quando perfis/permissões não resolvem', async () => {
      const { service, authRepository } = makeService();
      authRepository.findUsuarioByEmail.mockResolvedValue(usuarioAtivo);
      mockVerify.mockResolvedValue(true);
      authRepository.findUsuarioComPerfisPermissoes.mockResolvedValue(null);
      await expect(service.login('a@b.com', 'senha', {})).rejects.toThrow(UnauthorizedException);
    });

    it('retorna tokens e persiste refresh em login válido', async () => {
      const { service, authRepository, tokenService } = makeService();
      authRepository.findUsuarioByEmail.mockResolvedValue(usuarioAtivo);
      mockVerify.mockResolvedValue(true);
      authRepository.findUsuarioComPerfisPermissoes.mockResolvedValue({
        ...usuarioAtivo,
        perfis: ['administrador'],
        permissoes: ['USUARIOS_GERENCIAR'],
      });

      const result = await service.login('a@b.com', 'senha', { ip: '1.2.3.4', userAgent: 'jest' });

      expect(result.accessToken).toBe('access.jwt');
      expect(result.refreshToken).toBe('raw-refresh');
      expect(result.usuario.perfis).toEqual(['administrador']);
      expect(authRepository.saveRefreshToken).toHaveBeenCalledTimes(1);
      expect(authRepository.updateUltimoAcesso).toHaveBeenCalledWith('u1');
      // refresh é persistido como hash, nunca em claro
      const saved = authRepository.saveRefreshToken.mock.calls[0][0];
      expect(saved.tokenHash).toBe(createHash('sha256').update('raw-refresh').digest('hex'));
      expect(saved.tokenHash).not.toBe('raw-refresh');
    });
  });

  describe('refresh', () => {
    it('lança 401 quando o token não existe', async () => {
      const { service, authRepository } = makeService();
      authRepository.findRefreshToken.mockResolvedValue(null);
      await expect(service.refresh('raw', {})).rejects.toThrow('Refresh token inválido');
    });

    it('lança 401 quando o token está expirado', async () => {
      const { service, authRepository } = makeService();
      authRepository.findRefreshToken.mockResolvedValue({
        usuarioId: 'u1',
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      });
      await expect(service.refresh('raw', {})).rejects.toThrow('Refresh token expirado');
    });

    it('reuse detection: token revogado → revoga família e lança 401', async () => {
      const { service, authRepository, logger } = makeService();
      authRepository.findRefreshToken.mockResolvedValue({
        usuarioId: 'u1',
        expiresAt: new Date(Date.now() + 1000),
        revokedAt: new Date(),
      });
      await expect(service.refresh('raw', {})).rejects.toThrow('sessão encerrada por segurança');
      expect(authRepository.revokeAllUserRefreshTokens).toHaveBeenCalledWith('u1');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('lança 401 quando perfis não resolvem no refresh', async () => {
      const { service, authRepository } = makeService();
      authRepository.findRefreshToken.mockResolvedValue({
        usuarioId: 'u1',
        expiresAt: new Date(Date.now() + 10_000),
        revokedAt: null,
      });
      authRepository.findUsuarioComPerfisPermissoes.mockResolvedValue(null);
      await expect(service.refresh('raw', {})).rejects.toThrow(UnauthorizedException);
    });

    it('rotaciona atomicamente em refresh válido', async () => {
      const { service, authRepository } = makeService();
      authRepository.findRefreshToken.mockResolvedValue({
        usuarioId: 'u1',
        expiresAt: new Date(Date.now() + 10_000),
        revokedAt: null,
      });
      authRepository.findUsuarioComPerfisPermissoes.mockResolvedValue({
        ...usuarioAtivo,
        perfis: ['administrador'],
        permissoes: [],
      });

      const result = await service.refresh('raw', { ip: '1.1.1.1' });
      expect(result.accessToken).toBe('access.jwt');
      expect(authRepository.rotateRefreshToken).toHaveBeenCalledTimes(1);
      const [oldHash, novo] = authRepository.rotateRefreshToken.mock.calls[0];
      expect(oldHash).toBe(createHash('sha256').update('raw').digest('hex'));
      expect(novo.usuarioId).toBe('u1');
    });
  });

  describe('logout', () => {
    it('revoga o refresh token', async () => {
      const { service, authRepository } = makeService();
      await service.logout('raw');
      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(
        createHash('sha256').update('raw').digest('hex'),
      );
    });

    it('não propaga erro se a revogação falhar (best-effort)', async () => {
      const { service, authRepository, logger } = makeService();
      authRepository.revokeRefreshToken.mockRejectedValue(new Error('db down'));
      await expect(service.logout('raw')).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
