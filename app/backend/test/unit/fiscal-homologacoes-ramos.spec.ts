import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('fiscal-homologacoes ramos', () => {
  const fonte = readFileSync(join('src/modules/erp/fiscal/homologacoes/homologacoes.service.ts'), 'utf8').replace(/\r\n/g, '\n');

  it('não importa nota fiscal', () => {
    expect(fonte).not.toMatch(/notas_fiscais/);
  });

  it('emite só depois da transação', () => {
    const callbacks = [...fonte.matchAll(/this\.db\.transaction\(async \(tx\) => \{([\s\S]*?)\n    \}\);/g)];
    expect(callbacks.length).toBeGreaterThan(0);
    for (const callback of callbacks) {
      expect(callback[1]).not.toContain('this.eventos.emit');
    }
    expect(fonte).toMatch(/await this\.db\.transaction\([\s\S]*?\n    \}\);\n    this\.eventos\.emit\(/);
  });
});

describe('fiscal-homologacoes ramos defensivos (corrida entre leitura e escrita)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { HomologacoesService } = require('../../src/modules/erp/fiscal/homologacoes/homologacoes.service');
  const servico = new HomologacoesService({ db: {} }, {}, {}, {}) as Record<string, (...args: unknown[]) => Promise<unknown>>;
  const dto = { versao: 1, justificativa: 'Decisão de usuário diferente de quem submeteu.' };
  const aprovada = { id: 'h', regraId: 'r', versao: 1, situacao: 'APROVADA', codigo: '1' };
  const regraOk = { situacao: 'APROVADA', deletedAt: null, submetidoPorId: 'u1' };

  function stubTx(respostas: unknown[][], erroInsert?: unknown) {
    const cadeia: Record<string, unknown> = {};
    for (const metodo of ['from', 'where', 'for', 'set', 'values']) cadeia[metodo] = () => cadeia;
    cadeia.returning = () => (erroInsert ? Promise.reject(erroInsert) : cadeia);
    cadeia.then = (ok: (valor: unknown[]) => unknown) => ok(respostas.shift() ?? []);
    return {
      select: () => cadeia,
      update: () => cadeia,
      insert: () => cadeia,
      execute: async () => ({ rows: [{ proximo: '1' }] }),
    };
  }

  it('decisão sem regra ou sem linha atualizada vira 404', async () => {
    await expect(servico.aplicarDecisao(stubTx([[{ ...aprovada, situacao: 'EM_REVISAO' }], []]), 'h', dto, 'u2', 'aprovar')).rejects.toThrow('Regra tributária não encontrada');
    await expect(servico.aplicarDecisao(stubTx([[{ ...aprovada, situacao: 'EM_REVISAO' }], [regraOk], []]), 'h', dto, 'u2', 'aprovar')).rejects.toThrow('Homologação não encontrada');
  });

  it('vínculo sem cenário gravado ou sem linha atualizada falha', async () => {
    const simulacao = { id: 's', situacao: 'CALCULADA', regraId: 'r' };
    await expect(servico.aplicarVinculo(stubTx([[aprovada], [regraOk], [simulacao], []]), 'h', { ...dto, simulacaoId: 's' }, 'u2')).rejects.toThrow('Falha ao gravar cenário');
    await expect(servico.aplicarVinculo(stubTx([[aprovada], [regraOk], [simulacao], [{ id: 'c' }], []]), 'h', { ...dto, simulacaoId: 's' }, 'u2')).rejects.toThrow('Homologação não encontrada');
  });

  it('publicação sem regra ou sem linha atualizada vira 404', async () => {
    await expect(servico.aplicarPublicacao(stubTx([[aprovada], []]), 'h', dto, 'u2')).rejects.toThrow('Regra tributária não encontrada');
    await expect(servico.aplicarPublicacao(stubTx([[aprovada], [regraOk], [{ id: 'c' }], []]), 'h', dto, 'u2')).rejects.toThrow('Homologação não encontrada');
  });

  it('regra aposentada ou apagada recusa decisão, vínculo e publicação com 422', async () => {
    const aposentada = { ...regraOk, situacao: 'APOSENTADA' };
    const apagada = { ...regraOk, deletedAt: new Date() };
    for (const regra of [aposentada, apagada]) {
      await expect(servico.aplicarDecisao(stubTx([[{ ...aprovada, situacao: 'EM_REVISAO' }], [regra]]), 'h', dto, 'u2', 'aprovar')).rejects.toMatchObject({ status: 422 });
      await expect(servico.aplicarDecisao(stubTx([[{ ...aprovada, situacao: 'EM_REVISAO' }], [regra], []]), 'h', dto, 'u2', 'rejeitar')).rejects.toThrow('Homologação não encontrada');
      await expect(servico.aplicarVinculo(stubTx([[aprovada], [regra]]), 'h', { ...dto, simulacaoId: 's' }, 'u2')).rejects.toMatchObject({ status: 422 });
      await expect(servico.aplicarPublicacao(stubTx([[aprovada], [regra]]), 'h', dto, 'u2')).rejects.toMatchObject({ status: 422 });
    }
  });

  it('violação única do cenário vira 409 e outro erro do insert é repassado', async () => {
    const simulacao = { id: 's', situacao: 'CALCULADA', regraId: 'r' };
    const duplicado = { code: '23505', constraint: 'uq_cenarios_homologacao_simulacao' };
    await expect(servico.aplicarVinculo(stubTx([[aprovada], [regraOk], [simulacao]], duplicado), 'h', { ...dto, simulacaoId: 's' }, 'u2')).rejects.toMatchObject({ status: 409 });
    await expect(servico.aplicarVinculo(stubTx([[aprovada], [regraOk], [simulacao]], new Error('falha')), 'h', { ...dto, simulacaoId: 's' }, 'u2')).rejects.toThrow('falha');
  });

  it('inserção sem linha devolvida repassa o erro; código duplicado duas vezes é conflito', async () => {
    await expect(servico.inserirComCodigo(stubTx([[]]), {})).rejects.toThrow('Falha ao gravar homologação');
    const duplicado = { code: '23505', constraint: 'uq_homologacoes_codigo' };
    await expect(servico.inserirComCodigo(stubTx([], duplicado), {})).rejects.toMatchObject({ status: 409 });
    const aberta = { code: '23505', constraint: 'uq_homologacoes_regra_aberta' };
    await expect(servico.inserirComCodigo(stubTx([], aberta), {})).rejects.toMatchObject({ status: 409 });
  });
});

describe('fiscal-homologacoes ramos de apresentação sem autor e sem total', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { HomologacoesService } = require('../../src/modules/erp/fiscal/homologacoes/homologacoes.service');
  const consulta = { search: undefined, situacao: undefined, sort: 'enquadramento', dir: 'asc', page: 1, pageSize: 20 };
  const linha = { id: 'h', enquadramento: '1', vigenciaInicio: '2026-01-01', situacao: 'EM_REVISAO', usuario: null, aprovador: null, descricao: 'd' };

  function servicoCom(respostas: unknown[][]) {
    const cadeia: Record<string, unknown> = {};
    for (const metodo of ['from', 'where', 'innerJoin', 'leftJoin', 'orderBy', 'limit', 'offset']) cadeia[metodo] = () => cadeia;
    cadeia.then = (ok: (valor: unknown[]) => unknown) => ok(respostas.shift() ?? []);
    return new HomologacoesService({ db: { select: () => cadeia } }, {}, {}, {});
  }

  it('lista sem total e sem autor devolve zero e texto vazio', async () => {
    const lista = await servicoCom([[], [linha]]).listar(consulta);
    expect(lista.total).toBe(0);
    expect(lista.data[0]).toMatchObject({ usuario: '', aprovador: '' });
  });

  it('contagens sem linha devolvem zeros', async () => {
    expect(await servicoCom([[]]).contagens(consulta)).toEqual({ total: 0, emRevisao: 0, aprovadas: 0, rejeitadas: 0, publicadas: 0 });
  });

  it('exportação sem autor deixa as colunas vazias', async () => {
    const csv: string = await servicoCom([[linha]]).exportar(consulta);
    expect(csv).toContain('1;2026-01-01;Em revisão;;;d');
  });

  it('diff sem origem aceita percentual sem fração e vigência sem fim', async () => {
    const regra = {
      codigo: '1', numeroVersao: 1, icmsCst: '20', pRedBc: '41', pIcms: '12', ipiCst: '53', pisCst: '06', ibsCst: '000',
      vigenciaInicio: '2026-01-01', vigenciaFim: null, beneficio: 'b', classificacao: 'c',
    };
    const diff = await servicoCom([[regra]]).diffSemOrigem('r');
    expect(JSON.stringify(diff)).toContain('Sem fim de vigência');
  });
});
