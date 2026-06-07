import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { Peca } from '@/lib/operacao';

// BFF: destina peça sem cobertura (sobra/análise/corte/divergência — RF-PS-11/21/22).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend<Peca>(`/operacao/pesagem/pecas/${id}/sem-cobertura`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
