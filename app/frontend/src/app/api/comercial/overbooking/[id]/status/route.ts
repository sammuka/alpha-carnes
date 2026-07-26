import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/comercial/overbooking/${id}/status`, {
    method: 'PATCH',
    body: await req.text(),
  });
}
