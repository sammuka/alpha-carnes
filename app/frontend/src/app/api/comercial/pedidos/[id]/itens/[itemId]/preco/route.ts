import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

function repassar(response: Response): NextResponse {
  const headers = new Headers();
  const contentType = response.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(response.body, { status: response.status, headers });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, itemId } = await ctx.params;
  const body = await req.json();
  const response = await apiFetch(`/comercial/pedidos/${id}/itens/${itemId}/preco`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return repassar(response);
}
