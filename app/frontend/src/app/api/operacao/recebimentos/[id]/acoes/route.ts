import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error, status } = await fetchBackend(`/operacao/recebimentos/${id}/acoes`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
