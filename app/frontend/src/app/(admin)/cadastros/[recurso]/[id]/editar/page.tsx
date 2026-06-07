import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { fetchBackend } from '@/lib/api';
import { CADASTROS } from '@/lib/cadastros-config';
import { CadastroForm } from '@/components/cadastro-form';

export default async function EditarCadastroPage(props: {
  params: Promise<{ recurso: string; id: string }>;
}) {
  const { recurso, id } = await props.params;
  const config = CADASTROS[recurso];
  if (!config) notFound();

  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes(config.permissaoGerenciar)) {
    return <p className="text-sm text-destructive">Você não tem permissão para editar {config.titulo}.</p>;
  }

  const { data, error } = await fetchBackend<Record<string, unknown> & { id: string }>(`/${recurso}/${id}`);
  if (error || !data) {
    return <p className="text-sm text-destructive">Registro não encontrado: {error ?? 'desconhecido'}</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Editar — {config.titulo}</h1>
      <CadastroForm config={config} registro={data} />
    </div>
  );
}
