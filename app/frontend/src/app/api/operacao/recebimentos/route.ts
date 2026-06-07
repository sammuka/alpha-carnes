import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { IniciarRecebimentoResultado } from '@/lib/operacao';

// BFF: lista recebimentos (RA-01 — cliente nunca chama o backend direto).
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search;
  const { data, error, status } = await fetchBackend<unknown>(`/operacao/recebimentos${qs}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

// BFF: inicia recebimento (deriva itens esperados no backend).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error, status } = await fetchBackend<IniciarRecebimentoResultado>('/operacao/recebimentos', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
