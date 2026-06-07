import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { ResultadoSugestao } from '@/lib/operacao';

// BFF: sugestão efêmera de associação (RF-PS-08/09/10).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error, status } = await fetchBackend<ResultadoSugestao>(`/operacao/pesagem/pecas/${id}/sugestao`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
