import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSOES_KEY } from '../rbac/require-permissoes.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSOES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { permissoes?: string[] } }>();
    const user = request.user;

    if (!user) throw new ForbiddenException('Usuário não autenticado');

    const userPermissoes = user.permissoes ?? [];
    const hasAll = required.every((p) => userPermissoes.includes(p));

    if (!hasAll) throw new ForbiddenException('Permissão insuficiente');

    return true;
  }
}
