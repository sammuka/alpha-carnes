import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { ResultadoSugestao } from '@/lib/operacao';

type Ctx = { params: Promise<{ recebimentoId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { recebimentoId } = await ctx.params;
  const produtoBaseId = req.nextUrl.searchParams.get('produtoBaseId') ?? '';
  const incluirCompletos = req.nextUrl.searchParams.get('incluirCompletos');
  const qs = new URLSearchParams({ produtoBaseId });
  if (incluirCompletos) qs.set('incluirCompletos', incluirCompletos);
  const { data, error, status } = await fetchBackend<ResultadoSugestao>(
    `/operacao/pesagem/recebimentos/${recebimentoId}/compativeis?${qs.toString()}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
