import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { Peca } from '@/lib/operacao';

// BFF: resolve um QR numa peça real (manual exige LEITURA_MANUAL no backend).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error, status } = await fetchBackend<Peca>('/operacao/pesagem/qr/resolver', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
