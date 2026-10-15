import { NextRequest } from 'next/server';
import { GET } from '@/app/api/contabilidade/politicas/route';
import { PoliticasContabilizacaoClient, type PoliticaApresentada } from './politicas-contabilizacao-client';

export const dynamic = 'force-dynamic';

export default async function PoliticasContabilizacaoPage() {
  const resposta = await GET(new NextRequest('http://interno/api/contabilidade/politicas?pagina=1'));
  if (resposta.status === 403) return <PoliticasContabilizacaoClient inicial={[]} semAcesso />;
  if (!resposta.ok) return <PoliticasContabilizacaoClient inicial={[]} />;
  const corpo = await resposta.json() as { itens?: PoliticaApresentada[] };
  return <PoliticasContabilizacaoClient inicial={corpo.itens ?? []} />;
}
