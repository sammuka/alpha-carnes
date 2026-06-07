import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

// BFF: registra/concilia item recebido (divergência inline quando há diferença).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend<{ itemId: string }>(`/operacao/recebimentos/${id}/itens`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
