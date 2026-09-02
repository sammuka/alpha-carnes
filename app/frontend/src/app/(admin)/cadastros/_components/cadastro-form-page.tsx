import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { fetchBackend } from '@/lib/api';
import { CADASTROS, configCadastroParaCliente } from '@/lib/cadastros-config';
import { CadastroForm } from '@/components/cadastro-form';

export async function CadastroFormPage({
  recurso,
  registroId,
}: {
  recurso: string;
  registroId?: string;
}) {
  const config = CADASTROS[recurso];
  if (!config) notFound();

  const user = await getMe();
  if (!user) redirect('/login');

  const permissao = config.permissaoGerenciar;
  const acao = registroId ? 'editar' : 'criar';
  if (!user.permissoes.includes(permissao)) {
    return (
      <p className="text-sm text-destructive">
        Você não tem permissão para {acao} {config.titulo}.
      </p>
    );
  }

  if (!registroId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Novo — {config.titulo}</h1>
        <CadastroForm config={configCadastroParaCliente(config)} />
      </div>
    );
  }

  const { data, error } = await fetchBackend<Record<string, unknown> & { id: string }>(
    `/${recurso}/${registroId}`,
  );
  if (error || !data) {
    return <p className="text-sm text-destructive">Registro não encontrado: {error ?? 'desconhecido'}</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Editar — {config.titulo}</h1>
      <CadastroForm config={configCadastroParaCliente(config)} registro={data} />
    </div>
  );
}
