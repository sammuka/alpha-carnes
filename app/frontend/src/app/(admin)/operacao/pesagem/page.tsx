import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { PesagemClient } from './pesagem-client';

// Server component: resolve as permissões efetivas (backend) e passa ao client,
// que usa-as para gatear ações (peso manual, associação, etiqueta) — RA-01.
export default async function PesagemPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <PesagemClient permissoes={user.permissoes} />;
}
