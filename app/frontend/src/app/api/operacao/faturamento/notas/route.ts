import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { NotaFiscalListagem, Paginado } from '@/lib/faturamento';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search;
  const { data, error, status } = await fetchBackend<Paginado<NotaFiscalListagem>>(`/operacao/faturamento/notas${qs}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
