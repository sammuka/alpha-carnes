import { NextRequest } from 'next/server';
import { GET } from '@/app/api/contabilidade/plano/route';
import { PlanoContasClient, type ContaGrade } from './plano-contas-client';

export const dynamic = 'force-dynamic';

export default async function PlanoDeContasPage() {
  const resposta = await GET(new NextRequest('http://interno/api/contabilidade/plano?pagina=1'));
  if (resposta.status === 403) return <PlanoContasClient inicial={[]} semAcesso />;
  if (!resposta.ok) return <PlanoContasClient inicial={[]} />;
  const corpo = await resposta.json() as { itens?: ContaGrade[]; total?: number; contagens?: { revisao: number; suspensos: number } };
  const itens = corpo.itens ?? [];
  return <PlanoContasClient inicial={itens} totalInicial={corpo.total ?? itens.length} contagensIniciais={corpo.contagens ?? null} />;
}
