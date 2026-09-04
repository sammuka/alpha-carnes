import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

/** BFF de clientes: a UI genérica saiu de CADASTROS (D12.1), mas o domínio permanece em /clientes. */
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const { data, error, status } = await fetchBackend(`/clientes${qs ? `?${qs}` : ''}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error, status } = await fetchBackend('/clientes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
