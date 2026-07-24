import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Rota do plano onda1 (/nf). Persistência estruturada via PATCH backend /nfe
 * (atualizarNfe → notas_fiscais_fornecedor). Não é alias pass-through cego:
 * o backend deriva itens do pedido ao fornecedor quando necessário.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend<unknown>(`/operacao/recebimentos/${id}/nfe`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
