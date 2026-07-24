import { extrairMensagemErro } from '../src/lib/error-message';

jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (payload: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => payload,
    }),
  },
}));

describe('extrairMensagemErro', () => {
  it('retorna string message direta', () => {
    expect(extrairMensagemErro({ message: 'Credenciais inválidas' }, 'fallback')).toBe(
      'Credenciais inválidas',
    );
  });

  it('desaninha message aninhado pelo AllExceptionsFilter', () => {
    expect(
      extrairMensagemErro(
        {
          statusCode: 401,
          message: { message: 'Credenciais inválidas', error: 'Unauthorized', statusCode: 401 },
        },
        'fallback',
      ),
    ).toBe('Credenciais inválidas');
  });

  it('junta array de mensagens de validação', () => {
    expect(extrairMensagemErro({ message: ['E-mail inválido', 'Senha obrigatória'] }, 'fallback')).toBe(
      'E-mail inválido. Senha obrigatória',
    );
  });

  it('usa fallback quando payload não tem mensagem utilizável', () => {
    expect(extrairMensagemErro({ statusCode: 500 }, 'Erro genérico')).toBe('Erro genérico');
  });
});

describe('BFF POST /api/comercial/pedidos', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetModules();
  });

  it('preserva status e body do challenge 409', async () => {
    const challenge = {
      code: 'OVERBOOKING_CONFIRMACAO_NECESSARIA',
      message: 'A venda poderá ser concluída, mas a gestão deverá tratar a falta.',
      desafios: [{ itemComercialId: 'i1', quantidadeDeficit: '1.000' }],
    };
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify(challenge), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const { POST } = await import('../src/app/api/comercial/pedidos/route');
    const req = { json: async () => ({ clienteId: 'c1', dataOperacao: '2026-07-24', itens: [] }) };
    const res = await POST(req as never);
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual(challenge);
  });

  it('preserva status 201 no sucesso', async () => {
    const criado = { id: 'p1', status: 'em_elaboracao_reserva_ativa' };
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify(criado), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const { POST } = await import('../src/app/api/comercial/pedidos/route');
    const req = { json: async () => ({ clienteId: 'c1', dataOperacao: '2026-07-24', itens: [] }) };
    const res = await POST(req as never);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual(criado);
  });
});

describe('BFF POST /api/comercial/pedidos/confirmar-overbooking', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetModules();
  });

  it('preserva status 201 no sucesso', async () => {
    const criado = { id: 'p2', status: 'em_elaboracao_reserva_ativa' };
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify(criado), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const { POST } = await import('../src/app/api/comercial/pedidos/confirmar-overbooking/route');
    const req = { json: async () => ({ clienteId: 'c1', dataOperacao: '2026-07-24', itens: [] }) };
    const res = await POST(req as never);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual(criado);
  });
});

describe('BFF GET /api/comercial/overbooking', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetModules();
  });

  it('retorna lista paginada com sucesso', async () => {
    const lista = {
      data: [{ id: 'pend1', status: 'aberta', quantidadeDeficit: '2.000' }],
      page: 1,
      pageSize: 20,
      total: 1,
    };
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify(lista), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const { GET } = await import('../src/app/api/comercial/overbooking/route');
    const req = { nextUrl: { searchParams: new URLSearchParams('operacaoId=op1') } };
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(lista);
  });
});
