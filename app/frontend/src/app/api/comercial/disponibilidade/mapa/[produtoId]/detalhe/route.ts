import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { DetalheMapa } from '@/lib/mapa-disponibilidade';

type Ctx = { params: Promise<{ produtoId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { produtoId } = await ctx.params;
  const qs = req.nextUrl.searchParams.toString();
  const { data, error, status } = await fetchBackend<DetalheMapa[]>(
    `/comercial/disponibilidade/mapa/${produtoId}/detalhe${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
