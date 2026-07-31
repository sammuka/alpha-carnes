import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/gestao/aprovacoes/operacionais/${id}/decidir`, {
    method: 'POST',
    body: await req.text(),
  });
}
