import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { ResultadoSugestao } from '@/lib/operacao';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ subitemId: string }> }) {
  const { subitemId } = await params;
  const { data, error, status } = await fetchBackend<ResultadoSugestao>(
    `/operacao/corte/subitens/${subitemId}/sugestao`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
