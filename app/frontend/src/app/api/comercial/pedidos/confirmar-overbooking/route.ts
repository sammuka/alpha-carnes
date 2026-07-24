import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

// BFF: confirma criação com overbooking — preserva status/body (201 ou challenge).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const response = await apiFetch('/comercial/pedidos/confirmar-overbooking', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
