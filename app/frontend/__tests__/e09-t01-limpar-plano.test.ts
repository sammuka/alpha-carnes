import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comandoLimpezaPlano } from '../e2e/limpar-plano';

describe('limpeza do e2e do plano de contas', () => {
  const env = (url?: string) => ({ DATABASE_URL: url }) as unknown as NodeJS.ProcessEnv;
  const lerE2e = (arquivo: string) => readFileSync(join(__dirname, '..', 'e2e', arquivo), 'utf8');

  it('deriva usuário e banco do DATABASE_URL', () => {
    const { args } = comandoLimpezaPlano(env('postgres://alphacarnes:senha@localhost:15433/alphacarnes_e09_t01'));
    expect(args).toEqual(expect.arrayContaining(['-U', 'alphacarnes', '-d', 'alphacarnes_e09_t01']));
    const outro = comandoLimpezaPlano(env('postgres://u:p@localhost:15433/alphacarnes_e09_t02'));
    expect(outro.args).toEqual(expect.arrayContaining(['-d', 'alphacarnes_e09_t02']));
  });

  it('trunca as três tabelas em cascata, cobrindo tabelas da T02 se existirem', () => {
    const { args } = comandoLimpezaPlano(env('postgres://u:p@h:1/alphacarnes_e2e'));
    expect(args.at(-1)).toBe('TRUNCATE conta_versoes, contas_contabeis, centros_custo CASCADE;');
  });

  it.each([undefined, '', 'postgres://u:p@h:1/alphacarnes', 'postgres://u:p@h:1/producao'])('recusa %s', (url) => {
    expect(() => comandoLimpezaPlano(env(url))).toThrow();
  });

  it('nem o helper nem o spec carregam o nome de banco fixo nem delete irrestrito', () => {
    expect(lerE2e('limpar-plano.ts')).not.toContain('alphacarnes_e09_t01');
    expect(lerE2e('e09-t01-plano-contas.spec.ts')).not.toContain('alphacarnes_e09_t01');
    expect(lerE2e('e09-t01-plano-contas.spec.ts')).not.toContain('delete from');
  });
});
