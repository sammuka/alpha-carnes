import { beneficioFiscalSchema } from '../../src/modules/erp/fiscal/regras/dto/beneficio-fiscal.dto';
import { classificacaoIbsCbsSchema } from '../../src/modules/erp/fiscal/regras/dto/classificacao-ibs-cbs.dto';
import { atualizarRegraSchema, criarRegraSchema, listarRegrasSchema } from '../../src/modules/erp/fiscal/regras/dto/regra.dto';
import { listarCatalogoQuerySchema } from '../../src/modules/erp/fiscal/regras/dto/comum.dto';

const UUID = '0199e1a0-0000-7000-8000-000000000001';
const base = {
  enquadramentoId: UUID, operacaoId: UUID, cfopId: UUID, icmsCst: '20', pRedBc: '41,67', pIcms: '12,00',
  beneficioFiscalId: UUID, ipiCst: '53', pisCst: '06', ibsCst: '000', classificacaoIbsCbsId: UUID,
  vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31', justificativa: 'Regra inicial da vigência.',
};

describe('DTOs recusam datas fora de faixa e NUL', () => {
  it.each(['0000-01-01', '1899-12-31'])('vigenciaInicio %s recusada', (data) => {
    expect(criarRegraSchema.safeParse({ ...base, vigenciaInicio: data, vigenciaFim: null }).success).toBe(false);
    expect(atualizarRegraSchema.safeParse({ ...base, versao: 1, vigenciaInicio: data, vigenciaFim: null }).success).toBe(false);
  });
  it('vigenciaFim 0000-01-01 recusada', () => {
    expect(criarRegraSchema.safeParse({ ...base, vigenciaFim: '0000-01-01' }).success).toBe(false);
  });
  it('aceita 1900-01-01', () => {
    expect(criarRegraSchema.safeParse({ ...base, vigenciaInicio: '1900-01-01' }).success).toBe(true);
  });
  it('justificativa com NUL recusada em todas as mutações', () => {
    const ruim = 'abc\u0000def';
    expect(criarRegraSchema.safeParse({ ...base, justificativa: ruim }).success).toBe(false);
    expect(beneficioFiscalSchema.safeParse({ codigo: 'SP020450', descricao: 'x', justificativa: ruim }).success).toBe(false);
    expect(classificacaoIbsCbsSchema.safeParse({ codigo: '000001', descricao: 'x', justificativa: ruim }).success).toBe(false);
  });
  it('descrição e busca com NUL recusadas', () => {
    expect(beneficioFiscalSchema.safeParse({ codigo: 'SP020450', descricao: 'a\u0000b', justificativa: 'abc' }).success).toBe(false);
    expect(classificacaoIbsCbsSchema.safeParse({ codigo: '000001', descricao: 'a\u0000b', justificativa: 'abc' }).success).toBe(false);
    expect(listarCatalogoQuerySchema.safeParse({ search: 'a\u0000b' }).success).toBe(false);
    expect(listarRegrasSchema.safeParse({ search: 'a\u0000b' }).success).toBe(false);
  });
});
