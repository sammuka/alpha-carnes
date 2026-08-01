import { abrirDivergenciaTransformacaoSchema } from '../../src/modules/operacao/corte/dto/divergencia-transformacao.dto';

describe('abrirDivergenciaTransformacaoSchema', () => {
  it('rejeita tipo inválido', () => {
    const r = abrirDivergenciaTransformacaoSchema.safeParse({
      tipo: 'tipo_inventado',
      detalhe: {},
    });
    expect(r.success).toBe(false);
  });

  it('aceita subpeca_faltante com detalhe', () => {
    const r = abrirDivergenciaTransformacaoSchema.safeParse({
      tipo: 'subpeca_faltante',
      detalhe: { slot: 'JAC' },
      observacao: 'Jacaré não saiu da peça',
    });
    expect(r.success).toBe(true);
  });
});
