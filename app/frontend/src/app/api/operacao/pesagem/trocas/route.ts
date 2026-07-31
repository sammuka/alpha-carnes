import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

// BFF: Troca de Peça (v1.1 §6.13). Repasse puro — a atomicidade é do backend (RA-01).
export async function POST(req: NextRequest) {
  const upstream = await apiFetch('/operacao/pesagem/trocas', {
    method: 'POST',
    body: await req.text(),
  });
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
