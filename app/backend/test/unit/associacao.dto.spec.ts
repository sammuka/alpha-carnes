import { semCoberturaSchema } from '../../src/modules/operacao/pesagem/dto/associacao.dto';

describe('semCoberturaSchema', () => {
  it('exige classificação quando destino é divergencia', () => {
    const r = semCoberturaSchema.safeParse({ destino: 'divergencia' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('divergencia'))).toBe(true);
    }
  });

  it('aceita divergencia com tipologia canônica', () => {
    const r = semCoberturaSchema.safeParse({
      destino: 'divergencia',
      divergencia: {
        tipo: 'outro',
        descricao: 'defeito visual',
        acaoImediata: 'separar',
      },
    });
    expect(r.success).toBe(true);
  });
});
