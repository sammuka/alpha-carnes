import { NotFoundException } from '@nestjs/common';
import { NotasConsultaService } from '../../src/modules/operacao/faturamento/notas-consulta.service';
import {
  notasFiscais, caminhoes, clientes, pedidosVenda, cargaItens, pecas, subitens, produtos,
} from '../../src/database/schema';

/**
 * Mock de `db.select().from(tabela)...` roteado por identidade da tabela — robusto a
 * `Promise.all` executar os `.from()` fora de ordem (mesmo padrão de estoque-consulta.service.spec.ts).
 */
function makeDb(porTabela: Map<unknown, unknown[]>) {
  function chain(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
    const self: Record<string, unknown> & PromiseLike<unknown[]> = {
      where: () => self,
      innerJoin: () => self,
      orderBy: () => self,
      limit: () => self,
      offset: () => self,
      then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
    } as never;
    return self;
  }
  return {
    select: () => ({
      from: (tabela: unknown) => chain(porTabela.get(tabela) ?? []),
    }),
  };
}

describe('NotasConsultaService — listar (D10.8)', () => {
  const clienteRow = { id: 'cli-1', razaoSocial: 'Cliente RS', nomeFantasia: 'Fantasia X' };
  const clienteSemFantasia = { id: 'cli-2', razaoSocial: 'Cliente Sem Fantasia', nomeFantasia: null };
  const caminhaoLiberado = { id: 'cam-1', statusCaminhao: 'liberado_saida' };
  const caminhaoEmCarga = { id: 'cam-2', statusCaminhao: 'em_carga' };
  const caminhaoExpedido = { id: 'cam-3', statusCaminhao: 'expedido' };
  const nota1 = {
    id: 'nf-1', clienteId: 'cli-1', caminhaoId: 'cam-1', deletedAt: null, statusNfse: 'emitida', createdAt: new Date(),
  };
  const nota2 = {
    id: 'nf-2', clienteId: 'cli-2', caminhaoId: 'cam-2', deletedAt: null, statusNfse: 'pendente', createdAt: new Date(),
  };
  const nota3 = {
    id: 'nf-3', clienteId: 'cli-1', caminhaoId: 'cam-3', deletedAt: null, statusNfse: 'emitida', createdAt: new Date(),
  };

  it('sem filtros → total default 0 quando totalRow vazio', async () => {
    const db = makeDb(new Map<unknown, unknown[]>([[notasFiscais, []], [clientes, []], [caminhoes, []]]));
    const service = new NotasConsultaService({ db } as never);
    const resultado = await service.listar({ page: 1, pageSize: 20 } as never);
    expect(resultado.total).toBe(0);
    expect(resultado.data).toEqual([]);
  });

  it('filtro status → aplica condição e marca caminhaoLiberado=true para liberado_saida', async () => {
    // Join simulado manualmente: listar() não expande innerJoin real no mock, então
    // simulamos a linha combinada via override de `then` no primeiro select (linhas).
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: () => ({
                      offset: () => Promise.resolve([{ nota: nota1, cliente: clienteRow, caminhao: caminhaoLiberado }]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({ where: () => Promise.resolve([{ total: 1 }]) }),
          }),
        }),
    };
    const service = new NotasConsultaService({ db } as never);
    const resultado = await service.listar({ page: 1, pageSize: 20, status: 'emitida' } as never);
    expect(resultado.total).toBe(1);
    expect(resultado.data[0]).toMatchObject({ id: 'nf-1', clienteNome: 'Fantasia X', caminhaoLiberado: true });
  });

  it('filtro caminhaoId + clienteId + busca → caminhaoLiberado=false para em_carga e clienteNome cai para razaoSocial sem fantasia', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: () => ({
                      offset: () => Promise.resolve([{ nota: nota2, cliente: clienteSemFantasia, caminhao: caminhaoEmCarga }]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({ where: () => Promise.resolve([{ total: 1 }]) }),
          }),
        }),
    };
    const service = new NotasConsultaService({ db } as never);
    const resultado = await service.listar({
      page: 1, pageSize: 20, caminhaoId: 'cam-2', clienteId: 'cli-2', busca: 'termo',
    } as never);
    expect(resultado.data[0]).toMatchObject({ id: 'nf-2', clienteNome: 'Cliente Sem Fantasia', caminhaoLiberado: false });
  });

  it('caminhão expedido → caminhaoLiberado=true (trava visual — NotasXml.tsx:485-497)', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: () => ({
                      offset: () => Promise.resolve([{ nota: nota3, cliente: clienteRow, caminhao: caminhaoExpedido }]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({ where: () => Promise.resolve([{ total: 1 }]) }),
          }),
        }),
    };
    const service = new NotasConsultaService({ db } as never);
    const resultado = await service.listar({ page: 1, pageSize: 20 } as never);
    expect(resultado.data[0]).toMatchObject({ caminhaoLiberado: true });
  });
});

describe('NotasConsultaService — rastreabilidade (D10.7)', () => {
  it('nota inexistente → NotFoundException', async () => {
    const db = makeDb(new Map([[notasFiscais, []]]));
    const service = new NotasConsultaService({ db } as never);
    await expect(service.rastreabilidade('nf-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pedido não encontrado (pedido excluído/inconsistente) → pedido null e pesoTotalKg "0.000" sem itens', async () => {
    const nota = { id: 'nf-1', pedidoVendaId: 'pv-1', caminhaoId: 'cam-1', deletedAt: null };
    const db = makeDb(new Map<unknown, unknown[]>([
      [notasFiscais, [nota]],
      [pedidosVenda, []],
      [cargaItens, []],
    ]));
    const service = new NotasConsultaService({ db } as never);
    const resultado = await service.rastreabilidade('nf-1');
    expect(resultado.pedido).toBeNull();
    expect(resultado.pecas).toEqual([]);
    expect(resultado.pesoTotalKg).toBe('0.000');
  });

  it('pedido encontrado, sem nomeFantasia → usa razaoSocial; agrega peças + subitens e soma pesoTotalKg', async () => {
    const nota = { id: 'nf-1', pedidoVendaId: 'pv-1', caminhaoId: 'cam-1', deletedAt: null };
    const pedidoRow = {
      pedido: { id: 'pv-1' },
      cliente: { id: 'cli-1', razaoSocial: 'Cliente RS', nomeFantasia: null },
    };
    const itemPeca = { etiqueta: 'ETQ-1', produtoNome: 'Traseiro', peso: '10.500' };
    const itemSubitem = { etiqueta: 'ETQ-2', produtoNome: 'Costela', peso: '5.250' };

    let call = 0;
    const cargaItensResults = [[itemPeca], [itemSubitem]];
    const db = {
      select: jest.fn((..._args: unknown[]) => ({
        from: (tabela: unknown) => {
          if (tabela === notasFiscais) return { where: () => Promise.resolve([nota]) };
          if (tabela === pedidosVenda) {
            return { innerJoin: () => ({ where: () => Promise.resolve([pedidoRow]) }) };
          }
          if (tabela === cargaItens) {
            return {
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => Promise.resolve(cargaItensResults[call++] ?? []),
                }),
              }),
            };
          }
          return { where: () => Promise.resolve([]) };
        },
      })),
    };
    const service = new NotasConsultaService({ db } as never);
    const resultado = await service.rastreabilidade('nf-1');
    expect(resultado.pedido).toMatchObject({ id: 'pv-1', clienteNome: 'Cliente RS' });
    expect(resultado.pecas).toEqual([itemPeca, itemSubitem]);
    expect(resultado.pesoTotalKg).toBe('15.750');
  });
});
