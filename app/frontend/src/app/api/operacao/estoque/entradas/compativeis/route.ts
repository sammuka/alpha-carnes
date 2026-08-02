import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  const qs = new URL(req.url).searchParams.toString();
  return repassar(`/estoque/entradas/compativeis${qs ? `?${qs}` : ''}`);
}
