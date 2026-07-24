import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { resolverCaptura } from '../../src/modules/operacao/pesagem/captura';
import { PERMISSOES } from '../../src/common/rbac/permissoes';

describe('resolverCaptura', () => {
  const userBase = {
    sub: 'u1',
    email: 'a@b.c',
    permissoes: [PERMISSOES.PESO_MANUAL],
  };

  it('automático com leitura instável lança 409 e notifica', async () => {
    const onIndisponivel = jest.fn();
    const balanca = {
      status: jest.fn().mockReturnValue({ status: 'disponivel' }),
      lerEstavel: jest.fn().mockResolvedValue({
        estavel: false,
        peso: 0,
        saude: { status: 'instavel' },
      }),
    };

    await expect(resolverCaptura(
      balanca as never,
      { modoCaptura: 'automatico' },
      userBase as never,
      onIndisponivel,
    )).rejects.toBeInstanceOf(ConflictException);
    expect(onIndisponivel).toHaveBeenCalledWith({ status: 'instavel' });
  });

  it('manual sem PESO_MANUAL lança 403', async () => {
    await expect(resolverCaptura(
      { status: jest.fn() } as never,
      { modoCaptura: 'manual_assistido', pesoManual: 10, motivo: 'x' },
      { ...userBase, permissoes: [] } as never,
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('manual sem peso/motivo lança 400', async () => {
    await expect(resolverCaptura(
      { status: jest.fn().mockReturnValue({ status: 'disponivel' }) } as never,
      { modoCaptura: 'manual_assistido' },
      userBase as never,
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('manual com sucesso define motivo_detalhe null quando omitido', async () => {
    const result = await resolverCaptura(
      { status: jest.fn().mockReturnValue({ status: 'disponivel' }) } as never,
      { modoCaptura: 'manual_assistido', pesoManual: 12.5, motivo: 'dispositivo_indisponivel' },
      userBase as never,
    );
    expect(result.peso).toBe('12.500');
    expect(result.capturaMeta.motivo_detalhe).toBeNull();
  });
});
