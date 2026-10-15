import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  return repassar(`/contabilidade/centros-custo${req.nextUrl.search}`);
}

export async function POST(req: NextRequest) {
  return repassar('/contabilidade/centros-custo', { method: 'POST', body: await req.text() });
}
