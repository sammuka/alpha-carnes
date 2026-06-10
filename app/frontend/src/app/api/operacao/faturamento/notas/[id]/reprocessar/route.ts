import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // caminhaoId derivado da NF no backend — body vazio
  const { data, error, status } = await fetchBackend(
    `/operacao/faturamento/notas/${id}/reprocessar`,
    { method: 'POST', body: '{}' },
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
