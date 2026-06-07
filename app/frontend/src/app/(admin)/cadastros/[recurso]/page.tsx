import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { listarCadastro } from '@/lib/cadastros';
import { CADASTROS } from '@/lib/cadastros-config';
import { CadastroLista } from '@/components/cadastro-lista';

export default async function ListaCadastroPage(props: {
  params: Promise<{ recurso: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const { recurso } = await props.params;
  const config = CADASTROS[recurso];
  if (!config) notFound();

  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes(config.permissaoLer)) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar {config.titulo}.</p>;
  }

  const sp = await props.searchParams;
  const page = Number(sp.page ?? '1') || 1;
  const { data, error } = await listarCadastro<Record<string, unknown>>(recurso, { page, search: sp.search });

  return (
    <CadastroLista
      config={config}
      resultado={data}
      erro={error}
      podeGerenciar={user.permissoes.includes(config.permissaoGerenciar)}
      page={page}
    />
  );
}
