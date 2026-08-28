import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { CADASTROS } from '@/lib/cadastros-config';
import { CadastroForm } from '@/components/cadastro-form';

export default async function NovoCadastroPage(props: { params: Promise<{ recurso: string }> }) {
  const { recurso } = await props.params;
  const config = CADASTROS[recurso];
  if (!config) notFound();

  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes(config.permissaoGerenciar)) {
    return <p className="text-sm text-destructive">Você não tem permissão para criar {config.titulo}.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Novo — {config.titulo}</h1>
      <CadastroForm recurso={recurso} />
    </div>
  );
}
