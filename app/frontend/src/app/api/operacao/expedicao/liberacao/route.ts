import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export interface CaminhaoLiberacao {
  id: string;
  placa: string;
  motorista: string;
  rota: string | null;
  statusCaminhao: string;
  dataOperacao: string;
  statusFaturamento: string | null;
}

export async function GET(req: NextRequest) {
  const dataOperacao = req.nextUrl.searchParams.get('dataOperacao') ?? '';
  const { data, error, status } = await fetchBackend<CaminhaoLiberacao[]>(
    `/operacao/expedicao/liberacao?dataOperacao=${encodeURIComponent(dataOperacao)}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
