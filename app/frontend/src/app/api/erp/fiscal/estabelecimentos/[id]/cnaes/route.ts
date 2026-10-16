import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/fiscal/estabelecimentos/${encodeURIComponent(id)}/cnaes`, {
    method: 'PUT',
    body: await req.text(),
  });
}
