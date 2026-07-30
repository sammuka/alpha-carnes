import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, fetchBackend } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const { data, error, status } = await fetchBackend<unknown[]>(`/comercial/pedidos/${id}/adendos`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

// BFF: registra adendo — preserva status e corpo do 409 de overbooking (RA-01).
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  const response = await apiFetch(`/comercial/pedidos/${id}/adendos`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
