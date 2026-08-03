import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { AmbienteFiscal } from '@/lib/faturamento';

export async function GET() {
  const { data, error, status } = await fetchBackend<AmbienteFiscal>('/operacao/faturamento/ambiente');
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
