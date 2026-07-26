import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { rotaDeEntrada } from '@/lib/menu-v2';

export default async function EntradaPage() {
  const user = await getMe();
  if (!user) redirect('/login');

  const rota = rotaDeEntrada(user.menusVisiveis, user.perfis);
  if (rota) redirect(rota);

  return (
    <section className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-center">
      <h1 className="text-base font-semibold text-foreground">Nenhum módulo liberado</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Seu perfil ainda não tem módulos liberados. Solicite acesso ao administrador.
      </p>
    </section>
  );
}
