import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { Paginado, SeguroCargaComCaminhao } from '@/lib/faturamento';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search;
  const { data, error, status } = await fetchBackend<Paginado<SeguroCargaComCaminhao>>(
    `/operacao/faturamento/seguros${qs}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error, status } = await fetchBackend('/operacao/faturamento/seguros', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
