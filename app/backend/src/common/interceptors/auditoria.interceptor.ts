import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import { auditoria } from '../../database/schema/auditoria.schema';
import { AUDITAR_KEY, type AuditarMetadata } from '../decorators/auditar.decorator';
import type { CurrentUserPayload } from '../decorators/current-user.decorator';
import * as schema from '../../database/schema';

@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    @InjectPinoLogger(AuditoriaInterceptor.name)
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditarMetadata>(AUDITAR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem @Auditar → não audita
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: CurrentUserPayload }>();
    const usuarioId = req.user?.sub ?? null;
    const ip = req.ip ?? null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;

    return next.handle().pipe(
      tap(async (responseBody) => {
        // Somente após SUCESSO do handler (tap só é chamado quando o Observable emite sem erro)
        try {
          await this.drizzle.db.insert(auditoria).values({
            tabela: meta.modulo,
            registroId: usuarioId ?? '00000000-0000-0000-0000-000000000000',
            operacao: 'ACAO_MANUAL',
            modulo: meta.modulo,
            usuarioId: usuarioId ?? undefined,
            dadosNovos: responseBody ? { result: responseBody } : {},
            ip,
            userAgent,
          });
        } catch (err) {
          // Falha de auditoria é observável e nunca silenciosa (RA-05/RA-06)
          // Não re-lança — a operação de negócio já teve sucesso; o erro é observável via log
          this.logger.error(
            { err, acao: meta.acao, modulo: meta.modulo },
            'Falha ao registrar auditoria',
          );
        }
      }),
    );
  }
}
