/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';
import * as simulacoes from '../src/app/api/erp/fiscal/simulacoes/route';
import * as contagens from '../src/app/api/erp/fiscal/simulacoes/contagens/route';
import * as exportacao from '../src/app/api/erp/fiscal/simulacoes/exportacao/route';
import * as simulacao from '../src/app/api/erp/fiscal/simulacoes/[id]/route';
import * as comparar from '../src/app/api/erp/fiscal/simulacoes/[id]/comparar/route';
import * as memoria from '../src/app/api/erp/fiscal/simulacoes/[id]/memoria/route';
import * as acao from '../src/app/api/erp/fiscal/simulacoes/[id]/[acao]/route';

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

describe('BFF /api/erp/fiscal (E01-T04)', () => {
  it('repassa lista, detalhe, comparação, explicação e versão nova', async () => {
    await simulacoes.GET(req('http://localhost/api/erp/fiscal/simulacoes?search=acougue&page=2'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/simulacoes?search=acougue&page=2', { method: 'GET' });

    await simulacoes.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/simulacoes', { method: 'POST', body: CORPO });

    await contagens.GET(req('http://localhost/x?competencia=2026-10'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/simulacoes/contagens?competencia=2026-10', { method: 'GET' });

    await simulacao.GET(req('http://localhost/x'), ctx({ id: 's1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/simulacoes/s1', { method: 'GET' });

    await comparar.GET(req('http://localhost/x?com=s2'), ctx({ id: 's1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/simulacoes/s1/comparar?com=s2', { method: 'GET' });

    await acao.GET(req('http://localhost/x'), ctx({ id: 's1', acao: 'explicacao' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/simulacoes/s1/explicacao', { method: 'GET' });

    await acao.POST(req('http://localhost/x'), ctx({ id: 's1', acao: 'versoes' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/simulacoes/s1/versoes', { method: 'POST', body: CORPO });
  });

  it('repassa 409 e 422 com o codigo do corpo', async () => {
    const imutavel = {
      message: 'A memória calculada não pode ser alterada. Inclua uma versão nova.',
      codigo: 'VERSAO_IMUTAVEL',
    };
    apiFetchMock.mockImplementation(async () => json(409, imutavel));
    const r409 = await simulacao.PATCH(req('http://localhost/x'), ctx({ id: 's1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/simulacoes/s1', { method: 'PATCH', body: CORPO });
    expect(r409.status).toBe(409);
    expect(await r409.json()).toEqual(imutavel);

    const falta = {
      message: 'Não há regra tributária aprovada vigente nesta competência para o enquadramento selecionado.',
      codigo: 'FALTA_REFERENCIA_LEGAL',
    };
    apiFetchMock.mockImplementation(async () => json(422, falta));
    const r422 = await simulacoes.POST(req('http://localhost/x'));
    expect(r422.status).toBe(422);
    expect(await r422.json()).toEqual(falta);
  });

  it('CSV de memória e da grade mantém text/csv', async () => {
    const csv = '\uFEFFCampo;Valor\r\nICMS;70,00\r\n';
    apiFetchMock.mockImplementation(async () => new Response(csv, {
      status: 200,
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    }));
    const daMemoria = await memoria.GET(req('http://localhost/x'), ctx({ id: 's1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/simulacoes/s1/memoria', { method: 'GET' });
    expect(daMemoria.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(Buffer.from(await daMemoria.arrayBuffer()).toString('utf8')).toBe(csv);

    const grade = '\uFEFFCliente;Produto;Valor;Valor líquido (calculado);Estabelecimento;Operação\r\nAçougue Central;Acém;1.000,00;1.000,00;Filial Osasco;Compra\r\n';
    apiFetchMock.mockImplementation(async () => new Response(grade, {
      status: 200,
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    }));
    const daGrade = await exportacao.GET(req('http://localhost/x?competencia=2026-10'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/simulacoes/exportacao?competencia=2026-10', { method: 'GET' });
    expect(daGrade.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(Buffer.from(await daGrade.arrayBuffer()).toString('utf8')).toBe(grade);
  });

  it('aprovar e publicar na allowlist → 404 sem backend', async () => {
    for (const nome of ['explicacao', 'historico', 'pre-condicoes']) {
      await acao.GET(req('http://localhost/x'), ctx({ id: 's1', acao: nome }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(`/fiscal/simulacoes/s1/${nome}`, { method: 'GET' });
    }
    await acao.POST(req('http://localhost/x'), ctx({ id: 's1', acao: 'versoes' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/simulacoes/s1/versoes', { method: 'POST', body: CORPO });

    apiFetchMock.mockClear();
    const fora = await Promise.all([
      acao.POST(req('http://localhost/x'), ctx({ id: 's1', acao: 'aprovar' })),
      acao.POST(req('http://localhost/x'), ctx({ id: 's1', acao: 'publicar' })),
      acao.GET(req('http://localhost/x'), ctx({ id: 's1', acao: 'aprovar' })),
      acao.GET(req('http://localhost/x'), ctx({ id: 's1', acao: 'publicar' })),
    ]);
    for (const resposta of fora) expect(resposta.status).toBe(404);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
