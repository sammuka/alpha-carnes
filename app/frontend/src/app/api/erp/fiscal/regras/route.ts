import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export function GET(req: NextRequest) {
  return repassar(`/fiscal/regras${req.nextUrl.search}`);
}

export async function POST(req: NextRequest) {
  return repassar('/fiscal/regras', { method: 'POST', body: await req.text() });
}
