/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';
import * as cfops from '../src/app/api/erp/fiscal/cfops/route';
import * as ncms from '../src/app/api/erp/fiscal/ncms/route';
import * as enquadramentos from '../src/app/api/erp/fiscal/enquadramentos/route';
import * as contagens from '../src/app/api/erp/fiscal/enquadramentos/contagens/route';
import * as exportacao from '../src/app/api/erp/fiscal/enquadramentos/exportacao/route';
import * as consulta from '../src/app/api/erp/fiscal/enquadramentos/consulta/route';
import * as enquadramento from '../src/app/api/erp/fiscal/enquadramentos/[id]/route';
import * as acao from '../src/app/api/erp/fiscal/enquadramentos/[id]/[acao]/route';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));

const apiFetchMock = jest.mocked(apiFetch);
const CORPO = JSON.stringify({ versao: 1, justificativa: 'Motivo da alteração' });

function req(url: string, corpo: string = CORPO): NextRequest {
  return {
    nextUrl: new URL(url),
    text: jest.fn().mockResolvedValue(corpo),
  } as unknown as NextRequest;
}

function ctx<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async () => json(200, { ok: true }));
});

describe('BFF /api/erp/fiscal (E01-T02)', () => {
  it('repassa lista, catálogos, detalhe e mutações', async () => {
    await enquadramentos.GET(req('http://localhost/api/erp/fiscal/enquadramentos?search=acem&page=2'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/enquadramentos?search=acem&page=2', { method: 'GET' });

    await enquadramentos.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/enquadramentos', { method: 'POST', body: CORPO });

    await contagens.GET(req('http://localhost/x?estabelecimentoId=s1'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/enquadramentos/contagens?estabelecimentoId=s1', { method: 'GET' });

    await consulta.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/enquadramentos/consulta', { method: 'POST', body: CORPO });

    await cfops.GET(req('http://localhost/x?search=5102'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/cfops?search=5102', { method: 'GET' });
    await cfops.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/cfops', { method: 'POST', body: CORPO });

    await ncms.GET(req('http://localhost/x?search=0201'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/ncms?search=0201', { method: 'GET' });
    await ncms.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/ncms', { method: 'POST', body: CORPO });

    await enquadramento.GET(req('http://localhost/x'), ctx({ id: 'e1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/enquadramentos/e1', { method: 'GET' });
    await enquadramento.PATCH(req('http://localhost/x'), ctx({ id: 'e1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/enquadramentos/e1', { method: 'PATCH', body: CORPO });
    await enquadramento.DELETE(req('http://localhost/x'), ctx({ id: 'e1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/enquadramentos/e1', { method: 'DELETE', body: CORPO });
  });

  it('repassa 409 e 422', async () => {
    const sobreposicao = {
      message: 'Há vigência sobreposta para a mesma chave de enquadramento.',
      codigo: 'ENQUADRAMENTO_SOBREPOSTO',
      conflito: { codigo: '12', vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31', prioridade: 1 },
    };
    apiFetchMock.mockImplementation(async () => json(409, sobreposicao));
    const r409 = await enquadramentos.POST(req('http://localhost/x'));
    expect(r409.status).toBe(409);
    expect(await r409.json()).toEqual(sobreposicao);

    const empate = {
      message: 'Há mais de um enquadramento vigente para este critério. Nenhum foi escolhido.',
      codigo: 'EMPATE_ENQUADRAMENTO',
      candidatos: [{ codigo: '2', prioridade: 1 }, { codigo: '10', prioridade: 99 }],
    };
    apiFetchMock.mockImplementation(async () => json(422, empate));
    const r422 = await consulta.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/enquadramentos/consulta', { method: 'POST', body: CORPO });
    expect(r422.status).toBe(422);
    expect(await r422.json()).toEqual(empate);
    expect(JSON.stringify(empate)).not.toMatch(/vencedor|cst|aliquota/i);
  });

  it('CSV mantém text/csv', async () => {
    const csv = '\uFEFFCódigo;Operação fiscal (CFOP)\r\n12;5102\r\n';
    apiFetchMock.mockImplementation(async () => new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="enquadramentos.csv"',
      },
    }));
    const resposta = await exportacao.GET(req('http://localhost/x?estabelecimentoId=s1'));
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      '/fiscal/enquadramentos/exportacao?estabelecimentoId=s1',
      { method: 'GET' },
    );
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(resposta.headers.get('content-disposition')).toBe('attachment; filename="enquadramentos.csv"');
    expect(Buffer.from(await resposta.arrayBuffer()).toString('utf8')).toBe(csv);
  });

  it('ações da allowlist e ação fora da allowlist → 404 sem backend', async () => {
    for (const nome of ['duplicar', 'inativar', 'reativar']) {
      await acao.POST(req('http://localhost/x'), ctx({ id: 'e1', acao: nome }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(`/fiscal/enquadramentos/e1/${nome}`, { method: 'POST', body: CORPO });
    }
    for (const nome of ['historico', 'pre-condicoes']) {
      await acao.GET(req('http://localhost/x'), ctx({ id: 'e1', acao: nome }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(`/fiscal/enquadramentos/e1/${nome}`, { method: 'GET' });
    }

    apiFetchMock.mockClear();
    const fora: Array<Promise<Response>> = [
      acao.POST(req('http://localhost/x'), ctx({ id: 'e1', acao: 'aprovar' })),
      acao.POST(req('http://localhost/x'), ctx({ id: 'e1', acao: 'historico' })),
      acao.GET(req('http://localhost/x'), ctx({ id: 'e1', acao: 'duplicar' })),
      acao.GET(req('http://localhost/x'), ctx({ id: 'e1', acao: 'simular' })),
    ];
    for (const resposta of await Promise.all(fora)) {
      expect(resposta.status).toBe(404);
    }
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
