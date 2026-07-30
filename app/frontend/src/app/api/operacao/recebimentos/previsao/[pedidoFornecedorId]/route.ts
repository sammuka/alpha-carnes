import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

type Ctx = { params: Promise<{ pedidoFornecedorId: string }> };

async function responderBruto(upstream: Response) {
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { pedidoFornecedorId } = await ctx.params;
  return responderBruto(await apiFetch(
    `/operacao/recebimentos/previsao/${pedidoFornecedorId}`,
  ));
}
