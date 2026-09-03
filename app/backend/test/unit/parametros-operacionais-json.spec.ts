import { parametrosOperacionaisJsonSchema } from '../../src/common/dto/json-cadastros.dto';

describe('parametrosOperacionaisJsonSchema — edição com campos vazios do form', () => {
  it('aceita strings vazias como campo omitido (payload típico do master-detail)', () => {
    const r = parametrosOperacionaisJsonSchema.safeParse({
      romaneioAntecipado: false,
      horarioLimiteRecebimento: '',
      capacidadeMaximaKg: '',
      toleranciaDivergenciaPercentual: '',
      notaQualidade: '',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ romaneioAntecipado: false });
    }
  });

  it('converte capacidade e tolerância enviadas como string', () => {
    const r = parametrosOperacionaisJsonSchema.safeParse({
      horarioLimiteRecebimento: '14:30',
      capacidadeMaximaKg: '18000',
      toleranciaDivergenciaPercentual: '2.5',
      notaQualidade: 'A',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        horarioLimiteRecebimento: '14:30',
        capacidadeMaximaKg: 18000,
        toleranciaDivergenciaPercentual: 2.5,
        notaQualidade: 'A',
      });
    }
  });

  it('rejeita horário e nota inválidos', () => {
    const horario = parametrosOperacionaisJsonSchema.safeParse({ horarioLimiteRecebimento: '25:00' });
    expect(horario.success).toBe(false);
    const nota = parametrosOperacionaisJsonSchema.safeParse({ notaQualidade: 'Z' });
    expect(nota.success).toBe(false);
  });
});
