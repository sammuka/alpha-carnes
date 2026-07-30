import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

// BFF: confirma o adendo com overbooking — preserva status e corpo (RA-01).
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  const response = await apiFetch(`/comercial/pedidos/${id}/adendos/confirmar-overbooking`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
