import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { QuadroConferenciaItem } from '@/lib/operacao';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const { data, error, status } = await fetchBackend<QuadroConferenciaItem[]>(
    `/operacao/recebimentos/${id}/conferencia`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
