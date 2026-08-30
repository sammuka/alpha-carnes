/** @jest-environment node */

import { NextRequest } from 'next/server';
import { fetchBackend } from '@/lib/api';
import { GET as listarDisponibilidade } from '../src/app/api/comercial/disponibilidade/route';
import { GET as composicaoLotes } from '../src/app/api/comercial/pedidos/[id]/composicao-lotes/route';

jest.mock('@/lib/api', () => ({ fetchBackend: jest.fn() }));

const fetchBackendMock = jest.mocked(fetchBackend);

beforeEach(() => {
  fetchBackendMock.mockReset();
});

it('GET disponibilidade repassa dataOperacao e compraProgramadaId ao backend', async () => {
  fetchBackendMock.mockResolvedValueOnce({ data: [], error: null, status: 200 });
  const req = new NextRequest(
    'http://localhost/api/comercial/disponibilidade?dataOperacao=2026-12-20&compraProgramadaId=cp-002',
  );
  const res = await listarDisponibilidade(req);
  expect(fetchBackendMock).toHaveBeenCalledWith(
    '/comercial/disponibilidade?dataOperacao=2026-12-20&compraProgramadaId=cp-002',
  );
  expect(res.status).toBe(200);
});

it('GET composicao-lotes repassa status e body sem agrupar no BFF', async () => {
  const body = [{ compraProgramadaId: 'cp-1', numeroSequencial: 1, recebimentoId: 'rec-1', quantidadeUnidades: 6, pesoTotal: '6.000' }];
  fetchBackendMock.mockResolvedValueOnce({ data: body, error: null, status: 200 });
  const res = await composicaoLotes(
    new NextRequest('http://localhost/api/comercial/pedidos/ped-1/composicao-lotes'),
    { params: Promise.resolve({ id: 'ped-1' }) },
  );
  expect(fetchBackendMock).toHaveBeenCalledWith('/comercial/pedidos/ped-1/composicao-lotes');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(body);

  fetchBackendMock.mockResolvedValueOnce({ data: null, error: 'Pedido não encontrado', status: 404 });
  const erro = await composicaoLotes(
    new NextRequest('http://localhost/api/comercial/pedidos/x/composicao-lotes'),
    { params: Promise.resolve({ id: 'x' }) },
  );
  expect(erro.status).toBe(404);
  expect(await erro.json()).toEqual({ message: 'Pedido não encontrado' });
});
