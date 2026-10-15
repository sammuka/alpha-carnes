import { criarContaSchema } from './dto/plano.dto';
import { RegraContabilException } from './regra-contabil.exception';

describe('plano de contas — forma', () => {
  it('recusa vigência invertida no schema', () => {
    const parsed = criarContaSchema.safeParse({
      codigo: '1',
      nome: 'Caixa',
      classificacao: 'sintetica',
      natureza: 'ATIVO',
      grupo: 'Circulante',
      contaPaiCodigo: null,
      centroCodigo: 'CT1',
      vigenciaInicio: '2026-10-01',
      vigenciaFim: '2026-09-01',
      justificativa: 'abertura',
    });
    expect(parsed.success).toBe(false);
  });

  it('responde 422 na regra contábil', () => {
    const erro = new RegraContabilException('Conta pai não encontrada');
    expect(erro).toMatchObject({
      status: 422,
      response: { message: 'Conta pai não encontrada' },
    });
  });
});
