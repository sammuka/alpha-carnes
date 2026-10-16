import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

function caminho(id: string): string {
  return `/fiscal/regras/${encodeURIComponent(id)}`;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(caminho(id));
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(caminho(id), { method: 'PATCH', body: await req.text() });
}
