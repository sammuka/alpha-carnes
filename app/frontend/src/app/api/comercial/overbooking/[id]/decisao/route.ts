import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { PendenciaOverbooking } from '@/lib/comercial';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend<PendenciaOverbooking>(
    `/comercial/overbooking/${id}/decisao`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
