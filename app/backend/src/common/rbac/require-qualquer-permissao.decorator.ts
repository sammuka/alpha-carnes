import { SetMetadata } from '@nestjs/common';

/** Permissões em OR: basta possuir ao menos uma delas. */
export const PERMISSOES_QUALQUER_KEY = 'permissoes_qualquer';
export const RequireQualquerPermissao = (...permissoes: string[]) =>
  SetMetadata(PERMISSOES_QUALQUER_KEY, permissoes);
