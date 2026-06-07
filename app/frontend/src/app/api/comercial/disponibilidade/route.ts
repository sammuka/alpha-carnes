import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { DisponibilidadeDia } from '@/lib/comercial';

// BFF: lê o saldo virtual do dia (RA-01 — cliente nunca chama o backend direto).
export async function GET(req: NextRequest) {
  const dataOperacao = req.nextUrl.searchParams.get('dataOperacao');
  const qs = dataOperacao ? `?dataOperacao=${encodeURIComponent(dataOperacao)}` : '';
  const { data, error, status } = await fetchBackend<DisponibilidadeDia[]>(`/comercial/disponibilidade${qs}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
