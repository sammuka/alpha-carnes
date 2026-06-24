import { AuditoriaConsultaService } from '../../src/modules/auditoria/auditoria.service';

describe('AuditoriaConsultaService', () => {
  function montarDb(linhas: unknown[], total = linhas.length) {
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => ({
                  offset: jest.fn(() => Promise.resolve(linhas)),
                })),
              })),
            })),
          })),
          where: jest.fn(() => Promise.resolve([{ total }])),
        })),
      })),
    };
    return new AuditoriaConsultaService({ db } as never);
  }

  it('lista sem filtros', async () => {
    const service = montarDb([
      {
        id: 'a1',
        tabela: 'clientes',
        registroId: 'r1',
        operacao: 'INSERT',
        modulo: 'cadastros',
        usuarioId: 'u1',
        usuarioNome: 'Admin',
        dadosAnteriores: {},
        dadosNovos: { nome: 'X' },
        justificativa: null,
        ip: null,
        userAgent: null,
        createdAt: new Date('2026-06-01T10:00:00Z'),
      },
    ]);
    const res = await service.listar({ page: 1, pageSize: 20 });
    expect(res.data).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it('aplica todos os filtros opcionais', async () => {
    const service = montarDb([]);
    await service.listar({
      page: 2,
      pageSize: 10,
      modulo: 'operacao',
      operacao: 'UPDATE',
      usuarioId: '019ef6b5-0000-7000-8000-000000000001',
      registroId: '019ef6b5-0000-7000-8000-000000000002',
      tabela: 'recebimentos',
      dataInicio: '2026-06-01T00:00:00.000Z',
      dataFim: '2026-06-30T23:59:59.000Z',
    });
    expect(service['db'].select).toHaveBeenCalled();
  });
});
