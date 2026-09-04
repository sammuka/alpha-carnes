import { EstoqueConsultaService } from '../../src/modules/operacao/estoque/estoque-consulta.service';
import {
  clientes,
  entradasItens,
  fornecedores,
  produtos,
  notasFiscaisFornecedor,
  parametros,
  pecas,
  pedidosVenda,
  produtos,
  recebimentos,
  subitens,
} from '../../src/database/schema';

/**
 * Mock de `db.select().from(tabela)...` roteado por identidade da tabela (não por
 * ordem de chamada): robusto a `Promise.all` executar os `.from()` fora de ordem.
 * Todo verbo de chain (`where/innerJoin/leftJoin/orderBy/limit`) devolve a própria
 * chain e ela é thenable, resolvendo para as linhas cadastradas daquela tabela.
 */
function makeDb(porTabela: Map<unknown, unknown[]>) {
  function chain(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
    const self: Record<string, unknown> & PromiseLike<unknown[]> = {
      where: () => self,
      innerJoin: () => self,
      leftJoin: () => self,
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

describe('EstoqueConsultaService (D8.2/D8.3)', () => {
  const createdAtHoje = new Date();
  createdAtHoje.setHours(10, 0, 0, 0);
  const createdAtOntem = new Date(createdAtHoje);
  createdAtOntem.setDate(createdAtOntem.getDate() - 1);

  it('mapeia status de peça/subitem/entrada para os rótulos do protótipo (D8.2)', async () => {
    const porTabela = new Map<unknown, unknown[]>([
      [pecas, [
        { id: 'peca-sobra', statusFisico: 'em_sobra', peso: '10.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: null, capturaMeta: {}, createdAt: createdAtHoje },
        { id: 'peca-assoc', statusFisico: 'associada', peso: '10.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: 'pv1', capturaMeta: {}, createdAt: createdAtHoje },
        { id: 'peca-transf', statusFisico: 'em_transformacao', peso: '10.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: null, capturaMeta: {}, createdAt: createdAtHoje },
        { id: 'peca-analise', statusFisico: 'em_analise', peso: '10.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: null, capturaMeta: {}, createdAt: createdAtHoje },
      ]],
      [subitens, [
        { id: 'sub-sobra', statusFisico: 'em_sobra', peso: '2.000', quantidade: '1', etiquetaAtual: null, produtoId: 'ic2', pecaOrigemId: 'peca-sobra', pedidoVendaId: null, createdAt: createdAtHoje },
        { id: 'sub-assoc', statusFisico: 'associado', peso: '2.000', quantidade: '1', etiquetaAtual: null, produtoId: 'ic2', pecaOrigemId: 'peca-sobra', pedidoVendaId: 'pv1', createdAt: createdAtHoje },
        { id: 'sub-analise', statusFisico: 'em_analise', peso: '2.000', quantidade: '1', etiquetaAtual: null, produtoId: 'ic2', pecaOrigemId: 'peca-sobra', pedidoVendaId: null, createdAt: createdAtHoje },
      ]],
      [entradasItens, [
        { id: 'ent-sobra', quantidade: 10, quantidadeDestinada: 0, unidade: 'caixa', produtoId: 'prod1', fornecedorNome: 'Forn', loteNf: null, local: 'Câmara 1', destino: 'estoque', pedidoId: null, createdAt: createdAtHoje },
        { id: 'ent-destino', quantidade: 5, quantidadeDestinada: 2, unidade: 'caixa', produtoId: 'prod1', fornecedorNome: 'Forn', loteNf: null, local: 'Câmara 1', destino: 'pedido', pedidoId: 'pv1', createdAt: createdAtHoje },
      ]],
      [produtos, []],
      [produtos, []],
      [recebimentos, []],
      [pedidosVenda, []],
      [parametros, [{ valorJson: { valor: false } }]],
    ]);

    const service = new EstoqueConsultaService({ db: makeDb(porTabela) } as never);
    const itens = await service.consultar({});
    const porId = new Map(itens.map((i) => [i.id, i]));

    expect(porId.get('peca-sobra')?.statusRotulo).toBe('Disponível');
    expect(porId.get('peca-assoc')?.statusRotulo).toBe('Destinado a pedido');
    expect(porId.get('peca-transf')?.statusRotulo).toBe('Em desossa');
    expect(porId.get('peca-analise')?.statusRotulo).toBe('Bloqueado por ocorrência');
    expect(porId.get('sub-sobra')?.statusRotulo).toBe('Disponível');
    expect(porId.get('sub-assoc')?.statusRotulo).toBe('Destinado a pedido');
    expect(porId.get('sub-analise')?.statusRotulo).toBe('Bloqueado por ocorrência');
    expect(porId.get('ent-sobra')?.statusRotulo).toBe('Disponível');
    expect(porId.get('ent-destino')?.statusRotulo).toBe('Destinado a pedido');
  });

  it('ordena createdAt ASC quando operacao.fifo_estoque=true (D8.3)', async () => {
    const porTabela = new Map<unknown, unknown[]>([
      [pecas, [
        { id: 'peca-novo', statusFisico: 'em_sobra', peso: '10.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: null, capturaMeta: {}, createdAt: createdAtHoje },
        { id: 'peca-antigo', statusFisico: 'em_sobra', peso: '10.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: null, capturaMeta: {}, createdAt: createdAtOntem },
      ]],
      [subitens, []],
      [entradasItens, []],
      [produtos, []],
      [produtos, []],
      [recebimentos, []],
      [pedidosVenda, []],
      [parametros, [{ valorJson: { valor: true } }]],
    ]);

    const service = new EstoqueConsultaService({ db: makeDb(porTabela) } as never);
    const itens = await service.consultar({});
    expect(itens.map((i) => i.id)).toEqual(['peca-antigo', 'peca-novo']);
    expect(itens.find((i) => i.id === 'peca-antigo')?.estoqueAnterior).toBe(true);
  });

  it('ordena createdAt DESC quando operacao.fifo_estoque=false (D8.3)', async () => {
    const porTabela = new Map<unknown, unknown[]>([
      [pecas, [
        { id: 'peca-novo', statusFisico: 'em_sobra', peso: '10.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: null, capturaMeta: {}, createdAt: createdAtHoje },
        { id: 'peca-antigo', statusFisico: 'em_sobra', peso: '10.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: null, capturaMeta: {}, createdAt: createdAtOntem },
      ]],
      [subitens, []],
      [entradasItens, []],
      [produtos, []],
      [produtos, []],
      [recebimentos, []],
      [pedidosVenda, []],
      [parametros, [{ valorJson: { valor: false } }]],
    ]);

    const service = new EstoqueConsultaService({ db: makeDb(porTabela) } as never);
    const itens = await service.consultar({});
    expect(itens.map((i) => i.id)).toEqual(['peca-novo', 'peca-antigo']);
  });

  it('trata ausência do parâmetro fifo (parametros vazio) como DESC (default seguro)', async () => {
    const porTabela = new Map<unknown, unknown[]>([
      [pecas, [
        { id: 'p1', statusFisico: 'em_sobra', peso: '1.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: null, capturaMeta: {}, createdAt: createdAtHoje },
        { id: 'p2', statusFisico: 'em_sobra', peso: '1.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: null, capturaMeta: {}, createdAt: createdAtOntem },
      ]],
      [subitens, []], [entradasItens, []], [produtos, []], [produtos, []],
      [recebimentos, []], [pedidosVenda, []], [parametros, []],
    ]);

    const service = new EstoqueConsultaService({ db: makeDb(porTabela) } as never);
    const itens = await service.consultar({});
    expect(itens.map((i) => i.id)).toEqual(['p1', 'p2']);
  });

  it('filtro produtoId/search/status restringe o resultado', async () => {
    const porTabela = new Map<unknown, unknown[]>([
      [pecas, [
        { id: 'p1', statusFisico: 'em_sobra', peso: '10.000', etiquetaAtual: 'TZ-000001', produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: null, capturaMeta: {}, createdAt: createdAtHoje },
        { id: 'p2', statusFisico: 'associada', peso: '10.000', etiquetaAtual: 'TZ-000002', produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: 'pv1', capturaMeta: {}, createdAt: createdAtHoje },
      ]],
      [subitens, []], [entradasItens, []], [produtos, []],
      [produtos, [{ produtoId: 'ic1', id: 'prod-tz', codigo: 'TZ', nome: 'Traseiro' }]],
      [recebimentos, []], [pedidosVenda, []], [parametros, [{ valorJson: { valor: false } }]],
    ]);

    const service = new EstoqueConsultaService({ db: makeDb(porTabela) } as never);

    const porProduto = await service.consultar({ produtoId: 'prod-tz' });
    expect(porProduto.map((i) => i.id).sort()).toEqual(['p1', 'p2']);

    const porStatus = await service.consultar({ status: 'disponivel' });
    expect(porStatus.map((i) => i.id)).toEqual(['p1']);

    const porBusca = await service.consultar({ search: 'TZ-000002' });
    expect(porBusca.map((i) => i.id)).toEqual(['p2']);
  });

  it('retorna lista vazia quando não há peças, subitens nem entradas', async () => {
    const porTabela = new Map<unknown, unknown[]>([
      [pecas, []], [subitens, []], [entradasItens, []], [produtos, []],
      [produtos, []], [recebimentos, []], [pedidosVenda, []], [parametros, []],
    ]);
    const service = new EstoqueConsultaService({ db: makeDb(porTabela) } as never);
    await expect(service.consultar({})).resolves.toEqual([]);
  });

  it('origem/NF de peça vêm do join recebimentos+fornecedores+NF (D8.2)', async () => {
    const porTabela = new Map<unknown, unknown[]>([
      [pecas, [
        { id: 'p1', statusFisico: 'em_sobra', peso: '10.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: null, capturaMeta: {}, createdAt: createdAtHoje },
      ]],
      [subitens, []], [entradasItens, []], [produtos, []], [produtos, []],
      [recebimentos, [{ id: 'r1', fornecedorNome: 'Frigorífico Boi Forte', romaneio: 'ROM-1', nfNumero: '128934' }]],
      [pedidosVenda, []], [parametros, []],
    ]);
    const service = new EstoqueConsultaService({ db: makeDb(porTabela) } as never);
    const [item] = await service.consultar({});
    expect(item?.origem).toBe('Frigorífico Boi Forte');
    expect(item?.nfLote).toBe('ROM-1 / NF 128934');
  });

  it('pedidoReservado vem do join pedidosVenda+clientes (nomeFantasia com fallback razaoSocial)', async () => {
    const porTabela = new Map<unknown, unknown[]>([
      [pecas, [
        { id: 'p1', statusFisico: 'associada', peso: '10.000', etiquetaAtual: null, produtoId: 'ic1', recebimentoId: 'r1', pedidoVendaId: 'pv1', capturaMeta: {}, createdAt: createdAtHoje },
      ]],
      [subitens, []], [entradasItens, []], [produtos, []], [produtos, []], [recebimentos, []],
      [pedidosVenda, [{ id: 'pv1', clienteNome: 'Açougue Nova Era' }]],
      [parametros, []],
    ]);
    const service = new EstoqueConsultaService({ db: makeDb(porTabela) } as never);
    const [item] = await service.consultar({});
    expect(item?.pedidoReservado).toBe(`#${'pv1'.slice(0, 8)} — Açougue Nova Era`);
  });
});
