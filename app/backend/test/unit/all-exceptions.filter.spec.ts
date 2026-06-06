import { BadRequestException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

function makeHost(headers: Record<string, unknown> = {}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { headers, url: '/x', method: 'GET' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };
  return { host, status, json };
}

describe('AllExceptionsFilter (unit)', () => {
  const filter = new AllExceptionsFilter();
  beforeEach(() => jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined));

  it('mapeia HttpException para seu status e usa x-request-id', () => {
    const { host, status, json } = makeHost({ 'x-request-id': 'req-123' });
    filter.catch(new BadRequestException('inválido'), host as never);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, requestId: 'req-123' }));
  });

  it('mapeia Error genérico para 500 e requestId "unknown"', () => {
    const { host, status, json } = makeHost();
    filter.catch(new Error('boom'), host as never);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Erro interno do servidor', requestId: 'unknown' }),
    );
  });

  it('lida com valor lançado que não é Error (string)', () => {
    const { host, status } = makeHost();
    filter.catch('falha-string', host as never);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
