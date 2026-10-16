import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CfopsService } from '../../src/modules/erp/fiscal/enquadramentos/cfops.service';
import { NcmsService } from '../../src/modules/erp/fiscal/enquadramentos/ncms.service';

const JUSTIFICATIVA = 'Cadastro de código fiscal';

function filaSelect(resultados: unknown[][]) {
  let indice = 0;
  return jest.fn(() => {
    const linhas = resultados[indice++] ?? [];
    const elo: Record<string, unknown> = {};
    const voltar = () => elo;
    for (const metodo of ['from', 'where', 'orderBy', 'limit', 'offset']) elo[metodo] = voltar;
    elo.then = (ok: (valor: unknown) => unknown, falha?: (erro: unknown) => unknown) =>
      Promise.resolve(linhas).then(ok, falha);
    return elo;
  });
}

function erroUnico(constraint: string) {
  return Object.assign(new Error('dup'), { code: '23505', constraint });
}

describe.each([
  [CfopsService, 'uq_cfops_codigo', 'CFOP_DUPLICADO', 'Falha ao gravar CFOP'],
  [NcmsService, 'uq_ncms_codigo', 'NCM_DUPLICADO', 'Falha ao gravar NCM'],
] as const)('catálogo fiscal — ramos', (Servico, constraint, codigoDup, msgVazio) => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const eventos = { emit: jest.fn() } as unknown as EventEmitter2;

  function servico(db: object) {
    return new Servico({ db } as never, auditoria as never, eventos);
  }

  it('lista com e sem busca, inclusive total ausente', async () => {
    const semBusca = servico({ select: filaSelect([[], []]) });
    const vazio = await semBusca.listar({ page: 1, pageSize: 20 });
    expect(vazio.total).toBe(0);
    expect(vazio.data).toEqual([]);

    const comBusca = servico({
      select: filaSelect([[{ total: 1 }], [{ id: 'c1', codigo: '5102', descricao: 'Venda' }]]),
    });
    const achou = await comBusca.listar({ search: ' %_51 ', page: 1, pageSize: 10 });
    expect(achou.total).toBe(1);
    expect(achou.data[0]).toEqual(expect.objectContaining({ codigo: '5102' }));
  });

  it('criar sem linha, duplicado e erro genérico', async () => {
    const semLinha = servico({
      transaction: async (fn: (tx: object) => Promise<unknown>) => fn({
        insert: () => ({ values: () => ({ returning: async () => [] }) }),
      }),
    });
    await expect(semLinha.criar({ codigo: '5102', descricao: 'Venda', justificativa: JUSTIFICATIVA }, 'u1'))
      .rejects.toThrow(msgVazio);

    const duplicado = servico({
      transaction: async () => {
        throw erroUnico(constraint);
      },
    });
    await expect(duplicado.criar({ codigo: '5102', descricao: 'Venda', justificativa: JUSTIFICATIVA }, 'u1'))
      .rejects.toBeInstanceOf(ConflictException);

    const outro = servico({
      transaction: async () => {
        throw Object.assign(new Error('boom'), { code: '23503' });
      },
    });
    await expect(outro.criar({ codigo: '5102', descricao: 'Venda', justificativa: JUSTIFICATIVA }, 'u1'))
      .rejects.toThrow('boom');
    expect(codigoDup).toBe(constraint === 'uq_cfops_codigo' ? 'CFOP_DUPLICADO' : 'NCM_DUPLICADO');
  });
});
