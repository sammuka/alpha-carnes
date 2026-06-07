import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { Peca } from '@/lib/operacao';

// BFF: registra a pesagem de uma peça (captura conforme ADR-009 no backend).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error, status } = await fetchBackend<Peca>('/operacao/pesagem/pecas', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
