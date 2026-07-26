import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PedidosService } from '../../src/modules/comercial/pedidos/pedidos.service';
import { EVENTOS } from '../../src/realtime/events/eventos';

function fontesDoModulo(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return fontesDoModulo(caminho);
    return nome.endsWith('.ts') ? [caminho] : [];
  });
}

// DoD-83 — AD-06 é liberação administrativa explícita; não pode voltar TTL/job de expiração.
describe('PedidosService — AD-06 sem expiracao automatica', () => {
  it('nao existe expiracao automatica de reserva de rascunho', () => {
    const raiz = join(__dirname, '../../src/modules/comercial');
    const suspeitos = fontesDoModulo(raiz).filter((f) =>
      /@Cron|SchedulerRegistry|setTimeout\(|setInterval\(|expiraEm|ttlReserva/
        .test(readFileSync(f, 'utf8')));
    expect(suspeitos).toEqual([]);
  });
});

// Verifica a ordem commit→emit (RA-04/ADR-004): o evento só sai DEPOIS que a
// Promise de db.transaction resolve, e NÃO sai se a transação rejeita.
describe('PedidosService — emissão de evento pós-commit', () => {
  function montar(transactionImpl: (cb: unknown) => Promise<unknown>) {
    const ordem: string[] = [];
    const emitter = new EventEmitter2();
    const emitSpy = jest.spyOn(emitter, 'emit').mockImplementation(((event: unknown) => {
      ordem.push(`emit:${String(event)}`);
      return true;
    }) as never);
    const db = {
      transaction: jest.fn(async (cb: unknown) => {
        const r = await transactionImpl(cb);
        ordem.push('commit');
        return r;
      }),
    };
    const auditoria = { registrar: jest.fn() };
    const service = new PedidosService(
      { db } as never,
      auditoria as never,
      emitter,
      {} as never,
    );
    return { service, emitSpy, ordem };
  }

  it('emite reserva_disponibilidade_atualizada APÓS o commit', async () => {
    const { service, emitSpy, ordem } = montar(async () => ({
      pedido: { id: 'p1', dataOperacao: '2026-06-06' },
      eventos: [
        {
          nome: EVENTOS.RESERVA_ATUALIZADA,
          payload: {
            disponibilidadeId: 'd1',
            itemComercialId: 'i1',
            quantidadeReservada: '4.000',
            quantidadeDisponivel: '0.000',
            dataOperacao: '2026-06-06',
          },
        },
      ],
    }));

    await service.criar({ itens: [] } as never, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.RESERVA_ATUALIZADA,
      expect.objectContaining({ disponibilidadeId: 'd1', dataOperacao: '2026-06-06' }),
    );
    expect(ordem.indexOf('commit')).toBeLessThan(ordem.indexOf(`emit:${EVENTOS.RESERVA_ATUALIZADA}`));
  });

  it('NÃO emite quando a transação rejeita (rollback)', async () => {
    const { service, emitSpy } = montar(async () => {
      throw new Error('falha simulada na tx');
    });

    await expect(service.criar({ itens: [] } as never, 'user-1')).rejects.toThrow('falha simulada');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('emite overbooking_confirmado quando há pendência', async () => {
    const { service, emitSpy } = montar(async () => ({
      pedido: { id: 'p2' },
      eventos: [
        {
          nome: EVENTOS.OVERBOOKING_CONFIRMADO,
          payload: { pedidoVendaId: 'p2', itemId: 'pi1', quantidadeOverbooking: '3.000' },
        },
      ],
    }));

    await service.criar({ itens: [] } as never, 'user-1');

    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.OVERBOOKING_CONFIRMADO,
      expect.objectContaining({ pedidoVendaId: 'p2' }),
    );
  });
});

describe('PedidosService — branches de conflito', () => {
  const auditoria = { registrar: jest.fn() };
  const emitter = new EventEmitter2();

  function service(db: object) {
    return new PedidosService({ db } as never, auditoria as never, emitter, {} as never);
  }

  it('incluirItem mapeia unique violation para 409 de item duplicado', async () => {
    const db = {
      transaction: jest.fn(async () => {
        throw Object.assign(new Error('dup'), {
          code: '23505',
          constraint: 'uq_pedido_venda_item_comercial_ativo',
        });
      }),
    };
    await expect(service(db).incluirItem('p1', {
      itemComercialId: 'i1', quantidade: 1,
    } as never, 'user-1')).rejects.toThrow('Item comercial já existe neste pedido');
  });

  it('incluirItem propaga erro que não é duplicidade', async () => {
    const db = {
      transaction: jest.fn(async () => {
        throw new Error('falha genérica');
      }),
    };
    await expect(service(db).incluirItem('p1', {
      itemComercialId: 'i1', quantidade: 1,
    } as never, 'user-1')).rejects.toThrow('falha genérica');
  });

  it('planejarSobLock rejeita item comercial duplicado no payload', async () => {
    const tx = { execute: jest.fn() };
    await expect(service({}).planejarSobLock(tx as never, 'op-1', [
      { itemComercialId: 'i1', quantidade: '1' },
      { itemComercialId: 'i1', quantidade: '2' },
    ] as never)).rejects.toThrow('item comercial duplicado');
  });

  it('planejarSobLock sem operacaoId retorna déficit total', async () => {
    const plano = await service({}).planejarSobLock({} as never, null, [
      { itemComercialId: 'i1', quantidade: '3.000' },
    ] as never);
    expect(plano).toHaveLength(1);
    expect(plano[0]?.deficit).toBe('3.000');
    expect(plano[0]?.coberturas).toEqual([]);
  });
});
