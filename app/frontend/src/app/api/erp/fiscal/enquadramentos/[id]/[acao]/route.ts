import { NextResponse, type NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

const POSTS = new Set(['duplicar', 'inativar', 'reativar']);
const GETS = new Set(['historico', 'pre-condicoes']);

type Ctx = { params: Promise<{ id: string; acao: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id, acao } = await ctx.params;
  if (!GETS.has(acao)) return new NextResponse(null, { status: 404 });
  return repassar(`/fiscal/enquadramentos/${encodeURIComponent(id)}/${acao}`);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id, acao } = await ctx.params;
  if (!POSTS.has(acao)) return new NextResponse(null, { status: 404 });
  return repassar(`/fiscal/enquadramentos/${encodeURIComponent(id)}/${acao}`, {
    method: 'POST',
    body: await req.text(),
  });
}
