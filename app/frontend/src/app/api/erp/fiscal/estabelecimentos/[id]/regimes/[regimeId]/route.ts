import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string; regimeId: string }> };

function caminho(id: string, regimeId: string): string {
  return `/fiscal/estabelecimentos/${encodeURIComponent(id)}/regimes/${encodeURIComponent(regimeId)}`;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, regimeId } = await ctx.params;
  return repassar(caminho(id, regimeId), { method: 'PATCH', body: await req.text() });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id, regimeId } = await ctx.params;
  return repassar(caminho(id, regimeId), { method: 'DELETE', body: await req.text() });
}
