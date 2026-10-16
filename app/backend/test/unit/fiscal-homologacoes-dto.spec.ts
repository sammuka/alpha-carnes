import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  criarHomologacaoSchema,
  listarHomologacoesSchema,
} from '../../src/modules/erp/fiscal/homologacoes/dto/homologacao.dto';

const REGRA = {
  regraId: crypto.randomUUID(),
  descricao: 'Revisão da alíquota desta versão.',
  justificativa: 'Revisão da versão aprovada.',
};

describe('fiscal-homologacoes-dto', () => {
  it('descrição numérica é 400', () => {
    const parsed = criarHomologacaoSchema.safeParse({
      regraId: crypto.randomUUID(),
      descricao: 10,
      justificativa: 'Revisão da versão aprovada.',
    });
    expect(parsed.success).toBe(false);
  });

  it('strict rejeita dataComercial, vigenciaInicio e aprovadorId', () => {
    const parsed = criarHomologacaoSchema.safeParse({
      regraId: crypto.randomUUID(),
      descricao: 'Revisão da alíquota desta versão.',
      justificativa: 'Revisão da versão aprovada.',
      dataComercial: '2026-10-01',
      vigenciaInicio: '2026-10-01',
      aprovadorId: crypto.randomUUID(),
    });
    expect(parsed.success).toBe(false);
  });

  it('o fonte não usa omit nem pick', () => {
    const fonte = readFileSync(join('src/modules/erp/fiscal/homologacoes/dto/homologacao.dto.ts'), 'utf8');
    expect(fonte).not.toMatch(/\.omit\(/);
    expect(fonte).not.toMatch(/\.pick\(/);
  });

  it('descrição curta e justificativa curta falham', () => {
    expect(criarHomologacaoSchema.safeParse({ ...REGRA, descricao: 'ab' }).success).toBe(false);
    expect(criarHomologacaoSchema.safeParse({ ...REGRA, descricao: '  ab  ' }).success).toBe(false);
    expect(criarHomologacaoSchema.safeParse({ ...REGRA, justificativa: 'ok' }).success).toBe(false);
  });

  it('situação RASCUNHO na lista é inválida', () => {
    expect(listarHomologacoesSchema.safeParse({ situacao: 'RASCUNHO' }).success).toBe(false);
  });
});
