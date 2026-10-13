import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/fiscal/empresas/${encodeURIComponent(id)}`, { method: 'PATCH', body: await req.text() });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/fiscal/empresas/${encodeURIComponent(id)}`, { method: 'DELETE', body: await req.text() });
}
