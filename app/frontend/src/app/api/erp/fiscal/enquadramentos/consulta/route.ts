import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function POST(req: NextRequest) {
  return repassar('/fiscal/enquadramentos/consulta', { method: 'POST', body: await req.text() });
}
