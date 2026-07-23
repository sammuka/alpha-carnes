import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { CompraProgramadaDetalhe } from '@/lib/comercial';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, itemId } = await ctx.params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend<CompraProgramadaDetalhe>(
    `/comercial/compras-programadas/${id}/itens/${itemId}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
