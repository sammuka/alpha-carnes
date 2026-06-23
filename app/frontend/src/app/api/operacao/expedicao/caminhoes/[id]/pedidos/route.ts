import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend(`/operacao/expedicao/caminhoes/${id}/pedidos`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
