import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  return repassar(`/operacao/ocorrencias-fornecedor${req.nextUrl.search}`);
}
