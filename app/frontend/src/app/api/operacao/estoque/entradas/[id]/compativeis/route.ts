import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return repassar(`/estoque/entradas/${id}/compativeis`);
}
