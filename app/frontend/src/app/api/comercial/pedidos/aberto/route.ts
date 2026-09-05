import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

interface PedidoAberto {
  pedidoId: string;
  status: string;
  produtoId: string;
  quantidadeAtual: string;
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const { data, error, status } = await fetchBackend<PedidoAberto | null>(
    `/comercial/pedidos/aberto${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
