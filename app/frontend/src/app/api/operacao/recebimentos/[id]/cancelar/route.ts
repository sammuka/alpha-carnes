import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const { data, error, status } = await fetchBackend<unknown>(`/operacao/recebimentos/${id}/cancelar`, {
    method: 'POST',
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
