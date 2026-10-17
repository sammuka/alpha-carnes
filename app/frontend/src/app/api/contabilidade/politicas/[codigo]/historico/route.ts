import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ codigo: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { codigo } = await ctx.params;
  return repassar(`/contabilidade/politicas/${encodeURIComponent(codigo)}/historico`);
}
