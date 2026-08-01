import { roomsDaData } from '../../src/realtime/events/eventos';

describe('roomsDaData', () => {
  it('inclui dashboard, desossa e operacao:{data}', () => {
    expect(roomsDaData('2026-07-31')).toEqual([
      'dashboard',
      'desossa',
      'operacao:2026-07-31',
    ]);
  });
});
