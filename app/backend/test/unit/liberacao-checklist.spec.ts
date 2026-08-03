import { LiberacaoChecklistService } from '../../src/modules/operacao/faturamento/liberacao-checklist.service';

const caminhaoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type Chain = {
  from: (...a: unknown[]) => Chain;
  where: (...a: unknown[]) => Chain;
  then: (cb: (r: unknown[]) => unknown) => unknown;
};

function selectChain(rows: unknown[]): Chain {
  const terminal: Chain = {
    from: () => terminal,
    where: () => terminal,
    then: (cb) => cb(rows),
  };
  return terminal;
}

/** `responses[i]` = linhas devolvidas pela i-ésima chamada a `db.select()` dentro de `calcular()`. */
function makeService(responses: unknown[][]): LiberacaoChecklistService {
  let idx = 0;
  const db = { select: jest.fn(() => selectChain(responses[idx++] ?? [])) };
  return new LiberacaoChecklistService({ db } as never);
}

describe('LiberacaoChecklistService (D10.6)', () => {
  it('reprova cargaConferida quando status ainda nao chegou a fechado', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'em_carga', placa: 'ABC1234', motorista: 'Joao Silva' }], // caminhoes
      [], // cargaItens — sem pedidos na carga
      [{ valorJson: { valor: true } }], // parametros faturamento.seguro_obrigatorio
      [], // segurosCarga
    ]);
    const resultado = await service.calcular(caminhaoId);
    const req = resultado.requisitos.find((r) => r.chave === 'cargaConferida')!;
    expect(req.ok).toBe(false);
    expect(req.detalhe).toBe('Não conferida');
    expect(resultado.liberavel).toBe(false);
  });

  it('reprova notasAutorizadas quando ha pedido sem nota emitida', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'fechado', placa: 'ABC1234', motorista: 'Joao Silva' }], // caminhoes
      [{ pedidoVendaId: 'pedido-1' }], // cargaItens
      [{ pedidoVendaId: 'pedido-1', statusNfse: 'pendente' }], // notasFiscais — ainda não emitida
      [{ valorJson: { valor: false } }], // parametros — seguro dispensado (isola o requisito em teste)
      [], // segurosCarga
    ]);
    const resultado = await service.calcular(caminhaoId);
    const req = resultado.requisitos.find((r) => r.chave === 'notasAutorizadas')!;
    expect(req.ok).toBe(false);
    expect(req.detalhe).toBe('0 de 1');
    expect(resultado.liberavel).toBe(false);
  });

  it('reprova seguroConfirmado quando status != confirmado e parametro obrigatorio', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'fechado', placa: 'ABC1234', motorista: 'Joao Silva' }], // caminhoes
      [{ pedidoVendaId: 'pedido-1' }], // cargaItens
      [{ pedidoVendaId: 'pedido-1', statusNfse: 'emitida' }], // notasFiscais
      [{ valorJson: { valor: true } }], // parametros — seguro obrigatorio
      [{ status: 'pendente' }], // segurosCarga
    ]);
    const resultado = await service.calcular(caminhaoId);
    const req = resultado.requisitos.find((r) => r.chave === 'seguroConfirmado')!;
    expect(req.ok).toBe(false);
    expect(req.detalhe).toBe('pendente');
    expect(resultado.liberavel).toBe(false);
  });

  it('DoD 10.12 parametro dispensa seguro', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'fechado', placa: 'ABC1234', motorista: 'Joao Silva' }], // caminhoes
      [{ pedidoVendaId: 'pedido-1' }], // cargaItens
      [{ pedidoVendaId: 'pedido-1', statusNfse: 'emitida' }], // notasFiscais
      [{ valorJson: { valor: false } }], // faturamento.seguro_obrigatorio = false
      [{ status: 'pendente' }], // segurosCarga — pendente, mas dispensado por parâmetro
    ]);
    const resultado = await service.calcular(caminhaoId);
    const req = resultado.requisitos.find((r) => r.chave === 'seguroConfirmado')!;
    expect(req.ok).toBe(true);
    expect(req.detalhe).toBe('dispensado por parâmetro');
  });

  it('reprova caminhaoMotorista quando placa ou motorista vazios', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'fechado', placa: '', motorista: 'Joao Silva' }], // caminhoes — placa vazia
      [{ pedidoVendaId: 'pedido-1' }], // cargaItens
      [{ pedidoVendaId: 'pedido-1', statusNfse: 'emitida' }], // notasFiscais
      [{ valorJson: { valor: false } }], // parametros — seguro dispensado (isola o requisito em teste)
      [], // segurosCarga
    ]);
    const resultado = await service.calcular(caminhaoId);
    const req = resultado.requisitos.find((r) => r.chave === 'caminhaoMotorista')!;
    expect(req.ok).toBe(false);
    expect(req.detalhe).toBe('Incompletos');
    expect(resultado.liberavel).toBe(false);
  });

  it('libera quando os 4 requisitos estao ok', async () => {
    const service = makeService([
      [{ id: caminhaoId, statusCaminhao: 'fechado', placa: 'ABC1234', motorista: 'Joao Silva' }], // caminhoes
      [{ pedidoVendaId: 'pedido-1' }], // cargaItens
      [{ pedidoVendaId: 'pedido-1', statusNfse: 'emitida' }], // notasFiscais
      [{ valorJson: { valor: true } }], // parametros — seguro obrigatorio
      [{ status: 'confirmado' }], // segurosCarga
    ]);
    const resultado = await service.calcular(caminhaoId);
    expect(resultado.liberavel).toBe(true);
    expect(resultado.requisitos.every((r) => r.ok)).toBe(true);
  });
});
