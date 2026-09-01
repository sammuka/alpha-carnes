import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { DisponibilidadeDia } from '@/lib/comercial';

// BFF: lê o saldo virtual (RA-01 — cliente nunca chama o backend direto).
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const suffix = qs ? `?${qs}` : '';
  const { data, error, status } = await fetchBackend<DisponibilidadeDia[]>(`/comercial/disponibilidade${suffix}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
