import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ recebimentoId: string }> };

/** Encaminha pedidos compatíveis do lote. O cache-buster `t` não vai ao backend (schema Zod). */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { recebimentoId } = await ctx.params;
  const origem = new URL(req.url).searchParams;
  const qs = new URLSearchParams();
  const produtoBaseId = origem.get('produtoBaseId');
  if (produtoBaseId) qs.set('produtoBaseId', produtoBaseId);
  const incluirCompletos = origem.get('incluirCompletos');
  if (incluirCompletos) qs.set('incluirCompletos', incluirCompletos);
  const suffix = qs.toString();
  return repassar(
    `/operacao/pesagem/recebimentos/${recebimentoId}/compativeis${suffix ? `?${suffix}` : ''}`,
  );
}
