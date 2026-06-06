import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({ email: z.string().email(), senha: z.string().min(6) });
  const pipe = new ZodValidationPipe(schema);

  it('passa dados válidos sem transformação', () => {
    const input = { email: 'a@b.com', senha: '123456' };
    expect(pipe.transform(input)).toEqual(input);
  });

  it('lança BadRequestException com issues em payload inválido', () => {
    expect(() => pipe.transform({ email: 'nao-email', senha: '123' })).toThrow(BadRequestException);
  });

  it('inclui issues no body do erro', () => {
    try {
      pipe.transform({ email: 'x' });
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const resp = (e as BadRequestException).getResponse() as { errors: unknown[] };
      expect(resp.errors.length).toBeGreaterThan(0);
    }
  });
});
