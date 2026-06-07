import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { StatusDispositivos } from '@/lib/operacao';

// BFF: status dos dispositivos de hardware (RA-05 visível).
export async function GET() {
  const { data, error, status } = await fetchBackend<StatusDispositivos>('/operacao/pesagem/dispositivos/status');
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
