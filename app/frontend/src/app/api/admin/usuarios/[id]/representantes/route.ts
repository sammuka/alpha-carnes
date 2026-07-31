import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

type Contexto = { params: Promise<{ id: string }> };

export async function PUT(
  request: NextRequest,
  contexto: Contexto,
): Promise<NextResponse> {
  const { id } = await contexto.params;
  const contentType = request.headers.get('content-type') ?? 'application/json';
  const resposta = await apiFetch(
    `/usuarios/${encodeURIComponent(id)}/representantes`,
    {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: await request.arrayBuffer(),
    },
  );

  const headers = new Headers();
  const responseContentType = resposta.headers.get('content-type');
  if (responseContentType) headers.set('Content-Type', responseContentType);
  return new NextResponse(resposta.body, {
    status: resposta.status,
    headers,
  });
}
