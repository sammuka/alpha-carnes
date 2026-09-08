import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  return repassar(`/ocorrencias-preco/relatorio${qs ? `?${qs}` : ''}`);
}
