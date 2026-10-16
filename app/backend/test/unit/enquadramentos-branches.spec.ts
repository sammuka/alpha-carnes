import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EnquadramentosService } from '../../src/modules/erp/fiscal/enquadramentos/enquadramentos.service';

const ID = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
const JUSTIFICATIVA = 'Cadastro de enquadramento fiscal';

function filaSelect(resultados: unknown[][]) {
  let indice = 0;
  return jest.fn(() => {
    const linhas = resultados[indice++] ?? [];
    const elo: Record<string, unknown> = {};
    const voltar = () => elo;
    for (const metodo of ['from', 'where', 'innerJoin', 'leftJoin', 'orderBy', 'limit', 'offset', 'for']) {
      elo[metodo] = voltar;
    }
    elo.then = (ok: (valor: unknown) => unknown, falha?: (erro: unknown) => unknown) =>
      Promise.resolve(linhas).then(ok, falha);
    return elo;
  });
}

function servico(db: object = {}) {
  return new EnquadramentosService(
    { db } as never,
    { registrar: jest.fn().mockResolvedValue(undefined) } as never,
    { emit: jest.fn() } as unknown as EventEmitter2,
  );
}

function query(extra: Record<string, unknown> = {}) {
  return {
    sort: 'operacao' as const,
    dir: 'asc' as const,
    page: 1,
    pageSize: 20,
    ...extra,
  };
}

function linhaLista(extra: Record<string, unknown> = {}) {
  return {
    id: ID,
    codigo: '8',
    versao: 1,
    operacao: 'Compra',
    cfop: '5102',
    vigenciaInicio: '2026-01-01',
    estabelecimento: 'Filial',
    tpNf: '1',
    finNfe: '1',
    situacao: 'ATIVA',
    ...extra,
  };
}

function detalhe(extra: Record<string, unknown> = {}) {
  return {
    id: ID,
    codigo: '8',
    versao: 1,
    empresaNome: 'Alpha',
    estabelecimentoId: ID,
    estabelecimentoNome: 'Filial',
    operacaoId: ID,
    operacaoRotulo: 'Compra',
    tpNf: '1',
    finNfe: '1',
    cfopId: ID,
    cfopCodigo: '5102',
    cfopDescricao: 'Venda',
    abrangencia: 'INTERNA',
    tipoProduto: 'REVENDA',
    produtoId: ID,
    produtoNome: 'Acém',
    ncmId: ID,
    ncmCodigo: '02013000',
    ncmDescricao: 'Carne',
    cest: '1708700',
    clienteId: ID,
    clienteNomeFantasia: 'Açougue',
    clienteRazao: 'Açougue Central LTDA',
    vigenciaInicio: '2026-01-01',
    vigenciaFim: '2026-12-31',
    prioridade: 1,
    situacao: 'ATIVA',
    responsavel: 'Ana',
    criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    atualizadoEm: new Date('2026-01-02T00:00:00.000Z'),
    origemCodigo: null,
    ...extra,
  };
}

function dtoBase(extra: Record<string, unknown> = {}) {
  return {
    operacaoId: ID,
    tpNf: '1' as const,
    finNfe: '1' as const,
    cfopId: ID,
    abrangencia: 'INTERNA' as const,
    tipoProduto: 'REVENDA' as const,
    produtoId: ID,
    ncmId: ID,
    cest: '1708700',
    clienteId: ID,
    vigenciaInicio: '2026-01-01',
    prioridade: 1,
    justificativa: JUSTIFICATIVA,
    ...extra,
  };
}

function anterior(situacao: string) {
  return {
    id: ID,
    situacao,
    versao: 1,
    estabelecimentoId: ID,
    empresaId: ID,
    codigo: '8',
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    ...dtoBase(),
  };
}

describe('EnquadramentosService — ramos', () => {
  it('lista rótulos conhecidos e desconhecidos, com e sem filtros', async () => {
    const amplo = servico({
      select: filaSelect([[], [linhaLista({ tpNf: '9', finNfe: '8' })]]),
    });
    const desc = await amplo.listar(query({
      dir: 'desc',
      search: ' %_acém ',
      estabelecimentoId: ID,
      cfopId: ID,
      produtoId: ID,
      clienteId: ID,
    }));
    expect(desc.total).toBe(0);
    expect(desc.data[0]).toEqual(expect.objectContaining({ tpNf: '9', finNfe: '8' }));

    const estreito = servico({
      select: filaSelect([[{ total: 2 }], [linhaLista()]]),
    });
    const asc = await estreito.listar(query());
    expect(asc.total).toBe(2);
    expect(asc.data[0]).toEqual(expect.objectContaining({ tpNf: 'Saída', finNfe: 'Operação normal' }));
  });

  it('contagens com linha e sem linha', async () => {
    const vazio = await servico({ select: filaSelect([[]]) }).contagens(query());
    expect(vazio).toEqual({ total: 0, ativas: 0, inativas: 0 });
    const cheio = await servico({
      select: filaSelect([[{ total: 3, ativas: 2, inativas: 1 }]]),
    }).contagens(query());
    expect(cheio).toEqual({ total: 3, ativas: 2, inativas: 1 });
  });

  it('exporta cliente pelo fantasia ou pela razão', async () => {
    const csv = await servico({
      select: filaSelect([[
        {
          codigo: '8', operacao: 'Compra', cfop: '5102', vigenciaInicio: '2026-01-01', vigenciaFim: null,
          estabelecimento: 'Filial', tpNf: '1', finNfe: '1', situacao: 'ATIVA', responsavel: 'Ana',
          produto: 'Acém', clienteNomeFantasia: '  ', clienteRazao: 'Razão Social', ncm: '02013000',
          cest: '1708700', prioridade: 1, abrangencia: 'INTERNA', tipoProduto: 'REVENDA',
        },
        {
          codigo: '9', operacao: 'Compra', cfop: '5102', vigenciaInicio: '2026-01-01', vigenciaFim: null,
          estabelecimento: 'Filial', tpNf: '1', finNfe: '1', situacao: 'ATIVA', responsavel: 'Ana',
          produto: 'Acém', clienteNomeFantasia: 'Loja', clienteRazao: 'Razão Social', ncm: '02013000',
          cest: '1708700', prioridade: 1, abrangencia: 'INTERNA', tipoProduto: 'REVENDA',
        },
      ]]),
    }).exportar(query());
    expect(csv).toContain('Razão Social');
    expect(csv).toContain('Loja');
  });

  it('detalha rótulo ausente, fantasia em branco e 404', async () => {
    const corpo = await servico({
      select: filaSelect([[detalhe({
        tpNf: '9',
        finNfe: '8',
        abrangencia: 'FORA',
        tipoProduto: 'OUTRO',
        clienteNomeFantasia: null,
        situacao: 'INATIVA',
        criadoEm: '2026-03-01T00:00:00.000Z',
        atualizadoEm: '2026-03-02T00:00:00.000Z',
      })]]),
    }).detalhar(ID);
    expect(corpo.tipoNota).toBe('9');
    expect(corpo.finalidade).toBe('8');
    expect(corpo.abrangenciaRotulo).toBe('FORA');
    expect(corpo.tipoProdutoRotulo).toBe('OUTRO');
    expect(corpo.clienteNome).toBe('Açougue Central LTDA');
    expect(corpo.situacaoRotulo).toBe('Inativa');
    expect(corpo.criadoEm).toContain('2026-03-01');

    await expect(servico({ select: filaSelect([[]]) }).detalhar(ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('histórico cobre resumo, data textual e versão ausente', async () => {
    const eventos = [
      { operacao: 'DELETE', dadosAnteriores: { situacao: 'ATIVA', versao: 2 }, dadosNovos: { versao: 3 }, usuarioNome: 'Ana', criadoEm: new Date('2026-01-01T00:00:00.000Z'), justificativa: JUSTIFICATIVA },
      { operacao: 'INSERT', dadosAnteriores: null, dadosNovos: { situacao: 'ATIVA', versao: 1, origemEnquadramentoId: ID }, usuarioNome: null, criadoEm: '2026-02-01T00:00:00.000Z', justificativa: JUSTIFICATIVA },
      { operacao: 'INSERT', dadosAnteriores: null, dadosNovos: { origemEnquadramentoId: ID }, usuarioNome: 'Ana', criadoEm: new Date('2026-02-02T00:00:00.000Z'), justificativa: JUSTIFICATIVA },
      { operacao: 'INSERT', dadosAnteriores: {}, dadosNovos: { situacao: 'ATIVA' }, usuarioNome: 'Ana', criadoEm: new Date('2026-02-03T00:00:00.000Z'), justificativa: JUSTIFICATIVA },
      { operacao: 'UPDATE', dadosAnteriores: { situacao: 'ATIVA', versao: 4 }, dadosNovos: { situacao: 'INATIVA' }, usuarioNome: 'Ana', criadoEm: new Date('2026-02-04T00:00:00.000Z'), justificativa: JUSTIFICATIVA },
      { operacao: 'UPDATE', dadosAnteriores: { situacao: 'INATIVA', versao: 5 }, dadosNovos: { situacao: 'ATIVA', versao: 6 }, usuarioNome: 'Ana', criadoEm: new Date('2026-02-05T00:00:00.000Z'), justificativa: JUSTIFICATIVA },
      { operacao: 'UPDATE', dadosAnteriores: { situacao: 'ATIVA', cfopId: ID }, dadosNovos: { situacao: 'ATIVA', cfopId: '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2c', versao: 7 }, usuarioNome: 'Ana', criadoEm: new Date('2026-02-06T00:00:00.000Z'), justificativa: JUSTIFICATIVA },
      { operacao: 'UPDATE', dadosAnteriores: null, dadosNovos: null, usuarioNome: 'Ana', criadoEm: new Date('2026-02-07T00:00:00.000Z'), justificativa: JUSTIFICATIVA },
    ];
    const resposta = await servico({
      select: filaSelect([[{ id: ID }], eventos, [{ codigo: '9' }], []]),
    }).historico(ID);
    expect(resposta.map((item) => item.resumo)).toEqual([
      'Removido',
      'Perfil duplicado do código 9',
      'Perfil duplicado do código ',
      'Enquadramento cadastrado',
      'Inativado',
      'Reativado',
      'CFOP alterado',
      'Enquadramento atualizado',
    ]);
    expect(resposta[1]?.usuarioNome).toBe('');
    expect(resposta[1]?.criadoEm).toContain('2026-02-01');
    expect(resposta[4]?.versao).toBe(4);
    expect(resposta[7]?.versao).toBeNull();
    expect(resposta[7]?.situacaoAnterior).toBeNull();
    await expect(servico({ select: filaSelect([[]]) }).historico(ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bloqueia CFOP e NCM indisponíveis e enquadramento inexistente na trava', async () => {
    const alvo = servico() as unknown as {
      exigirPreCondicoes(tx: { select: ReturnType<typeof filaSelect> }, chave: Record<string, string>): Promise<void>;
      obter(tx: { select: ReturnType<typeof filaSelect> }, id: string): Promise<unknown>;
      obterBloqueado(tx: { select: ReturnType<typeof filaSelect> }, id: string): Promise<unknown>;
    };
    const chave = dtoBase();
    const ok = [{ deletedAt: null }];
    const produto = [{ status: 'ativo', deletedAt: null }];
    const cliente = [{ status: 'ativo', deletedAt: null }];
    await expect(alvo.exigirPreCondicoes(
      { select: filaSelect([ok, produto, cliente, [{ deletedAt: new Date() }]]) },
      chave,
    )).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(alvo.exigirPreCondicoes(
      { select: filaSelect([ok, produto, cliente, ok, []]) },
      chave,
    )).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(alvo.obter({ select: filaSelect([[]]) }, ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(alvo.obterBloqueado({ select: filaSelect([[]]) }, ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('repete código único, falha sem linha e propaga erro que não é unicidade', async () => {
    const alvo = servico() as unknown as {
      inserirComCodigo(tx: object, valores: Record<string, unknown>): Promise<{ id: string }>;
    };
    const unica = Object.assign(new Error('dup'), { code: '23505', constraint: 'uq_enquadramentos_codigo' });
    const txDe = (passos: Array<'ok' | 'vazio' | 'unica' | 'outro'>) => {
      const fila = [...passos];
      return {
        execute: jest.fn(async () => ({ rows: [{ proximo: '11' }] })),
        insert: () => ({
          values: () => ({
            returning: () => {
              const passo = fila.shift();
              if (passo === 'ok') return Promise.resolve([{ id: ID, codigo: '11' }]);
              if (passo === 'vazio') return Promise.resolve([]);
              if (passo === 'unica') return Promise.reject(unica);
              return Promise.reject(Object.assign(new Error('boom'), { code: '23503' }));
            },
          }),
        }),
      };
    };
    await expect(alvo.inserirComCodigo(txDe(['unica', 'ok']), {})).resolves.toEqual(expect.objectContaining({ id: ID }));
    await expect(alvo.inserirComCodigo(txDe(['vazio']), {})).rejects.toThrow('Falha ao gravar enquadramento');
    await expect(alvo.inserirComCodigo(txDe(['unica', 'unica']), {})).rejects.toBeInstanceOf(ConflictException);
    await expect(alvo.inserirComCodigo(txDe(['outro']), {})).rejects.toThrow('boom');
  });

  it('criar omite fim de vigência e atualizar rejeita inativo, concorrência e fim ausente', async () => {
    const db = {
      transaction: async (fn: (tx: object) => Promise<unknown>) => fn({
        update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
      }),
    };
    const criado = servico(db);
    jest.spyOn(criado as never, 'travarAprovado' as never).mockResolvedValue({ id: ID, empresaId: ID, situacao: 'APPROVED' } as never);
    jest.spyOn(criado as never, 'exigirPreCondicoes' as never).mockResolvedValue(undefined as never);
    jest.spyOn(criado as never, 'garantirSemSobreposicao' as never).mockResolvedValue(undefined as never);
    const inserir = jest.spyOn(criado as never, 'inserirComCodigo' as never).mockResolvedValue({
      id: ID, situacao: 'ATIVA', estabelecimentoId: ID, empresaId: ID,
    } as never);
    jest.spyOn(criado as never, 'detalhar' as never).mockResolvedValue({ id: ID } as never);
    await criado.criar({ ...dtoBase(), estabelecimentoId: ID }, 'u1');
    expect(inserir).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ vigenciaFim: null }));

    const edicao = servico(db);
    jest.spyOn(edicao as never, 'obterBloqueado' as never).mockResolvedValue(anterior('INATIVA') as never);
    await expect(edicao.atualizar(ID, { ...dtoBase(), versao: 1 }, 'u1')).rejects.toBeInstanceOf(ConflictException);

    const concorrente = servico(db);
    jest.spyOn(concorrente as never, 'obterBloqueado' as never).mockResolvedValue(anterior('ATIVA') as never);
    jest.spyOn(concorrente as never, 'travarAprovado' as never).mockResolvedValue({ id: ID } as never);
    jest.spyOn(concorrente as never, 'exigirPreCondicoes' as never).mockResolvedValue(undefined as never);
    jest.spyOn(concorrente as never, 'garantirSemSobreposicao' as never).mockResolvedValue(undefined as never);
    await expect(concorrente.atualizar(ID, { ...dtoBase(), versao: 1 }, 'u1')).rejects.toBeInstanceOf(ConflictException);

    const semFim = servico({
      transaction: async (fn: (tx: object) => Promise<unknown>) => fn({
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [{ id: ID, situacao: 'ATIVA', estabelecimentoId: ID, empresaId: ID }],
            }),
          }),
        }),
      }),
    });
    jest.spyOn(semFim as never, 'obterBloqueado' as never).mockResolvedValue(anterior('ATIVA') as never);
    jest.spyOn(semFim as never, 'travarAprovado' as never).mockResolvedValue({ id: ID } as never);
    jest.spyOn(semFim as never, 'exigirPreCondicoes' as never).mockResolvedValue(undefined as never);
    jest.spyOn(semFim as never, 'garantirSemSobreposicao' as never).mockResolvedValue(undefined as never);
    jest.spyOn(semFim as never, 'detalhar' as never).mockResolvedValue({ id: ID } as never);
    await expect(semFim.atualizar(ID, { ...dtoBase(), versao: 1 }, 'u1')).resolves.toEqual({ id: ID });
  });

  it('inativar, reativar e remover cobrem transição inválida e retorno vazio', async () => {
    const dbVazio = {
      transaction: async (fn: (tx: object) => Promise<unknown>) => fn({
        update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
      }),
    };
    const inativo = servico(dbVazio);
    jest.spyOn(inativo as never, 'obterBloqueado' as never).mockResolvedValue(anterior('INATIVA') as never);
    await expect(inativo.inativar(ID, { versao: 1, justificativa: JUSTIFICATIVA }, 'u1'))
      .rejects.toBeInstanceOf(ConflictException);

    const inativarVazio = servico(dbVazio);
    jest.spyOn(inativarVazio as never, 'obterBloqueado' as never).mockResolvedValue(anterior('ATIVA') as never);
    jest.spyOn(inativarVazio as never, 'travarAprovado' as never).mockResolvedValue({ id: ID } as never);
    await expect(inativarVazio.inativar(ID, { versao: 1, justificativa: JUSTIFICATIVA }, 'u1'))
      .rejects.toBeInstanceOf(ConflictException);

    const reativarAtiva = servico(dbVazio);
    jest.spyOn(reativarAtiva as never, 'obterBloqueado' as never).mockResolvedValue(anterior('ATIVA') as never);
    await expect(reativarAtiva.reativar(ID, { versao: 1, justificativa: JUSTIFICATIVA }, 'u1'))
      .rejects.toBeInstanceOf(ConflictException);

    const reativarVazio = servico(dbVazio);
    jest.spyOn(reativarVazio as never, 'obterBloqueado' as never).mockResolvedValue(anterior('INATIVA') as never);
    jest.spyOn(reativarVazio as never, 'travarAprovado' as never).mockResolvedValue({ id: ID } as never);
    jest.spyOn(reativarVazio as never, 'exigirPreCondicoes' as never).mockResolvedValue(undefined as never);
    jest.spyOn(reativarVazio as never, 'garantirSemSobreposicao' as never).mockResolvedValue(undefined as never);
    await expect(reativarVazio.reativar(ID, { versao: 1, justificativa: JUSTIFICATIVA }, 'u1'))
      .rejects.toBeInstanceOf(ConflictException);

    const remover = servico(dbVazio);
    jest.spyOn(remover as never, 'obterBloqueado' as never).mockResolvedValue(anterior('ATIVA') as never);
    jest.spyOn(remover as never, 'travarAprovado' as never).mockResolvedValue({ id: ID } as never);
    await expect(remover.remover(ID, { justificativa: JUSTIFICATIVA }, 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
