import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import { CADASTROS } from '@/lib/cadastros-config';

// BFF para edição de cadastros (PATCH por id).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ recurso: string; id: string }> }) {
  const { recurso, id } = await ctx.params;
  if (!CADASTROS[recurso]) {
    return NextResponse.json({ message: 'Recurso desconhecido' }, { status: 404 });
  }
  const body = await req.json();
  const { data, error, status } = await fetchBackend(`/${recurso}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
