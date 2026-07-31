import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

// BFF: matriz linha 16 — GET /operacao/etiquetas?filtros. Query string repassada sem reescrita.
export async function GET(req: NextRequest) {
  const upstream = await apiFetch(`/operacao/etiquetas${req.nextUrl.search}`);
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
