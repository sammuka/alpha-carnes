import { criarContaSchema, dataCalendarioValida } from './dto/plano.dto';
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

describe('dataCalendarioValida', () => {
  it.each(['2026-02-31', '2026-13-01', '2026-00-10', '2026-04-31', '2025-02-29', '0000-01-01', '2026-1-01', ''])(
    'recusa %s',
    (valor) => expect(dataCalendarioValida(valor)).toBe(false),
  );
  it.each(['2026-02-28', '2028-02-29', '2026-12-31'])('aceita %s', (valor) => expect(dataCalendarioValida(valor)).toBe(true));
  it('o schema de criação recusa data inexistente', () => {
    const base = {
      codigo: '1', nome: 'Caixa', classificacao: 'sintetica', natureza: 'ATIVO', grupo: 'Circulante',
      contaPaiCodigo: null, centroCodigo: 'CT1', vigenciaFim: null, justificativa: 'abertura',
    };
    expect(criarContaSchema.safeParse({ ...base, vigenciaInicio: '2026-02-31' }).success).toBe(false);
    expect(criarContaSchema.safeParse({ ...base, vigenciaInicio: '2026-10-01' }).success).toBe(true);
  });
});
