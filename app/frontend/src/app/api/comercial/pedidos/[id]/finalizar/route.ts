import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const { data, error, status } = await fetchBackend<unknown>(`/comercial/pedidos/${id}/finalizar`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
