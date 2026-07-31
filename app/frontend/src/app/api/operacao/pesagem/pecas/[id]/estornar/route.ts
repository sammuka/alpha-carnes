import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

// BFF: estorno de destinação. O 403 de segregação e o 409 de carga fechada passam íntegros.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const upstream = await apiFetch(`/operacao/pesagem/pecas/${id}/estornar`, {
    method: 'POST',
    body: await req.text(),
  });
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
