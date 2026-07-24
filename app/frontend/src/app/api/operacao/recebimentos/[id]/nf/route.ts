import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

// BFF: rota exposta como /nf (plano onda1); backend persiste em /nfe.
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
