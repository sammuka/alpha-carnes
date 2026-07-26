import { EVENTOS } from '../../src/realtime/events/eventos';

describe('Onda 4 — catálogo de eventos de domínio', () => {
  it('catalogo expoe os tres eventos da onda 4', () => {
    expect(EVENTOS.ADENDO_REGISTRADO).toBe('adendo_registrado');
    expect(EVENTOS.RESERVA_LIBERADA_ADMIN).toBe('reserva_liberada_admin');
    expect(EVENTOS.TABELA_PRECO_PUBLICADA).toBe('tabela_preco_publicada');
  });
});
