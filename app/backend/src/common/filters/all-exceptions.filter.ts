import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** SQLSTATE de deadlock e falha de serialização: a disputa perdeu, não é erro interno. */
const PG_CONCORRENCIA = new Set(['40P01', '40001']);

function codigoPg(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.code ?? e?.cause?.code;
  return typeof code === 'string' ? code : undefined;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(original: unknown, host: ArgumentsHost) {
    const exception = PG_CONCORRENCIA.has(codigoPg(original) ?? '')
      ? new ConflictException({
          message: 'O registro foi alterado por outro usuário. Recarregue para continuar.',
          codigo: 'CONFLITO_CONCORRENTE',
        })
      : original;
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Erro interno do servidor';

    const requestId =
      (request.headers['x-request-id'] as string) ?? 'unknown';

    this.logger.error(
      {
        requestId,
        path: request.url,
        method: request.method,
        status,
        error:
          original instanceof Error
            ? original.message
            : String(original),
      },
      'Exceção capturada',
    );

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    });
  }
}
