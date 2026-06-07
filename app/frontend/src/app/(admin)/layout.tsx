import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';

// Itens de menu dos cadastros base — cada um exige a permissão de leitura correspondente.
const CADASTROS_MENU = [
  { recurso: 'clientes', rotulo: 'Clientes', permissao: 'CLIENTES_LER' },
  { recurso: 'fornecedores', rotulo: 'Fornecedores', permissao: 'FORNECEDORES_LER' },
  { recurso: 'itens-compra', rotulo: 'Itens de Compra', permissao: 'ITENS_COMPRA_LER' },
  { recurso: 'itens-comerciais', rotulo: 'Itens Comerciais', permissao: 'ITENS_COMERCIAIS_LER' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getMe();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card p-4">
        <h2 className="mb-6 text-lg font-bold text-foreground">AlphaCarnes</h2>
        <nav className="space-y-1">
          <a href="/admin" className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Dashboard
          </a>
          {/* Cadastros base (F2) — cada link é gated pela permissão de leitura correspondente */}
          {CADASTROS_MENU.map(
            (item) =>
              user.permissoes.includes(item.permissao) && (
                <a
                  key={item.recurso}
                  href={`/cadastros/${item.recurso}`}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {item.rotulo}
                </a>
              ),
          )}
          {/* Operação (F4a) — gated pela permissão de leitura de recebimento */}
          {user.permissoes.includes('RECEBIMENTO_LER') && (
            <a
              href="/operacao/recebimento"
              className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Recebimento
            </a>
          )}
          {/* Operação (F4b) — gated pela permissão de leitura de pesagem */}
          {user.permissoes.includes('PESAGEM_LER') && (
            <a
              href="/operacao/pesagem"
              className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Pesagem
            </a>
          )}
          {/* Gating de menu por permissão efetiva — vinda de /auth/me (backend) */}
          {user.permissoes.includes('AUDITORIA_VISUALIZAR') && (
            <a href="/admin/auditoria" className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
              Auditoria
            </a>
          )}
        </nav>
      </aside>
      {/* Main */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
