import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard } from '../../src/common/guards/rbac.guard';

function mockCtx(user?: { permissoes?: string[] }) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
}

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as never;
    guard = new RbacGuard(reflector);
  });

  it('permite quando não há permissões requeridas', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(mockCtx())).toBe(true);
  });

  it('nega 403 quando o usuário não tem a permissão exigida', () => {
    reflector.getAllAndOverride.mockReturnValue(['USUARIOS_GERENCIAR']);
    expect(() => guard.canActivate(mockCtx({ permissoes: [] }))).toThrow(ForbiddenException);
  });

  it('nega 403 quando não há usuário autenticado', () => {
    reflector.getAllAndOverride.mockReturnValue(['USUARIOS_GERENCIAR']);
    expect(() => guard.canActivate(mockCtx(undefined))).toThrow(ForbiddenException);
  });

  it('permite quando o usuário tem a permissão exigida', () => {
    reflector.getAllAndOverride.mockReturnValue(['USUARIOS_GERENCIAR']);
    expect(guard.canActivate(mockCtx({ permissoes: ['USUARIOS_GERENCIAR'] }))).toBe(true);
  });

  it('permite quando o usuário tem múltiplas permissões requeridas', () => {
    reflector.getAllAndOverride.mockReturnValue(['USUARIOS_GERENCIAR', 'PERFIS_GERENCIAR']);
    expect(
      guard.canActivate(
        mockCtx({ permissoes: ['USUARIOS_GERENCIAR', 'PERFIS_GERENCIAR', 'AUDITORIA_VISUALIZAR'] }),
      ),
    ).toBe(true);
  });

  it('nega se tem apenas parte das permissões requeridas', () => {
    reflector.getAllAndOverride.mockReturnValue(['USUARIOS_GERENCIAR', 'PERFIS_GERENCIAR']);
    expect(() =>
      guard.canActivate(mockCtx({ permissoes: ['USUARIOS_GERENCIAR'] })),
    ).toThrow(ForbiddenException);
  });
});
