import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/fiscal/regras/${encodeURIComponent(id)}/comparar${req.nextUrl.search}`);
}
