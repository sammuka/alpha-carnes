import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { data, error, status } = await fetchBackend(`/regras-desdobramento/${id}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend(`/regras-desdobramento/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { data, error, status } = await fetchBackend(`/regras-desdobramento/${id}`, {
    method: 'DELETE',
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data ?? { ok: true }, { status: 200 });
}
