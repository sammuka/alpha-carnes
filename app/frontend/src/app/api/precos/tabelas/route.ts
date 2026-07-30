import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, fetchBackend } from '@/lib/api';
import type { Paginado } from '@/lib/comercial';
import type { TabelaPreco } from '@/lib/precos';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const { data, error, status } = await fetchBackend<Paginado<TabelaPreco>>(
    `/precos/tabelas${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const response = await apiFetch('/precos/tabelas', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
