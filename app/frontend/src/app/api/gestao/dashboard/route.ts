import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { DashboardDia } from '@/lib/gestao';

export async function GET(req: NextRequest) {
  const dataOperacao = req.nextUrl.searchParams.get('dataOperacao');
  const qs = dataOperacao ? `?dataOperacao=${encodeURIComponent(dataOperacao)}` : '';
  const { data, error, status } = await fetchBackend<DashboardDia>(`/gestao/dashboard${qs}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
