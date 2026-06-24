'use client';

import { CadastroMasterDetail } from '@/components/cadastro-master-detail';
import { fornecedoresConfig } from '@/lib/cadastros-config';

export function FornecedoresClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const { schema: _s, ...config } = fornecedoresConfig;
  void _s;

  return (
    <CadastroMasterDetail
      config={config}
      tituloPagina="Fornecedores / Frigoríficos"
      subtitulo="Cadastro de fornecedores e parâmetros operacionais"
      podeGerenciar={podeGerenciar}
    />
  );
}
