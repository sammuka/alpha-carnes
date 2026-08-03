import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { CargaEnvio } from '@/lib/expedicao-ui';

export async function GET(req: NextRequest) {
  const dataOperacao = req.nextUrl.searchParams.get('dataOperacao') ?? '';
  const { data, error, status } = await fetchBackend<CargaEnvio[]>(
    `/operacao/expedicao/envio-faturamento?dataOperacao=${encodeURIComponent(dataOperacao)}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
