import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { NotaFiscal } from '@/lib/faturamento';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend<NotaFiscal>(
    `/operacao/faturamento/caminhoes/${id}/emitir`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
