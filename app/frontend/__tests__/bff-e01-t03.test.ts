/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';
import * as beneficios from '../src/app/api/erp/fiscal/beneficios-fiscais/route';
import * as classificacoes from '../src/app/api/erp/fiscal/classificacoes-ibs-cbs/route';
import * as regras from '../src/app/api/erp/fiscal/regras/route';
import * as contagens from '../src/app/api/erp/fiscal/regras/contagens/route';
import * as exportacao from '../src/app/api/erp/fiscal/regras/exportacao/route';
import * as regra from '../src/app/api/erp/fiscal/regras/[id]/route';
import * as comparar from '../src/app/api/erp/fiscal/regras/[id]/comparar/route';
import * as acao from '../src/app/api/erp/fiscal/regras/[id]/[acao]/route';

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

describe('BFF /api/erp/fiscal (E01-T03)', () => {
  it('repassa lista, catálogos, detalhe, comparação e mutações', async () => {
    await regras.GET(req('http://localhost/api/erp/fiscal/regras?search=acem&page=2'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/regras?search=acem&page=2', { method: 'GET' });

    await regras.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/regras', { method: 'POST', body: CORPO });

    await contagens.GET(req('http://localhost/x?cfopId=c1'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/regras/contagens?cfopId=c1', { method: 'GET' });

    await beneficios.GET(req('http://localhost/x?search=SP'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/beneficios-fiscais?search=SP', { method: 'GET' });
    await beneficios.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/beneficios-fiscais', { method: 'POST', body: CORPO });

    await classificacoes.GET(req('http://localhost/x?search=000'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/classificacoes-ibs-cbs?search=000', { method: 'GET' });
    await classificacoes.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/classificacoes-ibs-cbs', { method: 'POST', body: CORPO });

    await regra.GET(req('http://localhost/x'), ctx({ id: 'r1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/regras/r1', { method: 'GET' });
    await regra.PATCH(req('http://localhost/x'), ctx({ id: 'r1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/regras/r1', { method: 'PATCH', body: CORPO });

    await comparar.GET(req('http://localhost/x?com=r2'), ctx({ id: 'r1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/regras/r1/comparar?com=r2', { method: 'GET' });
  });

  it('repassa 409 e 422', async () => {
    const imutavel = {
      message: 'Versão aprovada ou aposentada não pode ser alterada. Inclua uma versão nova.',
      codigo: 'VERSAO_IMUTAVEL',
    };
    apiFetchMock.mockImplementation(async () => json(409, imutavel));
    const r409 = await regra.PATCH(req('http://localhost/x'), ctx({ id: 'r1' }));
    expect(r409.status).toBe(409);
    expect(await r409.json()).toEqual(imutavel);

    const ambigua = {
      message: 'Já existe versão aprovada deste enquadramento com vigência sobreposta. Nenhuma foi escolhida.',
      codigo: 'VIGENCIA_AMBIGUA',
      conflito: { codigo: '2', numeroVersao: 1, vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31' },
    };
    apiFetchMock.mockImplementation(async () => json(422, ambigua));
    const r422 = await acao.POST(req('http://localhost/x'), ctx({ id: 'r1', acao: 'aprovar' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/regras/r1/aprovar', { method: 'POST', body: CORPO });
    expect(r422.status).toBe(422);
    expect(await r422.json()).toEqual(ambigua);
    expect(ambigua).not.toHaveProperty('valor');
    expect(ambigua).not.toHaveProperty('base');
    expect(ambigua).not.toHaveProperty('tributo');
  });

  it('CSV mantém text/csv', async () => {
    const csv = '\uFEFFEnquadramento fiscal;Operação fiscal (CFOP);Benefício fiscal;Classificação IBS/CBS;Operação;Tratamento ICMS\r\n12;5102;Redução;Integral;Compra;Redução de base\r\n';
    apiFetchMock.mockImplementation(async () => new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="regras.csv"',
      },
    }));
    const resposta = await exportacao.GET(req('http://localhost/x?cfopId=c1'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/regras/exportacao?cfopId=c1', { method: 'GET' });
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(Buffer.from(await resposta.arrayBuffer()).toString('utf8')).toBe(csv);
  });

  it('ação fora da allowlist → 404 sem backend', async () => {
    for (const nome of ['versoes', 'submeter', 'aprovar', 'aposentar']) {
      await acao.POST(req('http://localhost/x'), ctx({ id: 'r1', acao: nome }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(`/fiscal/regras/r1/${nome}`, { method: 'POST', body: CORPO });
    }
    for (const nome of ['historico', 'pre-condicoes']) {
      await acao.GET(req('http://localhost/x'), ctx({ id: 'r1', acao: nome }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(`/fiscal/regras/r1/${nome}`, { method: 'GET' });
    }

    apiFetchMock.mockClear();
    const fora: Array<Promise<Response>> = [
      acao.POST(req('http://localhost/x'), ctx({ id: 'r1', acao: 'historico' })),
      acao.POST(req('http://localhost/x'), ctx({ id: 'r1', acao: 'simular' })),
      acao.GET(req('http://localhost/x'), ctx({ id: 'r1', acao: 'aprovar' })),
      acao.GET(req('http://localhost/x'), ctx({ id: 'r1', acao: 'publicar' })),
    ];
    for (const resposta of await Promise.all(fora)) {
      expect(resposta.status).toBe(404);
    }
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
