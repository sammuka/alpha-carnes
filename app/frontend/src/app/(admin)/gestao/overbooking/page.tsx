import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { OverbookingClient } from './overbooking-client';

export default async function GestaoOverbookingPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <OverbookingClient permissoes={user.permissoes} />;
}
