import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

// BFF: cancelamento de etiqueta. O 409 de carga fechada / estado terminal passa íntegro.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const upstream = await apiFetch(`/operacao/etiquetas/${id}/cancelar`, {
    method: 'POST',
    body: await req.text(),
  });
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
