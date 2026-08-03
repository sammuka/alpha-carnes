import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { ChecklistLiberacao } from '@/lib/faturamento';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ caminhaoId: string }> }) {
  const { caminhaoId } = await params;
  const { data, error, status } = await fetchBackend<ChecklistLiberacao>(
    `/operacao/faturamento/liberacao/${caminhaoId}/checklist`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
