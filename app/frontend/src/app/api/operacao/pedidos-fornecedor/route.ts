import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { Paginado } from '@/lib/comercial';
import type { PedidoFornecedor, PedidoFornecedorDetalhe } from '@/lib/operacao';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const { data, error, status } = await fetchBackend<Paginado<PedidoFornecedor>>(
    `/operacao/pedidos-fornecedor${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
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
