import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/sif/relatorios/${id}/gerar`, { method: 'POST' });
}
