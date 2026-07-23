import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const { data, error, status } = await fetchBackend(
    `/operacao/expedicao/caminhoes/${id}/conferencia/concluir`,
    { method: 'POST', body: '{}' },
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
