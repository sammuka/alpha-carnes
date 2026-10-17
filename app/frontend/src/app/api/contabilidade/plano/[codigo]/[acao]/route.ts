import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ codigo: string; acao: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { codigo, acao } = await ctx.params;
  return repassar(
    `/contabilidade/plano/${encodeURIComponent(codigo)}/${encodeURIComponent(acao)}`,
    { method: 'POST', body: await req.text() },
  );
}
