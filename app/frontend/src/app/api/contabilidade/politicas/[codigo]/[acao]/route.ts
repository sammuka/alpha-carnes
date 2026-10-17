import { NextRequest, NextResponse } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ codigo: string; acao: string }> };

const ACOES = new Set(['editar', 'simular', 'aprovar']);

export async function POST(req: NextRequest, ctx: Ctx) {
  const { codigo, acao } = await ctx.params;
  if (!ACOES.has(acao)) return new NextResponse(null, { status: 404 });
  return repassar(
    `/contabilidade/politicas/${encodeURIComponent(codigo)}/${encodeURIComponent(acao)}`,
    { method: 'POST', body: await req.text() },
  );
}
