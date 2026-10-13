import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string; altId: string }> };

function caminho(id: string, altId: string): string {
  return `/fiscal/estabelecimentos/${encodeURIComponent(id)}/alteracoes/${encodeURIComponent(altId)}`;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, altId } = await ctx.params;
  return repassar(caminho(id, altId), { method: 'PATCH', body: await req.text() });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id, altId } = await ctx.params;
  return repassar(caminho(id, altId), { method: 'DELETE', body: await req.text() });
}
