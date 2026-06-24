import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { PrevisaoRecebimento } from '@/lib/operacao';

type Ctx = { params: Promise<{ compraId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { compraId } = await ctx.params;
  const { data, error, status } = await fetchBackend<PrevisaoRecebimento>(
    `/operacao/recebimentos/previsao/${compraId}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
