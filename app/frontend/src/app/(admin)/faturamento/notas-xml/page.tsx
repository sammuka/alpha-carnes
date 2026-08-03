import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { NotasXmlClient } from './notas-xml-client';

export default async function NotasXmlPage() {
  const user = await getMe();
  if (!user) redirect('/login');
  return <NotasXmlClient permissoes={user.permissoes} />;
}
