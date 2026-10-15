import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  return repassar(`/contabilidade/politicas${req.nextUrl.search}`);
}

export async function POST(req: NextRequest) {
  return repassar('/contabilidade/politicas', { method: 'POST', body: await req.text() });
}
