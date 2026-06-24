import { EstoqueConsultaService } from '../../src/modules/operacao/estoque/estoque-consulta.service';

describe('EstoqueConsultaService', () => {
  it('monta itens de peças e subitens com fallback de produto', async () => {
    const createdAt = new Date('2026-06-23T10:00:00Z');
    const createdAtAntigo = new Date('2026-06-22T10:00:00Z');
    let selectCall = 0;

    const db = {
      select: jest.fn(() => {
        const idx = selectCall++;
        if (idx === 0) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() => ({
                orderBy: jest.fn(() =>
                  Promise.resolve([
                    {
                      id: 'peca-1',
                      status: 'em_sobra',
                      peso: '12.500',
                      quantidade: '1',
                      etiqueta: 'ETQ-1',
                      itemComercialId: 'ic-1',
                      createdAt,
                    },
                  ]),
                ),
              })),
            })),
          };
        }
        if (idx === 1) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() => ({
                orderBy: jest.fn(() =>
                  Promise.resolve([
                    {
                      id: 'sub-1',
                      status: 'em_sobra',
                      peso: '2.000',
                      quantidade: '3.000',
                      etiqueta: null,
                      itemComercialId: 'ic-2',
                      createdAt: createdAtAntigo,
                    },
                  ]),
                ),
              })),
            })),
          };
        }
        if (idx === 2) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() =>
                Promise.resolve([
                  { id: 'ic-1', codigo: 'DIANT', descricao: 'Dianteiro' },
                  { id: 'ic-2', codigo: 'MISC', descricao: 'Sem produto' },
                ]),
              ),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            where: jest.fn(() =>
              Promise.resolve([
                {
                  itemComercialId: 'ic-1',
                  id: 'prod-1',
                  codigo: 'DIANT-P',
                  nome: 'Dianteiro produto',
                },
              ]),
            ),
          })),
        };
      }),
    };

    const service = new EstoqueConsultaService({ db } as never);
    const itens = await service.consultar();

    expect(itens).toHaveLength(2);
    expect(itens[0]?.tipo).toBe('peca');
    expect(itens[0]?.produto).toEqual({ id: 'prod-1', codigo: 'DIANT-P', nome: 'Dianteiro produto' });
    expect(itens[1]?.tipo).toBe('subitem');
    expect(itens[1]?.produto).toEqual({ id: null, codigo: 'MISC', nome: 'Sem produto' });
  });

  it('retorna lista vazia sem consultar itens comerciais', async () => {
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        const idx = selectCall++;
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => Promise.resolve([])),
            })),
          })),
        };
      }),
    };

    const service = new EstoqueConsultaService({ db } as never);
    await expect(service.consultar()).resolves.toEqual([]);
    expect(selectCall).toBe(2);
  });
});
