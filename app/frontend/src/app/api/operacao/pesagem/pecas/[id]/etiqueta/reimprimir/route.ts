import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

// BFF: reimpressão auditada da etiqueta (RF-PS-24).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error, status } = await fetchBackend(`/operacao/pesagem/pecas/${id}/etiqueta/reimprimir`, { method: 'POST' });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
