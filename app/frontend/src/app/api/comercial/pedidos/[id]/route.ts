import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { PedidoVendaDetalhe } from '@/lib/comercial';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const { data, error, status } = await fetchBackend<PedidoVendaDetalhe>(`/comercial/pedidos/${id}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const { data, error, status } = await fetchBackend<unknown>(`/comercial/pedidos/${id}`, { method: 'DELETE' });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
