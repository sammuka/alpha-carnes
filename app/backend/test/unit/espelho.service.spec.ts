import { derivarStatus } from '../../src/modules/comercial/espelho/espelho.service';

describe('EspelhoService — derivarStatus (DoD-105)', () => {
  it('deriva status do item na precedencia cancelado faturado fechado atendido parcial aberto', () => {
    expect(derivarStatus('cancelado', 10, 0)).toBe('Cancelado');
    expect(derivarStatus('cancelado', 10, 10)).toBe('Cancelado');
    expect(derivarStatus('faturado', 10, 10)).toBe('Faturado');
    expect(derivarStatus('finalizado', 10, 10)).toBe('Fechado');
    expect(derivarStatus('finalizado', 10, 0)).toBe('Fechado');
    expect(derivarStatus('em_elaboracao_reserva_ativa', 10, 10)).toBe('Atendido');
    expect(derivarStatus('atendido', 10, 12)).toBe('Atendido');
    expect(derivarStatus('parcialmente_atendido', 10, 4)).toBe('Parcial');
    expect(derivarStatus('em_elaboracao_reserva_ativa', 10, 0)).toBe('Aberto');
  });
});
