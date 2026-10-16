import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export function GET(req: NextRequest) {
  return repassar(`/fiscal/classificacoes-ibs-cbs${req.nextUrl.search}`);
}

export async function POST(req: NextRequest) {
  return repassar('/fiscal/classificacoes-ibs-cbs', { method: 'POST', body: await req.text() });
}
