import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, fetchBackend } from '@/lib/api';
import type { Paginado, PedidoVenda } from '@/lib/comercial';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const { data, error, status } = await fetchBackend<Paginado<PedidoVenda>>(
    `/comercial/pedidos${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

// BFF: cria pedido (a reserva atômica acontece no backend — RA-01).
// Preserva status e body do challenge 409 / sucesso 201.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const response = await apiFetch('/comercial/pedidos', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
