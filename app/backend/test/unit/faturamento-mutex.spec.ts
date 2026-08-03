import { EventEmitter2 } from '@nestjs/event-emitter';
import { FaturamentoService } from '../../src/modules/operacao/faturamento/faturamento.service';
import { faturamentos, caminhoes, pedidosVenda, parametros } from '../../src/database/schema';
import type { NfseGateway } from '../../src/integracoes/nfse/nfse.types';

/**
 * Mock de DB roteado por tabela (`.from(tabela)`), não por ordem de chamada —
 * necessário porque o teste dispara 2 emissões concorrentes (`Promise.all`) e a
 * ordem real dos `select()`s entre as duas execuções não é determinística.
 */
function makeDbRoteadoPorTabela() {
  const cliente = {
    id: 'cli-1', razaoSocial: 'Cliente Teste', documentoFiscal: '12345678000190',
    dadosFiscaisJson: {}, dadosContatoJson: {},
  };
  return {
    select: jest.fn(() => {
      const chain = {
        from: (tabela: unknown) => {
          if (tabela === faturamentos) {
            return { where: () => ({ then: (r: (v: unknown[]) => unknown) => r([{ id: 'fat-1', caminhaoId: 'cam-1', deletedAt: null }]) }) };
          }
          if (tabela === caminhoes) {
            return { where: () => ({ then: (r: (v: unknown[]) => unknown) => r([{ id: 'cam-1', statusCaminhao: 'fechado', operacaoId: 'op-1', deletedAt: null }]) }) };
          }
          if (tabela === pedidosVenda) {
            return {
              innerJoin: () => ({
                where: () => ({ then: (r: (v: unknown[]) => unknown) => r([{ pedido: {}, cliente }]) }),
              }),
            };
          }
          if (tabela === parametros) {
            return { where: () => ({ then: (r: (v: unknown[]) => unknown) => r([]) }) };
          }
          // fallback: operacoes (dataOperacaoDoCaminhao) — sem linha, dataOperacao vazia
          return { where: () => ({ then: (r: (v: unknown[]) => unknown) => r([]) }) };
        },
      };
      return chain;
    }),
    transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      insert: () => ({
        values: (v: Record<string, unknown>) => ({
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve([{ id: `nf-${v['pedidoVendaId']}`, ...v }]),
          }),
        }),
      }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: 'nf-x', statusNfse: 'emitida' }]) }) }) }),
    })),
  };
}

describe('FaturamentoService — mutex de emissão (D10.3)', () => {
  it('DoD 10.4 emissoes concorrentes serializam', async () => {
    const ordem: string[] = [];
    const gatewayLento: Partial<NfseGateway> = {
      emitir: jest.fn(async (req) => {
        ordem.push(`inicio:${req.identificador}`);
        await new Promise((r) => setTimeout(r, 20));
        ordem.push(`fim:${req.identificador}`);
        return { erro: false, numeroNota: '1', raw: {} };
      }),
    };
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const emitter = new EventEmitter2();
    jest.spyOn(emitter, 'emit').mockReturnValue(true);
    const consolidacaoService = {
      consolidar: jest.fn().mockResolvedValue({ bloqueios: [], totalItens: 1, pedidos: [] }),
    };
    const liberacaoService = { sincronizarPosEmissao: jest.fn().mockResolvedValue(undefined) };

    const db = makeDbRoteadoPorTabela();
    const service = new FaturamentoService(
      { db } as never, gatewayLento as never, auditoria as never, emitter,
      consolidacaoService as never, liberacaoService as never,
    );

    await Promise.all([
      service.emitir('cam-1', { pedidoVendaId: 'A', valor: '10.00' } as never, 'user-1'),
      service.emitir('cam-1', { pedidoVendaId: 'B', valor: '10.00' } as never, 'user-1'),
    ]);

    // Nunca "inicio:B" antes de "fim:A" (ou vice-versa) — serialização garantida pelo mutex.
    const primeiraLetra = ordem[0]!.split(':')[1];
    expect(ordem).toEqual([`inicio:${primeiraLetra}`, `fim:${primeiraLetra}`, expect.stringContaining('inicio:'), expect.stringContaining('fim:')]);
    expect(ordem[2]).not.toBe(`inicio:${primeiraLetra}`);
  });
});
