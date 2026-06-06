import { SetMetadata } from '@nestjs/common';

export const AUDITAR_KEY = 'auditar';

export interface AuditarMetadata {
  acao: string;
  modulo: string;
}

export const Auditar = (acao: string, modulo: string) =>
  SetMetadata(AUDITAR_KEY, { acao, modulo } satisfies AuditarMetadata);
