import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import type { ReduzirItemPedidoBody, RemoverItemPedidoBody } from '@/lib/comercial';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

/** Preserva status/body do backend inclusive quando o sucesso é 204 sem corpo. */
function repassar(response: Response): NextResponse {
  const headers = new Headers();
  const contentType = response.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(response.body, { status: response.status, headers });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, itemId } = await ctx.params;
  const body = await req.json() as ReduzirItemPedidoBody;
  const response = await apiFetch(`/comercial/pedidos/${id}/itens/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return repassar(response);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id, itemId } = await ctx.params;
  const body = await req.json() as RemoverItemPedidoBody;
  const response = await apiFetch(`/comercial/pedidos/${id}/itens/${itemId}`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  });
  return repassar(response);
}
