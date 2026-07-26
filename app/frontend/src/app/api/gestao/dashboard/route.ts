import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  const operacaoId = req.nextUrl.searchParams.get('operacaoId');
  const qs = operacaoId ? `?operacaoId=${encodeURIComponent(operacaoId)}` : '';
  return repassar(`/gestao/dashboard${qs}`);
}
