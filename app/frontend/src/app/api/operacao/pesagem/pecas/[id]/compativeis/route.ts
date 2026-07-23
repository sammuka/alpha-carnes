import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { SugestaoScored } from '@/lib/operacao';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error, status } = await fetchBackend<SugestaoScored[]>(
    `/operacao/pesagem/pecas/${id}/compativeis`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
