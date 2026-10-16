/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';
import * as lista from '../src/app/api/erp/fiscal/homologacoes/route';
import * as contagens from '../src/app/api/erp/fiscal/homologacoes/contagens/route';
import * as exportacao from '../src/app/api/erp/fiscal/homologacoes/exportacao/route';
import * as detalhe from '../src/app/api/erp/fiscal/homologacoes/[id]/route';
import * as diff from '../src/app/api/erp/fiscal/homologacoes/[id]/diff/route';
import * as acao from '../src/app/api/erp/fiscal/homologacoes/[id]/[acao]/route';

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

describe('BFF /api/erp/fiscal/homologacoes (E01-T05)', () => {
  it('repassa lista, detalhe, diff e mutações', async () => {
    await lista.GET(req('http://localhost/api/erp/fiscal/homologacoes?search=acem&page=2'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes?search=acem&page=2', { method: 'GET' });

    await lista.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes', { method: 'POST', body: CORPO });

    await contagens.GET(req('http://localhost/x?situacao=EM_REVISAO'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes/contagens?situacao=EM_REVISAO', { method: 'GET' });

    await detalhe.GET(req('http://localhost/x'), ctx({ id: 'h1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes/h1', { method: 'GET' });

    await diff.GET(req('http://localhost/x'), ctx({ id: 'h1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes/h1/diff', { method: 'GET' });
  });

  it('repassa 409 e 422', async () => {
    const aberto = {
      message: 'Já existe homologação em aberto ou publicada para esta versão.',
      codigo: 'HOMOLOGACAO_ABERTA',
    };
    apiFetchMock.mockImplementation(async () => json(409, aberto));
    const r409 = await lista.POST(req('http://localhost/x'));
    expect(r409.status).toBe(409);
    expect(await r409.json()).toEqual(aberto);

    const semCenario = {
      message: 'A publicação exige ao menos um cenário de regressão.',
      codigo: 'CENARIO_REGRESSAO_AUSENTE',
    };
    apiFetchMock.mockImplementation(async () => json(422, semCenario));
    const r422 = await acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: 'publicar' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes/h1/publicar', { method: 'POST', body: CORPO });
    expect(r422.status).toBe(422);
    expect(await r422.json()).toEqual(semCenario);
  });

  it('CSV mantém text/csv', async () => {
    const csv = '\uFEFFEnquadramento fiscal;Início de vigência;Situação;Usuário;Responsável pela aprovação;Descrição\r\n12;2026-01-01;Em revisão;Maria;;Revisão\r\n';
    apiFetchMock.mockImplementation(async () => new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="homologacoes.csv"',
      },
    }));
    const resposta = await exportacao.GET(req('http://localhost/x?situacao=EM_REVISAO'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/homologacoes/exportacao?situacao=EM_REVISAO', { method: 'GET' });
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(Buffer.from(await resposta.arrayBuffer()).toString('utf8')).toBe(csv);
  });

  it('ação fora da allowlist → 404 sem backend', async () => {
    for (const nome of ['cenarios', 'aprovar', 'rejeitar', 'publicar']) {
      await acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: nome }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(`/fiscal/homologacoes/h1/${nome}`, { method: 'POST', body: CORPO });
    }
    for (const nome of ['historico', 'pre-condicoes']) {
      await acao.GET(req('http://localhost/x'), ctx({ id: 'h1', acao: nome }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(`/fiscal/homologacoes/h1/${nome}`, { method: 'GET' });
    }

    apiFetchMock.mockClear();
    const fora: Array<Promise<Response>> = [
      acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: 'historico' })),
      acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: 'submeter' })),
      acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: 'auditar' })),
      acao.GET(req('http://localhost/x'), ctx({ id: 'h1', acao: 'aprovar' })),
      acao.GET(req('http://localhost/x'), ctx({ id: 'h1', acao: 'diff' })),
      acao.POST(req('http://localhost/x'), ctx({ id: 'h1', acao: 'diff' })),
    ];
    for (const resposta of await Promise.all(fora)) {
      expect(resposta.status).toBe(404);
    }
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
