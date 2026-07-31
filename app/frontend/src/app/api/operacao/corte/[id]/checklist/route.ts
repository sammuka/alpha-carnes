import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { data, error, status } = await fetchBackend(`/operacao/corte/${id}/checklist`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status });
}
