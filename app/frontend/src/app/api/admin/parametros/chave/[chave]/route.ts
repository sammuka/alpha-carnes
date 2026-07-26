import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ chave: string }> }) {
  const { chave } = await ctx.params;
  const { data, error, status } = await fetchBackend(`/parametros/chave/${chave}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ chave: string }> }) {
  const { chave } = await ctx.params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend(`/parametros/chave/${chave}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
