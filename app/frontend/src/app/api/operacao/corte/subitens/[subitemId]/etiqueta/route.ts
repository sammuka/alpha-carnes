import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { Subitem } from '@/lib/operacao';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ subitemId: string }> }) {
  const { subitemId } = await params;
  const { data, error, status } = await fetchBackend<{ subitem: Subitem }>(
    `/operacao/corte/subitens/${subitemId}/etiqueta`,
    { method: 'POST', body: '{}' },
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
