import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  return repassar(`/contabilidade/politicas/exportar${req.nextUrl.search}`);
}
