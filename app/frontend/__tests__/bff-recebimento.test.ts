/** @jest-environment node */

import { NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';
import { GET as listarPedidos } from '../src/app/api/operacao/pedidos-fornecedor/route';
import {
  GET as listarRecebimentos,
  POST as iniciarRecebimento,
} from '../src/app/api/operacao/recebimentos/route';
import { GET as preverRecebimento } from '../src/app/api/operacao/recebimentos/previsao/[pedidoFornecedorId]/route';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn(), fetchBackend: jest.fn() }));

const apiFetchMock = jest.mocked(apiFetch);
const bytes = (texto: string) => new TextEncoder().encode(texto);

beforeEach(() => {
  apiFetchMock.mockReset();
});

it('BFF de recebimento encaminha pedidoFornecedorId sem traducao silenciosa', async () => {
  const query = 'elegiveisRecebimento=true&pagina=1&limite=100';
  apiFetchMock.mockResolvedValueOnce(new Response(bytes('{"data":[]}'), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  }));
  const listagem = await listarPedidos(new NextRequest(`http://localhost/api?${query}`));
  expect(apiFetchMock).toHaveBeenLastCalledWith(`/operacao/pedidos-fornecedor?${query}`);
  expect(listagem.status).toBe(200);
  expect(await listagem.text()).toBe('{"data":[]}');

  apiFetchMock.mockResolvedValueOnce(new Response(bytes('{"pedidoFornecedorId":"pf-1"}'), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
  const preview = await preverRecebimento(
    new NextRequest('http://localhost/api/operacao/recebimentos/previsao/pf-1'),
    { params: Promise.resolve({ pedidoFornecedorId: 'pf-1' }) },
  );
  expect(apiFetchMock).toHaveBeenLastCalledWith('/operacao/recebimentos/previsao/pf-1');
  expect(preview.status).toBe(200);
  expect(await preview.text()).toBe('{"pedidoFornecedorId":"pf-1"}');

  for (const caso of [
    { status: 201, corpo: '{"recebimento":{"id":"r-1"},"jaIniciado":false}' },
    { status: 400, corpo: '{"message":"payload inválido"}' },
    { status: 404, corpo: '{"message":"pedido ausente"}' },
    { status: 409, corpo: '{"message":"estado inválido"}' },
  ]) {
    apiFetchMock.mockResolvedValueOnce(new Response(bytes(caso.corpo), {
      status: caso.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }));
    const body = JSON.stringify({ pedidoFornecedorId: 'pf-1' });
    const resposta = await iniciarRecebimento(new NextRequest(
      'http://localhost/api/operacao/recebimentos',
      { method: 'POST', body },
    ));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/operacao/recebimentos', {
      method: 'POST',
      body,
    });
    expect(resposta.status).toBe(caso.status);
    expect(resposta.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await resposta.text()).toBe(caso.corpo);
  }

  const legado = JSON.stringify({ compraProgramadaId: 'compra-1' });
  apiFetchMock.mockResolvedValueOnce(new Response(bytes('legado-preservado'), { status: 400 }));
  const respostaLegada = await iniciarRecebimento(new NextRequest(
    'http://localhost/api/operacao/recebimentos',
    { method: 'POST', body: legado },
  ));
  expect(apiFetchMock).toHaveBeenLastCalledWith('/operacao/recebimentos', {
    method: 'POST',
    body: legado,
  });
  expect(respostaLegada.status).toBe(400);
  expect(respostaLegada.headers.has('content-type')).toBe(false);
  expect(await respostaLegada.text()).toBe('legado-preservado');

  apiFetchMock.mockResolvedValueOnce(new Response(bytes('lista-bruta'), { status: 409 }));
  const respostaLista = await listarRecebimentos(
    new NextRequest('http://localhost/api/operacao/recebimentos?page=2'),
  );
  expect(apiFetchMock).toHaveBeenLastCalledWith('/operacao/recebimentos?page=2');
  expect(respostaLista.status).toBe(409);
  expect(respostaLista.headers.has('content-type')).toBe(false);
  expect(await respostaLista.text()).toBe('lista-bruta');
});
