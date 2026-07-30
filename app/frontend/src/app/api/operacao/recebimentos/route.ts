import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

async function responderBruto(upstream: Response) {
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search;
  return responderBruto(await apiFetch(`/operacao/recebimentos${qs}`));
}

// BFF: inicia recebimento (deriva itens esperados no backend).
export async function POST(req: NextRequest) {
  const body = await req.text();
  return responderBruto(await apiFetch('/operacao/recebimentos', {
    method: 'POST',
    body,
  }));
}
