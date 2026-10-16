import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

/** Preserva o CSV da memória (BOM inclusive) e o JSON de erro do backend. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const resposta = await apiFetch(`/fiscal/simulacoes/${encodeURIComponent(id)}/memoria`, { method: 'GET' });
  const bytes = await resposta.arrayBuffer();
  const headers = new Headers();
  const tipo = resposta.headers.get('content-type');
  if (tipo) headers.set('Content-Type', tipo);
  const disposicao = resposta.headers.get('content-disposition');
  if (disposicao) headers.set('Content-Disposition', disposicao);
  return new NextResponse(bytes, { status: resposta.status, headers });
}
