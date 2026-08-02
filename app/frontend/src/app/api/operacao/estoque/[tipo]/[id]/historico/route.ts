import { repassar } from '@/lib/bff';

type Ctx = { params: Promise<{ tipo: string; id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { tipo, id } = await ctx.params;
  return repassar(`/estoque/${tipo}/${id}/historico`);
}
