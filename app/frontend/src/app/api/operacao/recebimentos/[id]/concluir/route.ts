import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

// BFF: conclui o recebimento (bloqueado no backend se houver divergência aberta).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error, status } = await fetchBackend<unknown>(`/operacao/recebimentos/${id}/concluir`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
