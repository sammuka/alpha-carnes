/** @jest-environment node */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';
import * as empresas from '../src/app/api/erp/fiscal/empresas/route';
import * as empresa from '../src/app/api/erp/fiscal/empresas/[id]/route';
import * as estabelecimentos from '../src/app/api/erp/fiscal/estabelecimentos/route';
import * as contagens from '../src/app/api/erp/fiscal/estabelecimentos/contagens/route';
import * as exportacao from '../src/app/api/erp/fiscal/estabelecimentos/exportacao/route';
import * as estabelecimento from '../src/app/api/erp/fiscal/estabelecimentos/[id]/route';
import * as acaoEstabelecimento from '../src/app/api/erp/fiscal/estabelecimentos/[id]/[acao]/route';
import * as cnaes from '../src/app/api/erp/fiscal/estabelecimentos/[id]/cnaes/route';
import * as alteracoes from '../src/app/api/erp/fiscal/estabelecimentos/[id]/alteracoes/route';
import * as alteracao from '../src/app/api/erp/fiscal/estabelecimentos/[id]/alteracoes/[altId]/route';
import * as acaoAlteracao from '../src/app/api/erp/fiscal/estabelecimentos/[id]/alteracoes/[altId]/[acao]/route';
import * as regimes from '../src/app/api/erp/fiscal/estabelecimentos/[id]/regimes/route';
import * as regime from '../src/app/api/erp/fiscal/estabelecimentos/[id]/regimes/[regimeId]/route';
import * as acaoRegime from '../src/app/api/erp/fiscal/estabelecimentos/[id]/regimes/[regimeId]/[acao]/route';

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

function respostaJson(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async () => respostaJson(200, { ok: true }));
});

describe('BFF /api/erp/fiscal (E01-T01)', () => {
  it('todas as rotas do plano existem', () => {
    const raiz = join(__dirname, '..', 'src', 'app', 'api', 'erp', 'fiscal');
    const rotas = [
      'empresas/route.ts',
      'empresas/[id]/route.ts',
      'estabelecimentos/route.ts',
      'estabelecimentos/contagens/route.ts',
      'estabelecimentos/exportacao/route.ts',
      'estabelecimentos/[id]/route.ts',
      'estabelecimentos/[id]/[acao]/route.ts',
      'estabelecimentos/[id]/cnaes/route.ts',
      'estabelecimentos/[id]/alteracoes/route.ts',
      'estabelecimentos/[id]/alteracoes/[altId]/route.ts',
      'estabelecimentos/[id]/alteracoes/[altId]/[acao]/route.ts',
      'estabelecimentos/[id]/regimes/route.ts',
      'estabelecimentos/[id]/regimes/[regimeId]/route.ts',
      'estabelecimentos/[id]/regimes/[regimeId]/[acao]/route.ts',
    ];
    expect(rotas.filter((r) => !existsSync(join(raiz, r)))).toEqual([]);
  });

  it('empresas: GET repassa a query, POST/PATCH/DELETE repassam corpo e verbo', async () => {
    await empresas.GET(req('http://localhost/api/erp/fiscal/empresas?search=alfa&page=2'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/empresas?search=alfa&page=2', { method: 'GET' });

    await empresas.POST(req('http://localhost/api/erp/fiscal/empresas'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/empresas', { method: 'POST', body: CORPO });

    await empresa.PATCH(req('http://localhost/x'), ctx({ id: 'e1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/empresas/e1', { method: 'PATCH', body: CORPO });

    await empresa.DELETE(req('http://localhost/x'), ctx({ id: 'e1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/empresas/e1', { method: 'DELETE', body: CORPO });
  });

  it('estabelecimentos: lista, contagens, detalhe, criação, edição, remoção e CNAEs', async () => {
    await estabelecimentos.GET(req('http://localhost/x?empresaId=e1&sort=cnpj&dir=asc'));
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      '/fiscal/estabelecimentos?empresaId=e1&sort=cnpj&dir=asc',
      { method: 'GET' },
    );
    await estabelecimentos.POST(req('http://localhost/x'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos', { method: 'POST', body: CORPO });

    await contagens.GET(req('http://localhost/x?situacao=REVIEW'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/contagens?situacao=REVIEW', { method: 'GET' });

    await estabelecimento.GET(req('http://localhost/x'), ctx({ id: 's1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/s1', { method: 'GET' });
    await estabelecimento.PATCH(req('http://localhost/x'), ctx({ id: 's1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/s1', { method: 'PATCH', body: CORPO });
    await estabelecimento.DELETE(req('http://localhost/x'), ctx({ id: 's1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/s1', { method: 'DELETE', body: CORPO });

    await cnaes.PUT(req('http://localhost/x'), ctx({ id: 's1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/s1/cnaes', { method: 'PUT', body: CORPO });
  });

  it('repassa 409 e 422 do backend com o corpo intacto (challenge e código de erro)', async () => {
    const challenge = {
      message: 'Confirme a troca',
      codigo: 'TROCA_REGIME_CONFIRMACAO_NECESSARIA',
      regimeAtual: { crt: '3', vigenciaInicio: '2026-01-01' },
      fimProposto: '2026-06-30',
    };
    apiFetchMock.mockResolvedValueOnce(respostaJson(409, challenge));
    const r409 = await acaoRegime.POST(req('http://localhost/x'), ctx({ id: 's1', regimeId: 'r1', acao: 'submeter' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      '/fiscal/estabelecimentos/s1/regimes/r1/submeter',
      { method: 'POST', body: CORPO },
    );
    expect(r409.status).toBe(409);
    expect(await r409.json()).toEqual(challenge);

    const segregacao = { message: 'Segregação', codigo: 'SEGREGACAO_FUNCAO' };
    apiFetchMock.mockResolvedValueOnce(respostaJson(422, segregacao));
    const r422 = await acaoEstabelecimento.POST(req('http://localhost/x'), ctx({ id: 's1', acao: 'aprovar' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/s1/aprovar', { method: 'POST', body: CORPO });
    expect(r422.status).toBe(422);
    expect(await r422.json()).toEqual(segregacao);
  });

  it('ações do estabelecimento: allowlist por verbo', async () => {
    for (const acao of ['submeter', 'aprovar', 'rejeitar', 'suspender', 'reativar']) {
      await acaoEstabelecimento.POST(req('http://localhost/x'), ctx({ id: 's1', acao }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(`/fiscal/estabelecimentos/s1/${acao}`, { method: 'POST', body: CORPO });
    }
    for (const acao of ['historico', 'pre-condicoes']) {
      await acaoEstabelecimento.GET(req('http://localhost/x'), ctx({ id: 's1', acao }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(`/fiscal/estabelecimentos/s1/${acao}`, { method: 'GET' });
    }
  });

  it('alterações e regimes: criação, edição, descarte/remoção e ações', async () => {
    await alteracoes.POST(req('http://localhost/x'), ctx({ id: 's1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/s1/alteracoes', { method: 'POST', body: CORPO });
    await alteracao.PATCH(req('http://localhost/x'), ctx({ id: 's1', altId: 'a1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/s1/alteracoes/a1', { method: 'PATCH', body: CORPO });
    await alteracao.DELETE(req('http://localhost/x'), ctx({ id: 's1', altId: 'a1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/s1/alteracoes/a1', { method: 'DELETE', body: CORPO });
    for (const acao of ['submeter', 'aprovar', 'rejeitar']) {
      await acaoAlteracao.POST(req('http://localhost/x'), ctx({ id: 's1', altId: 'a1', acao }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(
        `/fiscal/estabelecimentos/s1/alteracoes/a1/${acao}`,
        { method: 'POST', body: CORPO },
      );
    }

    await regimes.POST(req('http://localhost/x'), ctx({ id: 's1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/s1/regimes', { method: 'POST', body: CORPO });
    await regime.PATCH(req('http://localhost/x'), ctx({ id: 's1', regimeId: 'r1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/s1/regimes/r1', { method: 'PATCH', body: CORPO });
    await regime.DELETE(req('http://localhost/x'), ctx({ id: 's1', regimeId: 'r1' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/s1/regimes/r1', { method: 'DELETE', body: CORPO });
    for (const acao of ['aprovar', 'rejeitar']) {
      await acaoRegime.POST(req('http://localhost/x'), ctx({ id: 's1', regimeId: 'r1', acao }));
      expect(apiFetchMock).toHaveBeenLastCalledWith(
        `/fiscal/estabelecimentos/s1/regimes/r1/${acao}`,
        { method: 'POST', body: CORPO },
      );
    }
  });

  it('ação fora da allowlist → 404 sem chamar o backend', async () => {
    const casos: Array<Promise<Response>> = [
      acaoEstabelecimento.POST(req('http://localhost/x'), ctx({ id: 's1', acao: 'excluir-tudo' })),
      acaoEstabelecimento.POST(req('http://localhost/x'), ctx({ id: 's1', acao: 'historico' })),
      acaoEstabelecimento.GET(req('http://localhost/x'), ctx({ id: 's1', acao: 'aprovar' })),
      acaoAlteracao.POST(req('http://localhost/x'), ctx({ id: 's1', altId: 'a1', acao: 'suspender' })),
      acaoRegime.POST(req('http://localhost/x'), ctx({ id: 's1', regimeId: 'r1', acao: 'reativar' })),
    ];
    for (const resposta of await Promise.all(casos)) {
      expect(resposta.status).toBe(404);
    }
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('identificadores de rota são codificados no caminho do backend', async () => {
    await estabelecimento.GET(req('http://localhost/x'), ctx({ id: '../admin' }));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/..%2Fadmin', { method: 'GET' });
  });

  it('CSV mantém text/csv e Content-Disposition do backend', async () => {
    const csv = '\uFEFFEstabelecimento;CNPJ\r\nMatriz;12.345.678/0001-95\r\n';
    apiFetchMock.mockResolvedValueOnce(
      new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="estabelecimentos.csv"',
        },
      }),
    );
    const resposta = await exportacao.GET(req('http://localhost/x?situacao=APPROVED'));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/fiscal/estabelecimentos/exportacao?situacao=APPROVED', { method: 'GET' });
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(resposta.headers.get('content-disposition')).toBe('attachment; filename="estabelecimentos.csv"');
    // bytes crus: `text()` descartaria o BOM que o Excel precisa para ler UTF-8.
    expect(Buffer.from(await resposta.arrayBuffer()).toString('utf8')).toBe(csv);
  });

  it('CSV com erro do backend repassa status e JSON', async () => {
    apiFetchMock.mockResolvedValueOnce(respostaJson(403, { message: 'Sem permissão' }));
    const resposta = await exportacao.GET(req('http://localhost/x'));
    expect(resposta.status).toBe(403);
    expect(resposta.headers.get('content-type')).toContain('application/json');
  });
});
