import { CadastroFormPage } from '../../_components/cadastro-form-page';

export default async function NovoCadastroPage(props: { params: Promise<{ recurso: string }> }) {
  const { recurso } = await props.params;
  return <CadastroFormPage recurso={recurso} />;
}
