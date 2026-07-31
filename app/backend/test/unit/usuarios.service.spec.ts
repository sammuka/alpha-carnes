import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsuariosService } from '../../src/modules/usuarios/usuarios.service';

function thenable(rows: unknown[]) {
  return {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
  };
}

function selectChain(rows: unknown[], extras: Record<string, unknown> = {}) {
  const terminal = thenable(rows);
  const chain: Record<string, unknown> = {
    from: jest.fn(() => chain),
    where: jest.fn(() => chain),
    orderBy: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    offset: jest.fn(() => chain),
    leftJoin: jest.fn(() => chain),
    innerJoin: jest.fn(() => chain),
    groupBy: jest.fn(() => chain),
    for: jest.fn(() => chain),
    ...extras,
    then: terminal.then.bind(terminal),
  };
  return chain;
}

describe('UsuariosService — branches E5.1', () => {
  const rbac = {
    assertCriadorNaoAprovador: jest.fn(),
  };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  function makeService(db: Record<string, unknown>) {
    return new UsuariosService({ db } as never, rbac as never, auditoria as never);
  }

  beforeEach(() => jest.clearAllMocks());

  it('listar → lista vazia retorna [] sem enriquecer', async () => {
    const db = { select: jest.fn(() => selectChain([])) };
    const service = makeService(db);
    await expect(service.listar()).resolves.toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('listar → escopo todos e restrito no enriquecimento', async () => {
    const usuarioTodos = {
      id: 'u-todos', nome: 'Todos', email: 't@t.local', ativo: true,
      ultimoAcesso: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    };
    const usuarioRestrito = {
      id: 'u-rest', nome: 'Rest', email: 'r@t.local', ativo: true,
      ultimoAcesso: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    };
    const db = {
      select: jest.fn()
        // listar usuários
        .mockImplementationOnce(() => selectChain([usuarioTodos, usuarioRestrito]))
        // perfisRows
        .mockImplementationOnce(() => selectChain([
          { usuarioId: 'u-todos', slug: 'comercial' },
          { usuarioId: 'u-rest', slug: 'comercial' },
        ]))
        // representantesPorUsuario
        .mockImplementationOnce(() => selectChain([
          {
            usuarioId: 'u-rest',
            id: 'rep-1',
            nome: 'Rep A',
            status: 'ativo',
            deletedAt: null,
          },
        ])),
    };
    const service = makeService(db);
    const lista = await service.listar();
    expect(lista).toHaveLength(2);
    expect(lista.find((u) => u.id === 'u-todos')).toMatchObject({
      escopoRepresentantes: 'todos',
      representantesPermitidos: [],
      perfis: ['comercial'],
    });
    expect(lista.find((u) => u.id === 'u-rest')).toMatchObject({
      escopoRepresentantes: 'restrito',
      representantesPermitidos: [{ id: 'rep-1', nome: 'Rep A' }],
    });
  });

  it('detalhar → 404 quando usuário não existe', async () => {
    const db = { select: jest.fn(() => selectChain([])) };
    const service = makeService(db);
    await expect(service.detalhar('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('detalhar → escopo restrito quando há representantes', async () => {
    const usuario = {
      id: 'u1', nome: 'N', email: 'n@t.local', ativo: true,
      ultimoAcesso: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    };
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([usuario]))
        // perfisDoUsuario
        .mockImplementationOnce(() => selectChain([{ slug: 'comercial' }]))
        // representantesPorUsuario
        .mockImplementationOnce(() => selectChain([
          { usuarioId: 'u1', id: 'r1', nome: 'Rep', status: 'ativo', deletedAt: null },
        ])),
    };
    const service = makeService(db);
    await expect(service.detalhar('u1')).resolves.toMatchObject({
      id: 'u1',
      escopoRepresentantes: 'restrito',
      representantesPermitidos: [{ id: 'r1' }],
      perfis: ['comercial'],
    });
  });

  it('atualizar → 404 se usuário ativo não encontrado', async () => {
    const tx = { select: jest.fn(() => selectChain([])) };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = makeService(db);
    await expect(service.atualizar('u-x', { nome: 'X' }, 'autor')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualizar → 409 se email colide com outro ativo', async () => {
    const anterior = {
      id: 'u1', nome: 'N', email: 'old@t.local', ativo: true,
      ultimoAcesso: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    };
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([anterior]))
        .mockImplementationOnce(() => selectChain([{ id: 'outro' }])),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = makeService(db);
    await expect(
      service.atualizar('u1', { email: 'novo@t.local' }, 'autor'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('remover → 404 se usuário não encontrado', async () => {
    const tx = { select: jest.fn(() => selectChain([])) };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = makeService(db);
    await expect(service.remover('u-x', 'autor')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restaurar → 404 / 409 não removido / 409 email colisão', async () => {
    const tx404 = { select: jest.fn(() => selectChain([])) };
    const db404 = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx404)) };
    await expect(makeService(db404).restaurar('u-x', 'autor')).rejects.toBeInstanceOf(NotFoundException);

    const ativo = {
      id: 'u1', nome: 'N', email: 'a@t.local', ativo: true,
      ultimoAcesso: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    };
    const txAtivo = { select: jest.fn(() => selectChain([ativo])) };
    const dbAtivo = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txAtivo)) };
    await expect(makeService(dbAtivo).restaurar('u1', 'autor')).rejects.toThrow('não está removido');

    const removido = { ...ativo, deletedAt: new Date(), ativo: false };
    const txColisao = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([removido]))
        .mockImplementationOnce(() => selectChain([{ id: 'outro-ativo' }])),
    };
    const dbColisao = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txColisao)),
    };
    await expect(makeService(dbColisao).restaurar('u1', 'autor')).rejects.toThrow(
      'Já existe usuário ativo com este email',
    );
  });

  it('definirPerfis → 404 e ramo slugs vazios', async () => {
    const tx404 = { select: jest.fn(() => selectChain([])) };
    const db404 = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx404)) };
    await expect(
      makeService(db404).definirPerfis('u-x', ['comercial'], 'autor'),
    ).rejects.toBeInstanceOf(NotFoundException);

    const usuario = {
      id: 'u1', nome: 'N', email: 'n@t.local', ativo: true,
      ultimoAcesso: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    };
    const tx = {
      select: jest.fn()
        // buscarAtivo
        .mockImplementationOnce(() => selectChain([usuario]))
        // perfisDoUsuario (anteriores)
        .mockImplementationOnce(() => selectChain([{ slug: 'comercial' }])),
      delete: jest.fn(() => ({ where: jest.fn(() => Promise.resolve(undefined)) })),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = makeService(db);
    await expect(service.definirPerfis('u1', [], 'autor')).resolves.toEqual({
      id: 'u1',
      perfis: [],
    });
    expect(auditoria.registrar).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        dadosAnteriores: { perfis: ['comercial'] },
        dadosNovos: { perfis: [] },
      }),
    );
  });

  it('definirRepresentantes → 404 usuário inexistente', async () => {
    const tx = {
      select: jest.fn(() => selectChain([])),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    await expect(
      makeService(db).definirRepresentantes('u-x', [], 'autor'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('definirRepresentantes → rejeita representante removido fora dos anteriores', async () => {
    const tx = {
      select: jest.fn()
        // lock usuário
        .mockImplementationOnce(() => selectChain([{ id: 'u1' }]))
        // anteriores
        .mockImplementationOnce(() => selectChain([]))
        // candidatos
        .mockImplementationOnce(() => selectChain([
          { id: 'rep-del', deletedAt: new Date() },
        ])),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    await expect(
      makeService(db).definirRepresentantes('u1', ['rep-del'], 'autor'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('definirRepresentantes → permite manter representante já vinculado mesmo se soft-deleted', async () => {
    const usuario = {
      id: 'u1', nome: 'N', email: 'n@t.local', ativo: true,
      ultimoAcesso: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    };
    const tx = {
      select: jest.fn()
        // lock usuário
        .mockImplementationOnce(() => selectChain([{ id: 'u1' }]))
        // anteriores (já tinha o rep removido)
        .mockImplementationOnce(() => selectChain([{ representanteId: 'rep-del' }]))
        // candidatos
        .mockImplementationOnce(() => selectChain([
          { id: 'rep-del', deletedAt: new Date() },
        ]))
        // detalharNaTx (noop — mesmos ids)
        .mockImplementationOnce(() => selectChain([usuario]))
        .mockImplementationOnce(() => selectChain([{ slug: 'comercial' }]))
        .mockImplementationOnce(() => selectChain([
          {
            usuarioId: 'u1', id: 'rep-del', nome: 'Ex', status: 'inativo', deletedAt: new Date(),
          },
        ])),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = makeService(db);
    await expect(
      service.definirRepresentantes('u1', ['rep-del'], 'autor'),
    ).resolves.toMatchObject({ id: 'u1', escopoRepresentantes: 'restrito' });
  });

  it('aprovar → 404 quando usuário não existe', async () => {
    const db = { select: jest.fn(() => selectChain([])) };
    await expect(makeService(db).aprovar('u-x', 'aprovador')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resumoPerfis → completa slugs ausentes com total 0', async () => {
    const db = {
      select: jest.fn(() => selectChain([
        { slug: 'comercial', nome: 'Comercial', total: 2 },
      ])),
    };
    const resumo = await makeService(db).resumoPerfis();
    expect(resumo).toHaveLength(11);
    expect(resumo.find((r) => r.slug === 'comercial')).toEqual({
      slug: 'comercial', nome: 'Comercial', total: 2,
    });
    expect(resumo.find((r) => r.slug === 'gestor')).toEqual({
      slug: 'gestor', nome: 'gestor', total: 0,
    });
  });
});
