import { CadastroFormPage } from '../../../_components/cadastro-form-page';

export default async function EditarCadastroPage(props: {
  params: Promise<{ recurso: string; id: string }>;
}) {
  const { recurso, id } = await props.params;
  return <CadastroFormPage recurso={recurso} registroId={id} />;
}
