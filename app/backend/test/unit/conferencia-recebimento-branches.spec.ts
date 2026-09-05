import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConferenciaService } from '../../src/modules/operacao/recebimento/conferencia.service';

function chain(rows: unknown[]) {
  const obj: Record<string, unknown> = {
    from: () => obj,
    innerJoin: () => obj,
    where: () => obj,
    then: (resolve: (r: unknown[]) => unknown) => resolve(rows),
  };
  return obj;
}

describe('ConferenciaService (recebimento) — branches', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const emitter = new EventEmitter2();
  jest.spyOn(emitter, 'emit').mockReturnValue(true);
  const ocorrencias = { abrirNaTx: jest.fn(), emitirAbertura: jest.fn() };

  function makeService(db: Record<string, unknown>) {
    return new ConferenciaService({ db } as never, auditoria as never, emitter, ocorrencias as never);
  }

  beforeEach(() => jest.clearAllMocks());

  it('calcularQuadro → aplica fallback de quantidades nulas e classifica divergência de peso', async () => {
    const rows = [
      {
        recebimento_item_id: 'ri1',
        produto_id: 'ic1',
        previsto_no_pedido: true,
        qtd_pedido: '5.000',
        qtd_nf: null,
        qtd_apurada: null,
        peso_nf: '10.000',
        peso_apurado: '9.000',
      },
    ];
    const db = { execute: jest.fn().mockResolvedValue({ rows }) };
    const service = makeService(db);
    const result = await service.calcularQuadro(db as never, 'r1');
    expect(result[0]?.qtdNf).toBe('0');
    expect(result[0]?.qtdApurada).toBe('0');
    expect(result[0]?.situacao).toBe('divergente');
  });

  it('concluirPesagem → lança 404 se recebimento não encontrado', async () => {
    const tx = { select: jest.fn(() => chain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.concluirPesagem('r-x', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('concluirPesagem → lança 409 se não está em pesagem', async () => {
    const atual = { id: 'r1', status: 'aguardando_conferencia_final', deletedAt: null };
    const tx = { select: jest.fn(() => chain([atual])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(service.concluirPesagem('r1', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('concluirPesagem → sucesso avança para aguardando_conferencia_final', async () => {
    const atual = { id: 'r1', status: 'pesagem_em_andamento', deletedAt: null };
    const atualizado = { id: 'r1', status: 'aguardando_conferencia_final' };
    const tx = {
      select: jest.fn(() => chain([atual])),
      update: jest.fn(() => ({
        set: () => ({ where: () => ({ returning: jest.fn(async () => [atualizado]) }) }),
      })),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    const result = await service.concluirPesagem('r1', 'u1');
    expect(result).toEqual(atualizado);
  });

  it('concluirConferencia → lança 404 se recebimento não encontrado', async () => {
    const tx = { select: jest.fn(() => chain([])) };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(
      service.concluirConferencia('r-x', { resultado: 'sem_divergencia' } as never, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('concluirConferencia → lança 409 se não há NF do fornecedor', async () => {
    const atual = { id: 'r1', status: 'aguardando_conferencia_final', deletedAt: null };
    let call = 0;
    const tx = {
      select: jest.fn(() => {
        call++;
        if (call === 1) return chain([atual]);
        return chain([]);
      }),
    };
    const db = { transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const service = makeService(db);
    await expect(
      service.concluirConferencia('r1', { resultado: 'sem_divergencia' } as never, 'u1'),
    ).rejects.toThrow('NF do fornecedor obrigatória');
  });
});
