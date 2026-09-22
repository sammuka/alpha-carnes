import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { FaltaDesossa } from '@/lib/desossa';

export async function GET(req: NextRequest) {
  const recebimentoId = req.nextUrl.searchParams.get('recebimentoId');
  const path = recebimentoId
    ? `/desossa/faltas?recebimentoId=${encodeURIComponent(recebimentoId)}`
    : '/desossa/faltas';
  const { data, error, status } = await fetchBackend<FaltaDesossa[]>(path);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
