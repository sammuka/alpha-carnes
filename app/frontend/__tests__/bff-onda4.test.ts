/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiFetch, fetchBackend } from '@/lib/api';
import * as rotaPedidoAgregado from '../src/app/api/comercial/pedidos/[id]/route';
import {
  DELETE as removerItem,
  PATCH as reduzirItem,
} from '../src/app/api/comercial/pedidos/[id]/itens/[itemId]/route';
import { POST as confirmarCompra } from '../src/app/api/comercial/compras-programadas/[id]/confirmar/route';
import type { ConfirmacaoCompraProgramada } from '@/lib/comercial';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn(), fetchBackend: jest.fn() }));

const RAIZ_FRONTEND = join(__dirname, '..');

/** Todos os `.ts`/`.tsx` sob um diretório do frontend, recursivo, em caminho absoluto. */
function arquivos(diretorio: string): string[] {
  const raiz = join(RAIZ_FRONTEND, diretorio);
  return readdirSync(raiz, { recursive: true, encoding: 'utf8' })
    .filter((relativo) => /\.tsx?$/.test(relativo))
    .map((relativo) => join(raiz, relativo));
}

const ler = (arquivo: string) => readFileSync(arquivo, 'utf8');
const apiFetchMock = jest.mocked(apiFetch);
const fetchBackendMock = jest.mocked(fetchBackend);

function requisicaoCom(body: unknown): NextRequest {
  return { json: jest.fn().mockResolvedValue(body) } as unknown as NextRequest;
}

function contexto(itemId: string) {
  return { params: Promise.resolve({ id: 'pedido-1', itemId }) };
}

beforeEach(() => {
  apiFetchMock.mockReset();
  fetchBackendMock.mockReset();
});

it('nenhuma tela da onda 4 chama o backend fora do BFF', () => {
  const telas = arquivos('src/app/(admin)/comercial');
  const vazamentos = telas.filter((f) =>
    /fetchBackend|process\.env\.BACKEND_URL|http:\/\/localhost:3001/.test(ler(f)));
  expect(vazamentos).toEqual([]);
});

it('BFF de item usa a rota aninhada e os contratos reais de reducao e remocao', async () => {
  const reducao = {
    novaQuantidade: 4,
    motivo: 'Redução de quantidade no editor de rascunho',
  };
  apiFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  const sucessoPatch = await reduzirItem(requisicaoCom(reducao), contexto('item-reduzido'));
  expect(apiFetchMock).toHaveBeenLastCalledWith(
    '/comercial/pedidos/pedido-1/itens/item-reduzido',
    { method: 'PATCH', body: JSON.stringify(reducao) },
  );
  expect(sucessoPatch.status).toBe(204);
  expect(await sucessoPatch.text()).toBe('');

  const remocao = { motivo: 'Remoção de item no editor de rascunho' };
  apiFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  const sucessoDelete = await removerItem(requisicaoCom(remocao), contexto('item-removido'));
  expect(apiFetchMock).toHaveBeenLastCalledWith(
    '/comercial/pedidos/pedido-1/itens/item-removido',
    { method: 'DELETE', body: JSON.stringify(remocao) },
  );
  expect(sucessoDelete.status).toBe(204);
  expect(await sucessoDelete.text()).toBe('');

  const erros = [
    {
      executar: reduzirItem,
      method: 'PATCH',
      itemId: 'item-400',
      body: reducao,
      status: 400,
      corpo: '{ "statusCode":400, "message":"quantidade inválida" }\n',
    },
    {
      executar: removerItem,
      method: 'DELETE',
      itemId: 'item-404',
      body: remocao,
      status: 404,
      corpo: '{ "statusCode":404, "message":"item não encontrado" }\n',
    },
    {
      executar: reduzirItem,
      method: 'PATCH',
      itemId: 'item-409',
      body: reducao,
      status: 409,
      corpo: '{ "statusCode":409, "message":"conflito de edição" }\n',
    },
  ] as const;

  for (const caso of erros) {
    apiFetchMock.mockResolvedValueOnce(new Response(caso.corpo, {
      status: caso.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }));
    const resposta = await caso.executar(requisicaoCom(caso.body), contexto(caso.itemId));
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      `/comercial/pedidos/pedido-1/itens/${caso.itemId}`,
      { method: caso.method, body: JSON.stringify(caso.body) },
    );
    expect(resposta.status).toBe(caso.status);
    expect(resposta.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await resposta.text()).toBe(caso.corpo);
  }

  const contratos = join(RAIZ_FRONTEND, 'src/lib/comercial.ts');
  expect(Object.keys(rotaPedidoAgregado)).not.toContain('PATCH');

  const fonteContratos = ler(contratos);
  expect(fonteContratos).toMatch(
    /interface ReduzirItemPedidoBody[\s\S]*novaQuantidade: number;[\s\S]*motivo: string;/,
  );
  expect(fonteContratos).toMatch(
    /interface RemoverItemPedidoBody[\s\S]*motivo: string;/,
  );
});

it('BFF de confirmar compra preserva o envelope canonico', async () => {
  const envelope: ConfirmacaoCompraProgramada = {
    compra: {
      id: 'compra-1',
      operacaoId: 'operacao-1',
      dataOperacao: '2026-09-21',
      fornecedorId: 'fornecedor-1',
      numeroInterno: null,
      referenciaExterna: null,
      previsaoEntrega: null,
      status: 'confirmada',
      observacoes: null,
      createdAt: '2026-09-20T10:00:00.000Z',
      itens: [],
    },
    jaConfirmada: false,
  };
  fetchBackendMock.mockResolvedValueOnce({ data: envelope, error: null, status: 201 } as never);

  const resposta = await confirmarCompra(
    {} as NextRequest,
    { params: Promise.resolve({ id: 'compra-1' }) },
  );

  expect(fetchBackendMock).toHaveBeenCalledWith(
    '/comercial/compras-programadas/compra-1/confirmar',
    { method: 'POST' },
  );
  expect(resposta.status).toBe(200);
  expect(await resposta.json()).toEqual(envelope);
});
