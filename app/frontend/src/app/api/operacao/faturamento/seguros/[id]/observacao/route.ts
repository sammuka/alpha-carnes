import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend(`/operacao/faturamento/seguros/${id}/observacao`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
