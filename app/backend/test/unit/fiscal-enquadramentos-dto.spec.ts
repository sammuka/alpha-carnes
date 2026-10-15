import { consultaEnquadramentoSchema } from '../../src/modules/erp/fiscal/enquadramentos/dto/consulta.dto';
import {
  createEnquadramentoSchema,
  listarEnquadramentosQuerySchema,
  updateEnquadramentoSchema,
} from '../../src/modules/erp/fiscal/enquadramentos/dto/enquadramento.dto';
import { createCfopSchema, listarCodigoFiscalQuerySchema } from '../../src/modules/erp/fiscal/enquadramentos/dto/cfop.dto';
import { createNcmSchema } from '../../src/modules/erp/fiscal/enquadramentos/dto/ncm.dto';

const UUID = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';

function base(extra: Record<string, unknown> = {}) {
  return {
    estabelecimentoId: UUID,
    operacaoId: UUID,
    tpNf: '1',
    finNfe: '1',
    cfopId: UUID,
    abrangencia: 'INTERNA',
    tipoProduto: 'REVENDA',
    produtoId: UUID,
    ncmId: UUID,
    cest: '1708700',
    clienteId: UUID,
    vigenciaInicio: '2026-01-01',
    prioridade: 1,
    justificativa: 'Cadastro de enquadramento',
    ...extra,
  };
}

describe('DTOs de enquadramento, CFOP e NCM', () => {
  it('tpNF 2', () => {
    expect(createEnquadramentoSchema.safeParse(base({ tpNf: '2' })).success).toBe(false);
  });

  it('finNFe 5', () => {
    expect(createEnquadramentoSchema.safeParse(base({ finNfe: '5' })).success).toBe(false);
  });

  it('abrangência livre', () => {
    expect(createEnquadramentoSchema.safeParse(base({ abrangencia: 'LIVRE' })).success).toBe(false);
  });

  it('tipo SUB aceito', () => {
    const r = createEnquadramentoSchema.safeParse(base({ tipoProduto: 'SUB' }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipoProduto).toBe('SUB');
  });

  it('CEST com 6 dígitos', () => {
    expect(createEnquadramentoSchema.safeParse(base({ cest: '170870' })).success).toBe(false);
  });

  it('fim < início', () => {
    expect(createEnquadramentoSchema.safeParse(base({
      vigenciaInicio: '2026-06-01',
      vigenciaFim: '2026-01-01',
    })).success).toBe(false);
  });

  it('prioridade 0', () => {
    expect(createEnquadramentoSchema.safeParse(base({ prioridade: 0 })).success).toBe(false);
  });

  it('strict rejeita codigo e empresaId', () => {
    expect(updateEnquadramentoSchema.safeParse({
      ...base(),
      versao: 1,
      codigo: '12',
      empresaId: UUID,
    }).success).toBe(false);
    expect(createEnquadramentoSchema.safeParse(base({ codigo: '12', empresaId: UUID })).success).toBe(false);
  });

  it('`0201.30.00` → `02013000`', () => {
    const r = createNcmSchema.safeParse({
      codigo: '0201.30.00',
      descricao: 'Carnes',
      justificativa: 'Cadastro manual',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.codigo).toBe('02013000');
  });

  it('7 dígitos inválido', () => {
    expect(createNcmSchema.safeParse({
      codigo: '0201300',
      descricao: 'Carnes',
      justificativa: 'Cadastro manual',
    }).success).toBe(false);
  });

  it('consulta só com cfopId falha', () => {
    expect(consultaEnquadramentoSchema.safeParse({ cfopId: UUID }).success).toBe(false);
  });

  it('CFOP 5101 válido e ABC inválido', () => {
    expect(createCfopSchema.safeParse({
      codigo: '5101',
      descricao: 'Venda',
      justificativa: 'Cadastro manual',
    }).success).toBe(true);
    expect(createCfopSchema.safeParse({
      codigo: 'ABC',
      descricao: 'Venda',
      justificativa: 'Cadastro manual',
    }).success).toBe(false);
  });
});

describe('B1 — datas e NUL', () => {
  it.each(['0000-01-01', '1899-12-31'])('vigenciaInicio %s é recusada', (data) => {
    expect(createEnquadramentoSchema.safeParse(base({ vigenciaInicio: data })).success).toBe(false);
    expect(createEnquadramentoSchema.safeParse(base({ vigenciaFim: data })).success).toBe(false);
    const { vigenciaInicio: _i, prioridade: _p, justificativa: _j, ...chave } = base();
    expect(consultaEnquadramentoSchema.safeParse({ ...chave, data: '2026-01-01' }).success).toBe(true);
    expect(consultaEnquadramentoSchema.safeParse({ ...chave, data }).success).toBe(false);
  });

  it('1900-01-01 é aceita', () => {
    expect(createEnquadramentoSchema.safeParse(base({ vigenciaInicio: '1900-01-01' })).success).toBe(true);
  });

  it('NUL na justificativa, descrição e busca é recusado', () => {
    expect(createEnquadramentoSchema.safeParse(base({ justificativa: 'abc\u0000def' })).success).toBe(false);
    expect(createCfopSchema.safeParse({ codigo: '5101', descricao: 'a\u0000b', justificativa: 'abcd' }).success).toBe(false);
    expect(createNcmSchema.safeParse({ codigo: '02013000', descricao: 'ok', justificativa: 'a\u0000bcd' }).success).toBe(false);
    expect(listarEnquadramentosQuerySchema.safeParse({ search: 'a\u0000b' }).success).toBe(false);
    expect(listarCodigoFiscalQuerySchema.safeParse({ search: 'a\u0000b' }).success).toBe(false);
  });
});
