'use client';

import { CadastroMasterDetail } from '@/components/cadastro-master-detail';
import { clientesConfig } from '@/lib/cadastros-config';

export function ClientesClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const { schema: _s, ...config } = clientesConfig;
  void _s;

  return (
    <CadastroMasterDetail
      config={config}
      tituloPagina="Cadastro de Clientes"
      subtitulo="Gerenciamento de clientes e preferências operacionais"
      podeGerenciar={podeGerenciar}
    />
  );
}
