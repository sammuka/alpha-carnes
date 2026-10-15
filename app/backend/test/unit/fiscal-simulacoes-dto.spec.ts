import { criarSimulacaoSchema, listarSimulacoesSchema, novaVersaoSchema } from '../../src/modules/erp/fiscal/simulacoes/dto/simulacao.dto';

const corpoValido = {
  estabelecimentoId: '0199e1a0-0000-7000-8000-000000000001',
  operacaoId: '0199e1a0-0000-7000-8000-000000000002',
  clienteId: '0199e1a0-0000-7000-8000-000000000003',
  produtoId: '0199e1a0-0000-7000-8000-000000000004',
  ncmId: '0199e1a0-0000-7000-8000-000000000005',
  quantidade: '10,000',
  pesoNf: '982,000',
  valor: '1.000,00',
  desconto: '0,00',
  competencia: '2026-10',
  enquadramentoId: '0199e1a0-0000-7000-8000-000000000006',
  justificativa: 'Motivo da alteração desta simulação.',
};

describe('fiscal-simulacoes-dto', () => {
  it('dinheiro e quantidade canônicos', () => {
    const parsed = criarSimulacaoSchema.safeParse(corpoValido);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.valor).toBe('1000.00');
    expect(parsed.data.desconto).toBe('0.00');
    expect(parsed.data.quantidade).toBe('10.000');
    expect(parsed.data.pesoNf).toBe('982.000');
    expect(parsed.data.competencia).toBe('2026-10');
  });

  it('valor numérico é 400', () => {
    const parsed = criarSimulacaoSchema.safeParse({ ...corpoValido, valor: 10.05 });
    expect(parsed.success).toBe(false);
  });

  it('strict rejeita baseCalculo, regraId, dataComercial e notaId', () => {
    const parsed = criarSimulacaoSchema.safeParse({
      ...corpoValido,
      baseCalculo: '10.00',
      regraId: crypto.randomUUID(),
      dataComercial: '2026-10-01',
      notaId: crypto.randomUUID(),
    });
    expect(parsed.success).toBe(false);
  });

  it('terceira casa no valor', () => {
    const parsed = criarSimulacaoSchema.safeParse({ ...corpoValido, valor: '10,005' });
    expect(parsed.success).toBe(false);
  });

  it('valor 1e2', () => {
    const parsed = criarSimulacaoSchema.safeParse({ ...corpoValido, valor: '1e2' });
    expect(parsed.success).toBe(false);
  });

  it('valor zero', () => {
    const parsed = criarSimulacaoSchema.safeParse({ ...corpoValido, valor: '0,00' });
    expect(parsed.success).toBe(false);
  });

  it('quarta casa no peso', () => {
    const parsed = criarSimulacaoSchema.safeParse({ ...corpoValido, pesoNf: '1,0001' });
    expect(parsed.success).toBe(false);
  });

  it('competência 2026-10-01', () => {
    const parsed = criarSimulacaoSchema.safeParse({ ...corpoValido, competencia: '2026-10-01' });
    expect(parsed.success).toBe(false);
  });

  it('competência 2026-13', () => {
    const parsed = criarSimulacaoSchema.safeParse({ ...corpoValido, competencia: '2026-13' });
    expect(parsed.success).toBe(false);
  });

  it('desconto maior que o valor ainda passa no Zod', () => {
    const parsed = criarSimulacaoSchema.safeParse({ ...corpoValido, valor: '1.000,00', desconto: '1.000,01' });
    expect(parsed.success).toBe(true);
  });

  it('versão nova exige versao inteira', () => {
    const semVersao = novaVersaoSchema.safeParse(corpoValido);
    expect(semVersao.success).toBe(false);
    const parsed = novaVersaoSchema.safeParse({ ...corpoValido, versao: 1 });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.versao).toBe(1);
    expect(parsed.data.valor).toBe('1000.00');
  });

  it('listar usa pageSize 20 e sort cliente', () => {
    const parsed = listarSimulacoesSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.page).toBe(1);
    expect(parsed.data.pageSize).toBe(20);
    expect(parsed.data.sort).toBe('cliente');
    expect(parsed.data.dir).toBe('asc');
  });
});
