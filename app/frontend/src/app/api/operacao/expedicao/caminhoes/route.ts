import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { Caminhao } from '@/lib/operacao';

export async function GET(req: NextRequest) {
  const dataOperacao = req.nextUrl.searchParams.get('dataOperacao') ?? '';
  const { data, error, status } = await fetchBackend<Caminhao[]>(
    `/operacao/expedicao/caminhoes?dataOperacao=${encodeURIComponent(dataOperacao)}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error, status } = await fetchBackend<Caminhao>('/operacao/expedicao/caminhoes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
