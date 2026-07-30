import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  const response = await apiFetch(`/precos/tabelas/${id}/copiar`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
