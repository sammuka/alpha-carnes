import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, itemId } = await ctx.params;
  return repassar(`/comercial/compras-programadas/${id}/itens/${itemId}`, {
    method: 'PATCH',
    body: await req.text(),
  });
}
