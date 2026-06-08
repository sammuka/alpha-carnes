import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { Transformacao } from '@/lib/operacao';

export async function POST(req: NextRequest, { params }: { params: Promise<{ pecaId: string }> }) {
  const { pecaId } = await params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend<Transformacao>(
    `/operacao/corte/pecas/${pecaId}/iniciar`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
