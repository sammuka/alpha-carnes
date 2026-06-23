import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSOES_KEY } from '../rbac/require-permissoes.decorator';
import { PERMISSOES_QUALQUER_KEY } from '../rbac/require-qualquer-permissao.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAll = this.reflector.getAllAndOverride<string[]>(PERMISSOES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredAny = this.reflector.getAllAndOverride<string[]>(PERMISSOES_QUALQUER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if ((!requiredAll || requiredAll.length === 0) && (!requiredAny || requiredAny.length === 0)) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { permissoes?: string[] } }>();
    const user = request.user;

    if (!user) throw new ForbiddenException('Usuário não autenticado');

    const userPermissoes = user.permissoes ?? [];

    if (requiredAll?.length) {
      const hasAll = requiredAll.every((p) => userPermissoes.includes(p));
      if (!hasAll) throw new ForbiddenException('Permissão insuficiente');
    }

    if (requiredAny?.length) {
      const hasAny = requiredAny.some((p) => userPermissoes.includes(p));
      if (!hasAny) throw new ForbiddenException('Permissão insuficiente');
    }

    return true;
  }
}
