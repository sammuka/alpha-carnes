import { SetMetadata } from '@nestjs/common';

export const PERMISSOES_KEY = 'permissoes';
export const RequirePermissoes = (...permissoes: string[]) =>
  SetMetadata(PERMISSOES_KEY, permissoes);
