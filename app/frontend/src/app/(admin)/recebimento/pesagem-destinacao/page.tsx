import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { PesagemDestinacaoClient } from './pesagem-destinacao-client';

export default async function PesagemDestinacaoPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  if (!user.permissoes.includes('PESAGEM_LER')) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar pesagem.</p>;
  }

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando pesagem…</p>}>
      <PesagemDestinacaoClient permissoes={user.permissoes} />
    </Suspense>
  );
}
