import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import { CADASTROS } from '@/lib/cadastros-config';

// BFF para listagem de cadastros genéricos.
export async function GET(req: NextRequest, ctx: { params: Promise<{ recurso: string }> }) {
  const { recurso } = await ctx.params;
  if (!CADASTROS[recurso]) {
    return NextResponse.json({ message: 'Recurso desconhecido' }, { status: 404 });
  }
  const qs = req.nextUrl.searchParams.toString();
  const { data, error, status } = await fetchBackend(`/${recurso}${qs ? `?${qs}` : ''}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

// BFF para criação de cadastros: o cliente nunca chama o backend diretamente (RA-01).
export async function POST(req: NextRequest, ctx: { params: Promise<{ recurso: string }> }) {
  const { recurso } = await ctx.params;
  if (!CADASTROS[recurso]) {
    return NextResponse.json({ message: 'Recurso desconhecido' }, { status: 404 });
  }
  const body = await req.json();
  const { data, error, status } = await fetchBackend(`/${recurso}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
