import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { TabelaPrecoDetalhe } from '@/lib/precos';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const { data, error, status } = await fetchBackend<TabelaPrecoDetalhe>(`/precos/tabelas/${id}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
