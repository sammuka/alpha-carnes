import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export function GET(req: NextRequest) {
  return repassar(`/fiscal/homologacoes${req.nextUrl.search}`);
}

export async function POST(req: NextRequest) {
  return repassar('/fiscal/homologacoes', { method: 'POST', body: await req.text() });
}
