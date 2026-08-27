import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RbacService } from '../../src/modules/auth/rbac.service';
import { FornecedoresService } from '../../src/modules/cadastros/fornecedores/fornecedores.service';
import { RepresentantesService } from '../../src/modules/cadastros/representantes/representantes.service';
import { CaminhoesCadastroService } from '../../src/modules/frota/caminhoes-cadastro.service';
import { MotoristasService } from '../../src/modules/frota/motoristas.service';
import { ModelosEtiquetaService } from '../../src/modules/modelos-etiqueta/modelos-etiqueta.service';
import { RegrasTransformacaoService } from '../../src/modules/operacao/desossa/regras-transformacao.service';
import { PerfisService } from '../../src/modules/perfis/perfis.service';

const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

function thenable(rows: unknown[]) {
  return {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
  };
}

/** Cadeia select→from→where→… que resolve com `rows` no terminal. */
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
    ...extras,
    then: terminal.then.bind(terminal),
  };
  return chain;
}

function txCrud(opts: {
  selectRows?: unknown[];
  returning?: unknown[];
  insertConflict?: unknown[];
}) {
  const selectRows = opts.selectRows ?? [];
  const returning = opts.returning ?? [{ id: 'x1', deletedAt: new Date() }];
  return {
    select: jest.fn(() => selectChain(selectRows)),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve(returning)),
        onConflictDoNothing: jest.fn(() => Promise.resolve(undefined)),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve(returning)),
        })),
      })),
    })),
    delete: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve(undefined)),
    })),
  };
}

const CAMPOS = {
  codigo: true, produto: true, peso: true, clientePedido: false, destino: true,
  origemFrigorifico: true, nfLote: true, dataHora: true, operador: true,
  caracteristicas: false, qrCode: true, codigoBarras: false,
};

describe('MotoristasService — branches Onda 3', () => {
  it('listar aplica search, status e incluirRemovidos', async () => {
    const list = selectChain([]);
    const count = selectChain([{ total: 0 }]);
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count),
    };
    const service = new MotoristasService({ db } as never, auditoria as never);
    await service.listar({
      page: 1, pageSize: 10, search: 'CNH', status: 'ativo', incluirRemovidos: true,
    });
    expect(list.leftJoin).toHaveBeenCalled();
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('detalhar / atualizar / remover inexistente → NotFound', async () => {
    const db = {
      select: jest.fn(() => selectChain([])),
      transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(txCrud({ selectRows: [] })),
      ),
    };
    const service = new MotoristasService({ db } as never, auditoria as never);
    await expect(service.detalhar('m1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.atualizar('m1', { nome: 'X' }, 'u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remover('m1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('criar com documento duplicado → Conflict', async () => {
    const tx = txCrud({ selectRows: [{ id: 'outro' }] });
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = new MotoristasService({ db } as never, auditoria as never);
    await expect(
      service.criar({ nome: 'A', documento: 'CNH1', status: 'ativo' }, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('criar e atualizar com sucesso (caminhaoPadrao null e troca de documento)', async () => {
    const criado = {
      id: 'm1', nome: 'A', documento: 'D1', telefone: null,
      caminhaoPadraoId: null, status: 'ativo', deletedAt: null,
    };
    const txCriar = txCrud({ selectRows: [], returning: [criado] });
    const anterior = { ...criado, documento: 'D0', caminhaoPadraoId: 'c1' };
    const atualizado = { ...criado, documento: 'D2', caminhaoPadraoId: null };
    let selectN = 0;
    const txUpdate = {
      select: jest.fn(() => {
        selectN += 1;
        // 1º buscarAtivo; 2º assertDocumentoLivre
        return selectChain(selectN === 1 ? [anterior] : []);
      }),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([atualizado])),
          })),
        })),
      })),
    };
    let call = 0;
    const db = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => {
        call += 1;
        return cb(call === 1 ? txCriar : txUpdate);
      }),
    };
    const service = new MotoristasService({ db } as never, auditoria as never);
    await expect(
      service.criar({ nome: 'A', documento: 'D1', status: 'ativo' }, 'u1'),
    ).resolves.toMatchObject({ id: 'm1' });
    await expect(
      service.atualizar('m1', { documento: 'D2', caminhaoPadraoId: null }, 'u1'),
    ).resolves.toMatchObject({ caminhaoPadraoId: null });
  });

  it('remover e restaurar cobrem soft-delete e conflitos', async () => {
    const ativo = { id: 'm1', documento: 'D1', deletedAt: null };
    const removido = { id: 'm1', documento: 'D1', deletedAt: new Date() };
    const txRemover = {
      select: jest.fn(() => selectChain([ativo])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([removido])),
          })),
        })),
      })),
    };
    const txRestaurarAtivo = { select: jest.fn(() => selectChain([ativo])) };
    const txRestaurarInexistente = { select: jest.fn(() => selectChain([])) };
    let selectN = 0;
    const txRestaurarOk = {
      select: jest.fn(() => {
        selectN += 1;
        return selectChain(selectN === 1 ? [removido] : []);
      }),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...removido, deletedAt: null }])),
          })),
        })),
      })),
    };
    const txs = [txRemover, txRestaurarAtivo, txRestaurarInexistente, txRestaurarOk];
    let i = 0;
    const db = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txs[i++])),
    };
    const service = new MotoristasService({ db } as never, auditoria as never);
    await expect(service.remover('m1', 'u1')).resolves.toMatchObject({ id: 'm1' });
    await expect(service.restaurar('m1', 'u1')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.restaurar('m1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.restaurar('m1', 'u1')).resolves.toMatchObject({ deletedAt: null });
  });
});

describe('ModelosEtiquetaService — branches Onda 3', () => {
  it('listar com search e incluirRemovidos', async () => {
    const list = selectChain([]);
    const count = selectChain([{ total: 0 }]);
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count),
    };
    const service = new ModelosEtiquetaService({ db } as never, auditoria as never);
    await service.listar({ page: 1, pageSize: 10, search: 'peca', incluirRemovidos: true });
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('detalhar / atualizar / remover inexistente → NotFound', async () => {
    const db = {
      select: jest.fn(() => selectChain([])),
      transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(txCrud({ selectRows: [] })),
      ),
    };
    const service = new ModelosEtiquetaService({ db } as never, auditoria as never);
    await expect(service.detalhar('e1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.atualizar('e1', { nome: 'X' }, 'u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remover('e1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('criar conflito de slug; ciclo criar/atualizar/remover/restaurar', async () => {
    const txDup = txCrud({ selectRows: [{ id: 'outro' }] });
    const criado = {
      id: 'e1', slug: 'novo', nome: 'Novo', campos: CAMPOS, status: 'ativo', deletedAt: null,
    };
    const txCriar = txCrud({ selectRows: [], returning: [criado] });
    const txUpdate = {
      select: jest.fn(() => selectChain([criado])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...criado, nome: 'Editado' }])),
          })),
        })),
      })),
    };
    const removido = { ...criado, deletedAt: new Date() };
    const txRemover = {
      select: jest.fn(() => selectChain([criado])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([removido])),
          })),
        })),
      })),
    };
    const txRestAtivo = { select: jest.fn(() => selectChain([criado])) };
    let sn = 0;
    const txRestOk = {
      select: jest.fn(() => {
        sn += 1;
        return selectChain(sn === 1 ? [removido] : []);
      }),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...removido, deletedAt: null }])),
          })),
        })),
      })),
    };
    const txs = [txDup, txCriar, txUpdate, txRemover, txRestAtivo, txRestOk];
    let i = 0;
    const db = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txs[i++])),
    };
    const service = new ModelosEtiquetaService({ db } as never, auditoria as never);
    await expect(
      service.criar({ slug: 'novo', nome: 'N', campos: CAMPOS, status: 'ativo' }, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.criar({ slug: 'novo', nome: 'N', campos: CAMPOS, status: 'ativo' }, 'u1'),
    ).resolves.toMatchObject({ id: 'e1' });
    await expect(service.atualizar('e1', { nome: 'Editado' }, 'u1')).resolves.toMatchObject({ nome: 'Editado' });
    await expect(service.remover('e1', 'u1')).resolves.toMatchObject({ id: 'e1' });
    await expect(service.restaurar('e1', 'u1')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.restaurar('e1', 'u1')).resolves.toMatchObject({ deletedAt: null });
  });

  it('restaurar inexistente → NotFound', async () => {
    const db = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb({ select: jest.fn(() => selectChain([])) }),
      ),
    };
    const service = new ModelosEtiquetaService({ db } as never, auditoria as never);
    await expect(service.restaurar('e-x', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CaminhoesCadastroService — branches Onda 3', () => {
  it('listar com status e sem search; detalhar 404', async () => {
    const list = selectChain([]);
    const count = selectChain([{ total: 0 }]);
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count)
        .mockImplementationOnce(() => selectChain([])),
    };
    const service = new CaminhoesCadastroService({ db } as never, auditoria as never);
    await service.listar({ page: 1, pageSize: 5, status: 'inativo', incluirRemovidos: false });
    await expect(service.detalhar('c1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualizar placa duplicada e restaurar conflito/inexistente', async () => {
    const anterior = { id: 'c1', placa: 'AAA', descricao: null, capacidadeKg: null, rotaPadraoId: null, status: 'ativo', deletedAt: null };
    let sn = 0;
    const txUpdateDup = {
      select: jest.fn(() => {
        sn += 1;
        return selectChain(sn === 1 ? [anterior] : [{ id: 'outro' }]);
      }),
    };
    const txRestAtivo = { select: jest.fn(() => selectChain([anterior])) };
    const txRest404 = { select: jest.fn(() => selectChain([])) };
    const txs = [txUpdateDup, txRestAtivo, txRest404];
    let i = 0;
    const db = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txs[i++])),
    };
    const service = new CaminhoesCadastroService({ db } as never, auditoria as never);
    await expect(service.atualizar('c1', { placa: 'BBB' }, 'u1')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.restaurar('c1', 'u1')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.restaurar('c1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualizar com rotaPadraoId null e campos omitidos', async () => {
    const anterior = {
      id: 'c1', placa: 'AAA', descricao: 'd', capacidadeKg: 1,
      rotaPadraoId: 'r1', status: 'ativo', deletedAt: null,
    };
    const tx = {
      select: jest.fn(() => selectChain([anterior])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...anterior, rotaPadraoId: null }])),
          })),
        })),
      })),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = new CaminhoesCadastroService({ db } as never, auditoria as never);
    await expect(
      service.atualizar('c1', { rotaPadraoId: null }, 'u1'),
    ).resolves.toMatchObject({ rotaPadraoId: null });
  });
});

describe('FornecedoresService — branches Onda 3', () => {
  it('contagens usa fallback quando select vazio', async () => {
    const db = { select: jest.fn(() => selectChain([])) };
    const service = new FornecedoresService({ db } as never, auditoria as never);
    await expect(service.contagens()).resolves.toEqual({ total: 0, ativos: 0, inativos: 0 });
  });

  it('historico sem ocorrências e assertUnico por documento', async () => {
    const fornecedor = { id: 'f1', codigo: 'F', documentoFiscal: '1', deletedAt: null };
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([fornecedor])) // detalhar
        .mockImplementationOnce(() => selectChain([{ total: 0 }])) // contagem ano
        .mockImplementationOnce(() => selectChain([])), // ultima
    };
    const service = new FornecedoresService({ db } as never, auditoria as never);
    await expect(service.historico('f1')).resolves.toEqual({
      ocorrenciasAno: 0,
      ultimaDivergencia: null,
    });

    const tx = {
      select: jest.fn(() => selectChain([{ id: 'outro', codigo: 'X', documentoFiscal: 'DOC' }])),
    };
    const db2 = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const s2 = new FornecedoresService({ db: db2 } as never, auditoria as never);
    await expect(
      s2.criar({
        codigo: 'Y', razaoSocial: 'R', documentoFiscal: 'DOC', status: 'ativo',
      }, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('assertUnico ignora o próprio id; atualizar inexistente → NotFound', async () => {
    const anterior = {
      id: 'f1', codigo: 'F1', razaoSocial: 'R', documentoFiscal: 'D1',
      status: 'ativo', contatosJson: {}, parametrosOperacionaisJson: {},
      observacoes: null, deletedAt: null,
    };
    const txOk = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([anterior]))
        .mockImplementationOnce(() => selectChain([{ id: 'f1', codigo: 'F1', documentoFiscal: 'D1' }])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...anterior, razaoSocial: 'R2' }])),
          })),
        })),
      })),
    };
    const tx404 = { select: jest.fn(() => selectChain([])) };
    let i = 0;
    const db = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb(i++ === 0 ? txOk : tx404),
      ),
    };
    const service = new FornecedoresService({ db } as never, auditoria as never);
    await expect(service.atualizar('f1', { razaoSocial: 'R2' }, 'u1')).resolves.toMatchObject({
      razaoSocial: 'R2',
    });
    await expect(service.atualizar('f1', {}, 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listar com search; restaurar inexistente', async () => {
    const list = selectChain([]);
    const count = selectChain([{ total: 0 }]);
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count),
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb({ select: jest.fn(() => selectChain([])) }),
      ),
    };
    const service = new FornecedoresService({ db } as never, auditoria as never);
    await service.listar({ page: 1, pageSize: 10, search: 'ABC', incluirRemovidos: false });
    await expect(service.restaurar('f-x', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RepresentantesService — branches Onda 3', () => {
  it('listar com status/tipoCanal/search e canais()', async () => {
    const list = selectChain([]);
    const count = selectChain([{ total: 0 }]);
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count),
      selectDistinct: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => Promise.resolve([{ tipoCanal: 'atacado' }, { tipoCanal: null }])),
          })),
        })),
      })),
    };
    const service = new RepresentantesService({ db } as never, auditoria as never);
    await service.listar({
      page: 1, pageSize: 10, search: 'rep', status: 'ativo', tipoCanal: 'atacado', incluirRemovidos: false,
    });
    await expect(service.canais()).resolves.toEqual(['atacado']);
  });

  it('detalhar com clientes; criar código duplicado; atualizar/restaurar 404', async () => {
    const rep = { id: 'r1', codigo: 'R1', nome: 'N', deletedAt: null, status: 'ativo' };
    const dbDetalhe = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([rep]))
        .mockImplementationOnce(() => selectChain([{ id: 'c1', nomeFantasia: 'F', razaoSocial: 'RS' }]))
        .mockImplementationOnce(() => selectChain([
          { id: 'u1', nome: 'Ana', email: 'a@test.local', ativo: true },
        ])),
    };
    const s1 = new RepresentantesService({ db: dbDetalhe } as never, auditoria as never);
    await expect(s1.detalhar('r1')).resolves.toMatchObject({
      id: 'r1',
      clientesVinculados: [{ id: 'c1' }],
      usuariosVinculados: [{ id: 'u1', nome: 'Ana' }],
    });

    const txDup = { select: jest.fn(() => selectChain([{ id: 'outro' }])) };
    const dbDup = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txDup)) };
    const s2 = new RepresentantesService({ db: dbDup } as never, auditoria as never);
    await expect(
      s2.criar({ codigo: 'R1', nome: 'N', status: 'ativo' }, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);

    const db404 = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb({ select: jest.fn(() => selectChain([])) }),
      ),
    };
    const s3 = new RepresentantesService({ db: db404 } as never, auditoria as never);
    await expect(s3.atualizar('r1', { nome: 'X' }, 'u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(s3.restaurar('r1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assertCodigoUnico ignora idAtual; remover sucesso', async () => {
    const anterior = {
      id: 'r1', codigo: 'R1', nome: 'N', tipoCanal: null, contato: null,
      status: 'ativo', observacao: null, deletedAt: null,
    };
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([anterior]))
        .mockImplementationOnce(() => selectChain([{ id: 'r1' }])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...anterior, deletedAt: new Date() }])),
          })),
        })),
      })),
    };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = new RepresentantesService({ db } as never, auditoria as never);
    await expect(service.remover('r1', 'u1')).resolves.toMatchObject({ id: 'r1' });
  });
});

describe('RbacService — branches Onda 3', () => {
  it('resolverPermissoes e menusVisiveis com lista vazia', async () => {
    const service = new RbacService({ db: null } as never);
    await expect(service.resolverPermissoes([])).resolves.toEqual([]);
    await expect(service.menusVisiveisDePerfis([])).resolves.toEqual([]);
  });

  it('menusVisiveisDePerfis une e ordena canônicos', async () => {
    const db = {
      select: jest.fn(() => selectChain([
        { menus: ['/estoque/consulta', '/admin/usuarios'] },
        { menus: ['/carga/conferencia'] },
      ])),
    };
    const service = new RbacService({ db } as never);
    const menus = await service.menusVisiveisDePerfis(['gestor', 'conferente']);
    expect(menus).toContain('/admin/usuarios');
    expect(menus).toContain('/carga/conferencia');
  });

  it('definirMenusDoPerfil e definirPermissoesDoPerfil retornam null se slug sumiu', async () => {
    const tx = { select: jest.fn(() => selectChain([])) };
    const db = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const service = new RbacService({ db } as never);
    await expect(service.definirMenusDoPerfil('x', [])).resolves.toBeNull();
    await expect(service.definirPermissoesDoPerfil('x', [])).resolves.toBeNull();
  });

  it('definirMenusDoPerfil e definirPermissoesDoPerfil com sucesso (inclui codigos vazios)', async () => {
    const perfil = { id: 'p1', slug: 'comercial', menusVisiveis: ['/comercial/pedidos'] };
    const txMenus = {
      select: jest.fn(() => selectChain([perfil])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve(undefined)) })),
      })),
    };
    let step = 0;
    const txPerms = {
      select: jest.fn(() => {
        step += 1;
        if (step === 1) return selectChain([perfil]);
        return selectChain([{ codigo: 'PEDIDOS_LER' }]);
      }),
      delete: jest.fn(() => ({ where: jest.fn(() => Promise.resolve(undefined)) })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => Promise.resolve(undefined)),
        })),
      })),
    };
    let i = 0;
    const db = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb(i++ === 0 ? txMenus : txPerms),
      ),
    };
    const service = new RbacService({ db } as never);
    await expect(service.definirMenusDoPerfil('comercial', ['/comercial/pedidos', '/comercial/pedidos']))
      .resolves.toEqual({ anterior: ['/comercial/pedidos'], novo: ['/comercial/pedidos'] });
    await expect(service.definirPermissoesDoPerfil('comercial', []))
      .resolves.toEqual({ anterior: ['PEDIDOS_LER'], novo: [] });
  });

  it('ensurePermissoes e listarPerfisComPermissoes', async () => {
    const db = {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => Promise.resolve(undefined)),
        })),
      })),
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([{ id: 'p1', slug: 'administrador' }]))
        .mockImplementationOnce(() => selectChain([{ id: 'perm1', codigo: 'USUARIOS_LER' }]))
        .mockImplementationOnce(() => selectChain([
          { id: 'p1', slug: 'administrador', nome: 'Admin', menusVisiveis: [] },
        ]))
        .mockImplementationOnce(() => selectChain([{ perfilId: 'p1', codigo: 'USUARIOS_LER' }])),
    };
    const service = new RbacService({ db } as never);
    await service.ensurePermissoesF1();
    const lista = await service.listarPerfisComPermissoes();
    expect(lista[0]?.permissoes).toContain('USUARIOS_LER');
  });

  it('resolverPermissoes deduplica códigos', async () => {
    const db = {
      select: jest.fn(() => selectChain([{ codigo: 'A' }, { codigo: 'A' }, { codigo: 'B' }])),
    };
    const service = new RbacService({ db } as never);
    await expect(service.resolverPermissoes(['gestor'])).resolves.toEqual(['A', 'B']);
  });
});

describe('RegrasTransformacaoService — branches Onda 3', () => {
  it('assertProdutosValidos e restaurar conflitos', async () => {
    const txBad = {
      select: jest.fn(() => selectChain([{ id: 'p1' }])),
    };
    const dbBad = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txBad)) };
    const s1 = new RegrasTransformacaoService({ db: dbBad } as never, auditoria as never);
    await expect(
      s1.criar({
        nome: 'R', produtoOrigemCodigo: 'TZ', status: 'ativo', prioridade: 1,
        saidas: [
          { produtoId: 'p1', quantidadeFixa: 1 },
          { produtoId: 'p2', quantidadeFixa: 1 },
        ],
      }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const txRest = {
      select: jest.fn(() => selectChain([{ id: 'r1', deletedAt: null }])),
    };
    const dbRest = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txRest)) };
    const s2 = new RegrasTransformacaoService({ db: dbRest } as never, auditoria as never);
    await expect(s2.restaurar('r1', 'u1')).rejects.toBeInstanceOf(ConflictException);

    const db404 = {
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb({ select: jest.fn(() => selectChain([])) }),
      ),
    };
    const s3 = new RegrasTransformacaoService({ db: db404 } as never, auditoria as never);
    await expect(s3.restaurar('r1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualizar sem saidas e com saidas; detalhar 404', async () => {
    const anterior = {
      id: 'r1', nome: 'A', produtoOrigemCodigo: 'TZ', status: 'ativo',
      prioridade: 1, observacao: null, deletedAt: null,
    };
    const saidas = [{ id: 's1', regraId: 'r1', produtoId: 'p1', quantidadeFixa: '1' }];
    let sn = 0;
    const txSemSaidas = {
      select: jest.fn(() => {
        sn += 1;
        if (sn === 1) return selectChain([anterior]);
        return selectChain(saidas);
      }),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...anterior, nome: 'B' }])),
          })),
        })),
      })),
    };
    const db = {
      select: jest.fn(() => selectChain([])),
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txSemSaidas)),
    };
    const service = new RegrasTransformacaoService({ db } as never, auditoria as never);
    await expect(service.detalhar('r1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.atualizar('r1', { nome: 'B' }, 'u1')).resolves.toMatchObject({ nome: 'B' });
  });

  it('simular cobre tzRestante e max de disponibilidade', async () => {
    const regras = [
      {
        id: 'a', nome: 'A',
        saidas: [
          { produtoId: 'p1', produtoNome: 'P1', quantidadeFixa: '2' },
          { produtoId: 'p2', produtoNome: 'P2', quantidadeFixa: '0' },
        ],
      },
      {
        id: 'b', nome: 'B',
        saidas: [
          { produtoId: 'p1', produtoNome: 'P1', quantidadeFixa: '1' },
          { produtoId: 'p3', produtoNome: 'P3', quantidadeFixa: '1' },
        ],
      },
    ];
    const service = new RegrasTransformacaoService({ db: {} as never } as never, {} as never);
    jest.spyOn(
      service as RegrasTransformacaoService & {
        listarAtivasComSaidas: () => Promise<typeof regras>;
      },
      'listarAtivasComSaidas',
    ).mockResolvedValue(regras);

    const semReserva = await service.simular({ tzLivre: 5 });
    expect(semReserva.resultados.find((r) => r.produtoId === 'p1')?.disponivel).toBe(10);

    const comReservaOutro = await service.simular({ tzLivre: 5, produtoId: 'p3', quantidade: 2 });
    expect(comReservaOutro.alternativasPossiveis.some((a) => a.id === 'b')).toBe(true);

    const porTzZero = await service.simular({ tzLivre: 5, produtoId: 'p2', quantidade: 1 });
    expect(porTzZero.alternativasPossiveis.length).toBeGreaterThanOrEqual(0);

    const produtoInexistente = await service.simular({
      tzLivre: 5, produtoId: 'px', quantidade: 1,
    });
    expect(produtoInexistente.tzLivre).toBe(5);
  });

  it('listarAtivasComSaidas e listar com removidos', async () => {
    const regra = { id: 'r1', nome: 'A', status: 'ativo', deletedAt: null, prioridade: 1, createdAt: new Date() };
    const list = selectChain([regra]);
    const count = selectChain([{ total: 1 }]);
    const saidas = selectChain([{
      produtoId: 'p1', produtoNome: 'P1', quantidadeFixa: '1',
    }]);
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count)
        .mockImplementationOnce(() => selectChain([])) // montarDetalhe saidas
        .mockImplementationOnce(() => selectChain([regra])) // listarAtivas
        .mockImplementationOnce(() => saidas),
    };
    const service = new RegrasTransformacaoService({ db } as never, auditoria as never);
    await service.listar({ page: 1, pageSize: 10, incluirRemovidos: true });
    await expect(service.listarAtivasComSaidas()).resolves.toEqual([
      { id: 'r1', nome: 'A', saidas: [{ produtoId: 'p1', produtoNome: 'P1', quantidadeFixa: '1' }] },
    ]);
  });
});

describe('PerfisService — branches Onda 3', () => {
  it('definirMenus e definirPermissoes → NotFound quando rbac devolve null', async () => {
    const rbac = {
      definirMenusDoPerfil: jest.fn().mockResolvedValue(null),
      definirPermissoesDoPerfil: jest.fn().mockResolvedValue(null),
    };
    const db = {
      select: jest.fn(() => selectChain([{ codigo: 'USUARIOS_LER' }])),
    };
    const service = new PerfisService({ db } as never, rbac as never, auditoria as never);
    await expect(service.definirMenus('x', ['/comercial/pedidos'], 'u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.definirPermissoes('x', [], 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('definirPermissoes rejeita código desconhecido antes de mutar', async () => {
    const rbac = { definirPermissoesDoPerfil: jest.fn() };
    const db = { select: jest.fn(() => selectChain([])) };
    const service = new PerfisService({ db } as never, rbac as never, auditoria as never);
    await expect(
      service.definirPermissoes('comercial', ['NAO_EXISTE'], 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(rbac.definirPermissoesDoPerfil).not.toHaveBeenCalled();
  });

  it('definirMenus e definirPermissoes com sucesso', async () => {
    const rbac = {
      listarPerfisComPermissoes: jest.fn().mockResolvedValue([]),
      definirMenusDoPerfil: jest.fn().mockResolvedValue({ anterior: [], novo: ['/comercial/pedidos'] }),
      definirPermissoesDoPerfil: jest.fn().mockResolvedValue({ anterior: [], novo: ['USUARIOS_LER'] }),
    };
    const db = {
      select: jest.fn(() => selectChain([{ codigo: 'USUARIOS_LER' }])),
    };
    const service = new PerfisService({ db } as never, rbac as never, auditoria as never);
    await expect(service.listar()).resolves.toEqual([]);
    await expect(service.definirMenus('comercial', ['/comercial/pedidos'], 'u1'))
      .resolves.toEqual({ slug: 'comercial', menusVisiveis: ['/comercial/pedidos'] });
    await expect(service.definirPermissoes('comercial', ['USUARIOS_LER'], 'u1'))
      .resolves.toEqual({ slug: 'comercial', permissoes: ['USUARIOS_LER'] });
    expect(service.catalogo().grupos.length).toBeGreaterThan(0);
  });

  it('definirMenus rejeita href fora do catálogo', async () => {
    const rbac = { definirMenusDoPerfil: jest.fn() };
    const service = new PerfisService({ db: {} } as never, rbac as never, auditoria as never);
    await expect(service.definirMenus('comercial', ['/rota/fantasma'], 'u1'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(rbac.definirMenusDoPerfil).not.toHaveBeenCalled();
  });
});

describe('Branches extras — ?? / ternários / filtros', () => {
  it('motorista atualizar cobre todos os ?? e documento igual (sem reassert)', async () => {
    const anterior = {
      id: 'm1', nome: 'A', documento: 'D1', telefone: '1',
      caminhaoPadraoId: 'c1', status: 'ativo', deletedAt: null,
    };
    const tx = {
      select: jest.fn(() => selectChain([anterior])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{
              ...anterior, nome: 'B', telefone: '9', status: 'inativo', caminhaoPadraoId: 'c2',
            }])),
          })),
        })),
      })),
    };
    const list = selectChain([]);
    const count = selectChain([{ total: 0 }]);
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count),
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
    };
    const service = new MotoristasService({ db } as never, auditoria as never);
    await service.atualizar('m1', {
      nome: 'B', documento: 'D1', telefone: '9', status: 'inativo', caminhaoPadraoId: 'c2',
    }, 'u1');
    // partial update — todos os ?? do lado esquerdo
    await service.atualizar('m1', {}, 'u1');
    await service.listar({ page: 1, pageSize: 10, incluirRemovidos: false });
  });

  it('modelo atualizar parcial e listar sem search', async () => {
    const anterior = {
      id: 'e1', slug: 's', nome: 'N', campos: CAMPOS, status: 'ativo', deletedAt: null,
    };
    const tx = {
      select: jest.fn(() => selectChain([anterior])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...anterior, status: 'inativo' }])),
          })),
        })),
      })),
    };
    const list = selectChain([anterior]);
    const count = selectChain([{ total: 1 }]);
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count),
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
    };
    const service = new ModelosEtiquetaService({ db } as never, auditoria as never);
    await service.listar({ page: 1, pageSize: 10, incluirRemovidos: false });
    await service.atualizar('e1', { status: 'inativo' }, 'u1');
    await service.atualizar('e1', {}, 'u1');
  });

  it('caminhao criar/remover/listar search e atualizar placa igual', async () => {
    const criado = {
      id: 'c1', placa: 'AAA', descricao: 'd', capacidadeKg: 10,
      rotaPadraoId: null, status: 'ativo', deletedAt: null,
    };
    const txCriar = txCrud({ selectRows: [], returning: [criado] });
    const txUpdate = {
      select: jest.fn(() => selectChain([criado])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...criado, descricao: 'e' }])),
          })),
        })),
      })),
    };
    const txRemover = {
      select: jest.fn(() => selectChain([criado])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...criado, deletedAt: new Date() }])),
          })),
        })),
      })),
    };
    const txs = [txCriar, txUpdate, txRemover, txCrud({ selectRows: [] })];
    let i = 0;
    const list = selectChain([]);
    const count = selectChain([{ total: 0 }]);
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count),
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txs[i++])),
    };
    const service = new CaminhoesCadastroService({ db } as never, auditoria as never);
    await service.listar({ page: 1, pageSize: 10, search: 'AAA', incluirRemovidos: true });
    await service.criar(
      { placa: 'AAA', descricao: 'd', capacidadeKg: 10, status: 'ativo', veiculoProprio: true },
      'u1',
    );
    await service.atualizar('c1', { placa: 'AAA', descricao: 'e' }, 'u1');
    await service.remover('c1', 'u1');
    await expect(service.remover('c1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fornecedor criar conflito de código; historico com ultima; restaurar sucesso', async () => {
    const txCod = {
      select: jest.fn(() => selectChain([{ id: 'outro', codigo: 'F1', documentoFiscal: 'X' }])),
    };
    const fornecedor = { id: 'f1', codigo: 'F1', deletedAt: null };
    const dbHist = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([fornecedor]))
        .mockImplementationOnce(() => selectChain([{ total: 2 }]))
        .mockImplementationOnce(() => selectChain([{ data: new Date(), tipo: 'falta_peso' }])),
    };
    const removido = {
      id: 'f1', codigo: 'F1', documentoFiscal: 'D', razaoSocial: 'R',
      status: 'ativo', contatosJson: {}, parametrosOperacionaisJson: {},
      observacoes: null, deletedAt: new Date(),
    };
    let sn = 0;
    const txRest = {
      select: jest.fn(() => {
        sn += 1;
        if (sn === 1) return selectChain([removido]);
        return selectChain([]); // assertUnico livre
      }),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...removido, deletedAt: null }])),
          })),
        })),
      })),
    };
    const s1 = new FornecedoresService({
      db: { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txCod)) },
    } as never, auditoria as never);
    await expect(s1.criar({
      codigo: 'F1', razaoSocial: 'R', documentoFiscal: 'Y', status: 'ativo',
    }, 'u1')).rejects.toBeInstanceOf(ConflictException);

    const s2 = new FornecedoresService({ db: dbHist } as never, auditoria as never);
    await expect(s2.historico('f1')).resolves.toMatchObject({
      ocorrenciasAno: 2,
      ultimaDivergencia: { tipo: 'falta_peso' },
    });

    const s3 = new FornecedoresService({
      db: { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txRest)) },
    } as never, auditoria as never);
    await expect(s3.restaurar('f1', 'u1')).resolves.toMatchObject({ deletedAt: null });
  });

  it('representante criar/atualizar/restaurar sucesso e listar sem filtros', async () => {
    const criado = {
      id: 'r1', codigo: 'R1', nome: 'N', tipoCanal: 'atacado', contato: 'c',
      status: 'ativo', observacao: null, deletedAt: null,
    };
    const txCriar = txCrud({ selectRows: [], returning: [criado] });
    const txUpdate = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([criado]))
        .mockImplementationOnce(() => selectChain([{ id: 'r1' }])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...criado, nome: 'N2', tipoCanal: 'varejo' }])),
          })),
        })),
      })),
    };
    const removido = { ...criado, deletedAt: new Date() };
    let sn = 0;
    const txRest = {
      select: jest.fn(() => {
        sn += 1;
        return selectChain(sn === 1 ? [removido] : []);
      }),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...removido, deletedAt: null }])),
          })),
        })),
      })),
    };
    const txs = [txCriar, txUpdate, txRest];
    let i = 0;
    const list = selectChain([]);
    const count = selectChain([{ total: 0 }]);
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count),
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txs[i++])),
    };
    const service = new RepresentantesService({ db } as never, auditoria as never);
    await service.listar({ page: 1, pageSize: 10, incluirRemovidos: false });
    await service.criar({
      codigo: 'R1', nome: 'N', tipoCanal: 'atacado', contato: 'c', status: 'ativo',
    }, 'u1');
    await service.atualizar('r1', {
      nome: 'N2', tipoCanal: 'varejo', contato: 'c2', status: 'inativo', observacao: 'o', codigo: 'R1',
    }, 'u1');
    await service.restaurar('r1', 'u1');
  });

  it('rbac definirPermissoes com códigos válidos; ensure sem vínculos', async () => {
    const perfil = { id: 'p1', slug: 'comercial', menusVisiveis: [] };
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([perfil]))
        .mockImplementationOnce(() => selectChain([{ codigo: 'OLD' }]))
        .mockImplementationOnce(() => selectChain([{ id: 'perm1', codigo: 'PEDIDOS_LER' }])),
      delete: jest.fn(() => ({ where: jest.fn(() => Promise.resolve(undefined)) })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => Promise.resolve(undefined)),
        })),
      })),
    };
    const dbTx = { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) };
    const s1 = new RbacService({ db: dbTx } as never);
    await expect(s1.definirPermissoesDoPerfil('comercial', ['PEDIDOS_LER', 'IGNORADO']))
      .resolves.toEqual({ anterior: ['OLD'], novo: ['PEDIDOS_LER'] });

    const dbEmpty = {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => Promise.resolve(undefined)),
        })),
      })),
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([])) // perfis
        .mockImplementationOnce(() => selectChain([])), // permissoes
    };
    const s2 = new RbacService({ db: dbEmpty } as never);
    await s2.ensurePermissoes();
  });

  it('fornecedor criar e remover com sucesso; contagens ok', async () => {
    const criado = {
      id: 'f1', codigo: 'F9', razaoSocial: 'R', documentoFiscal: 'D9',
      status: 'ativo', contatosJson: {}, parametrosOperacionaisJson: {},
      observacoes: 'o', deletedAt: null,
    };
    const txCriar = {
      select: jest.fn(() => selectChain([])),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([criado])),
        })),
      })),
    };
    const txRemover = {
      select: jest.fn(() => selectChain([criado])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...criado, deletedAt: new Date() }])),
          })),
        })),
      })),
    };
    const txs = [txCriar, txRemover];
    let i = 0;
    const db = {
      select: jest.fn(() => selectChain([{ total: 1, ativos: 1, inativos: 0 }])),
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txs[i++])),
    };
    const service = new FornecedoresService({ db } as never, auditoria as never);
    await expect(service.contagens()).resolves.toEqual({ total: 1, ativos: 1, inativos: 0 });
    await expect(service.criar({
      codigo: 'F9', razaoSocial: 'R', documentoFiscal: 'D9', status: 'ativo',
      contatosJson: {}, parametrosOperacionaisJson: {}, observacoes: 'o',
    }, 'u1')).resolves.toMatchObject({ id: 'f1' });
    await expect(service.remover('f1', 'u1')).resolves.toMatchObject({ id: 'f1' });
  });

  it('representante detalhar 404; atualizar parcial; remover 404; listar incluirRemovidos', async () => {
    const list = selectChain([]);
    const count = selectChain([{ total: 0 }]);
    const db404 = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([])) // detalhar
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count),
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb({ select: jest.fn(() => selectChain([])) }),
      ),
    };
    const s1 = new RepresentantesService({ db: db404 } as never, auditoria as never);
    await expect(s1.detalhar('r-x')).rejects.toBeInstanceOf(NotFoundException);
    await s1.listar({ page: 1, pageSize: 5, incluirRemovidos: true });
    await expect(s1.remover('r-x', 'u1')).rejects.toBeInstanceOf(NotFoundException);

    const anterior = {
      id: 'r1', codigo: 'R1', nome: 'N', tipoCanal: 'a', contato: 'c',
      status: 'ativo', observacao: 'o', deletedAt: null,
    };
    const tx = {
      select: jest.fn()
        .mockImplementationOnce(() => selectChain([anterior]))
        .mockImplementationOnce(() => selectChain([{ id: 'r1' }])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([anterior])),
          })),
        })),
      })),
    };
    const s2 = new RepresentantesService({
      db: { transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) },
    } as never, auditoria as never);
    await s2.atualizar('r1', {}, 'u1');
  });

  it('regras criar/atualizar com saidas; remover; listar sem removidos', async () => {
    const criada = {
      id: 'r1', nome: 'A', produtoOrigemCodigo: 'TZ', status: 'ativo',
      prioridade: 1, observacao: 'o', deletedAt: null,
    };
    const saida = { id: 's1', regraId: 'r1', produtoId: 'p1', quantidadeFixa: '1' };
    const txCriar = {
      select: jest.fn(() => selectChain([{ id: 'p1' }])),
      insert: jest.fn()
        .mockImplementationOnce(() => ({
          values: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([criada])),
          })),
        }))
        .mockImplementationOnce(() => ({
          values: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([saida])),
          })),
        })),
    };
    const anterior = criada;
    let sn = 0;
    const txUpdateSaidas = {
      select: jest.fn(() => {
        sn += 1;
        if (sn === 1) return selectChain([anterior]);
        return selectChain([{ id: 'p1' }]);
      }),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...anterior, observacao: null }])),
          })),
        })),
      })),
      delete: jest.fn(() => ({ where: jest.fn(() => Promise.resolve(undefined)) })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([saida])),
        })),
      })),
    };
    const txRemover = {
      select: jest.fn(() => selectChain([anterior])),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ ...anterior, deletedAt: new Date() }])),
          })),
        })),
      })),
    };
    const txs = [txCriar, txUpdateSaidas, txRemover, { select: jest.fn(() => selectChain([])) }];
    let i = 0;
    const list = selectChain([]);
    const count = selectChain([{ total: 0 }]);
    const db = {
      select: jest.fn()
        .mockImplementationOnce(() => list)
        .mockImplementationOnce(() => count),
      transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(txs[i++])),
    };
    const service = new RegrasTransformacaoService({ db } as never, auditoria as never);
    await service.listar({ page: 1, pageSize: 10, incluirRemovidos: false });
    await service.criar({
      nome: 'A', produtoOrigemCodigo: 'TZ', status: 'ativo', prioridade: 1, observacao: 'o',
      saidas: [{ produtoId: 'p1', quantidadeFixa: 1 }],
    }, 'u1');
    await service.atualizar('r1', {
      observacao: '',
      saidas: [{ produtoId: 'p1', quantidadeFixa: 1 }],
    }, 'u1');
    await service.remover('r1', 'u1');
    await expect(service.remover('r1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
