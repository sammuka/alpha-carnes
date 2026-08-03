import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { RastreabilidadeNota } from '@/lib/faturamento';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error, status } = await fetchBackend<RastreabilidadeNota>(
    `/operacao/faturamento/notas/${id}/rastreabilidade`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
