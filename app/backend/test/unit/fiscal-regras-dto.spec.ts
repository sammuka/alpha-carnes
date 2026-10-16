import { criarRegraSchema } from '../../src/modules/erp/fiscal/regras/dto/regra.dto';

const corpoValido = {
  enquadramentoId: '0199e1a0-0000-7000-8000-000000000001',
  operacaoId: '0199e1a0-0000-7000-8000-000000000002',
  cfopId: '0199e1a0-0000-7000-8000-000000000003',
  icmsCst: '20',
  pRedBc: '41,67',
  pIcms: '12,00',
  beneficioFiscalId: '0199e1a0-0000-7000-8000-000000000004',
  ipiCst: '53',
  pisCst: '06',
  ibsCst: '000',
  classificacaoIbsCbsId: '0199e1a0-0000-7000-8000-000000000005',
  vigenciaInicio: '2026-01-01',
  justificativa: 'Regra inicial da vigência de 2026.',
};

describe('fiscal-regras-dto', () => {
  it('41,67 e 12,00 viram razão canônica', () => {
    const parsed = criarRegraSchema.safeParse(corpoValido);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.pRedBc).toBe('0.4167');
    expect(parsed.data.pIcms).toBe('0.1200');
  });

  it('pIcms numérico é 400', () => {
    const parsed = criarRegraSchema.safeParse({ ...corpoValido, pIcms: 12.5 });
    expect(parsed.success).toBe(false);
  });

  it('strict rejeita csosn, is, versaoNt e notaId', () => {
    const parsed = criarRegraSchema.safeParse({
      ...corpoValido,
      csosn: '101',
      is: '00',
      versaoNt: '1.52',
      notaId: crypto.randomUUID(),
    });
    expect(parsed.success).toBe(false);
  });

  it('icmsCst 101', () => {
    const parsed = criarRegraSchema.safeParse({ ...corpoValido, icmsCst: '101' });
    expect(parsed.success).toBe(false);
  });

  it('ipiCst 00', () => {
    const parsed = criarRegraSchema.safeParse({ ...corpoValido, ipiCst: '00' });
    expect(parsed.success).toBe(false);
  });

  it('pisCst 07', () => {
    const parsed = criarRegraSchema.safeParse({ ...corpoValido, pisCst: '07' });
    expect(parsed.success).toBe(false);
  });

  it('ibsCst 100', () => {
    const parsed = criarRegraSchema.safeParse({ ...corpoValido, ibsCst: '100' });
    expect(parsed.success).toBe(false);
  });

  it('fim < início', () => {
    const parsed = criarRegraSchema.safeParse({
      ...corpoValido,
      vigenciaInicio: '2026-06-01',
      vigenciaFim: '2026-01-01',
    });
    expect(parsed.success).toBe(false);
  });
});
