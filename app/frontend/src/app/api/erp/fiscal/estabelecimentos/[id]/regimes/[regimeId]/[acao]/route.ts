import { NextResponse, type NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

const POSTS = new Set(['submeter', 'aprovar', 'rejeitar']);

type Ctx = { params: Promise<{ id: string; regimeId: string; acao: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id, regimeId, acao } = await ctx.params;
  if (!POSTS.has(acao)) return new NextResponse(null, { status: 404 });
  return repassar(
    `/fiscal/estabelecimentos/${encodeURIComponent(id)}/regimes/${encodeURIComponent(regimeId)}/${acao}`,
    { method: 'POST', body: await req.text() },
  );
}
