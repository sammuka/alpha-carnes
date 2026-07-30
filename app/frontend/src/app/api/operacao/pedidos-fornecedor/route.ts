import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, fetchBackend } from '@/lib/api';
import type { PedidoFornecedorDetalhe } from '@/lib/operacao';

async function responderBruto(upstream: Response) {
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  return responderBruto(await apiFetch(
    `/operacao/pedidos-fornecedor${qs ? `?${qs}` : ''}`,
  ));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error, status } = await fetchBackend<PedidoFornecedorDetalhe>(
    '/operacao/pedidos-fornecedor',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
