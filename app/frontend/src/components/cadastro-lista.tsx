import Link from 'next/link';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import type { CadastroConfig } from '@/lib/cadastros-config';
import type { Paginado } from '@/lib/cadastros';

interface CadastroListaProps {
  config: CadastroConfig;
  resultado: Paginado<Record<string, unknown>> | null;
  erro: string | null;
  podeGerenciar: boolean;
  page: number;
}

/**
 * Tabela de listagem de um cadastro, com estados de erro e vazio.
 *
 * Server component (sem estado React) — não pode importar Input/Button/Table
 * (client components), então as classes do DS v3 são copiadas literalmente.
 */
export function CadastroLista({ config, resultado, erro, podeGerenciar, page }: CadastroListaProps) {
  const totalPaginas = resultado ? Math.ceil(resultado.total / resultado.pageSize) : 0;

  return (
    <div className="space-y-3">
      <PageHeader title={config.titulo}>
        {podeGerenciar && (
          <Link
            href={`/cadastros/${config.recurso}/novo`}
            className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent bg-primary px-3 text-[13px] font-semibold text-primary-foreground shadow-1 outline-none transition-colors duration-100 hover:bg-primary-hover active:bg-primary-active focus-visible:ring-[3px] focus-visible:ring-ring/35"
          >
            Novo
          </Link>
        )}
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Erro ao carregar {config.titulo.toLowerCase()}: {erro}
        </div>
      )}

      <div className="flex flex-col rounded-lg border border-border bg-card text-card-foreground shadow-1">
        <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-border px-3">
          {/* Filtro de busca (GET — server-side) — R6 */}
          <form method="get" className="flex w-full items-center gap-1.5">
            <div className="relative flex w-[240px] items-center">
              <span className="pointer-events-none absolute left-2.5 flex items-center text-fg-faint [&_svg]:size-3.5">
                <Search />
              </span>
              <input
                type="text"
                name="search"
                aria-label="Buscar"
                placeholder="Buscar..."
                className="flex h-8 w-full min-w-0 rounded-md border border-input bg-card py-0 pr-2.5 pl-8 text-[13px] text-foreground transition-[color,border-color,box-shadow] duration-100 outline-none placeholder:text-fg-faint selection:bg-primary selection:text-primary-foreground hover:not-focus:not-disabled:border-fg-faint focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border-strong bg-card px-3 text-[13px] font-semibold text-foreground shadow-1 outline-none transition-colors duration-100 hover:border-fg-faint hover:bg-surface-2 active:bg-surface-3 focus-visible:ring-[3px] focus-visible:ring-ring/35"
            >
              Buscar
            </button>
          </form>
        </div>

        <div className="p-0">
          {/* Estado vazio */}
          {!erro && (!resultado || resultado.data.length === 0) ? (
            <div className="p-3">
              <EmptyState title="Nenhum registro encontrado." />
            </div>
          ) : (
            !erro &&
            resultado && (
              <div data-slot="table-container" className="relative w-full overflow-x-auto">
                <table className="w-full caption-bottom text-xs">
                  <thead className="[&_tr]:border-b [&_tr]:border-border">
                    <tr className="border-b border-border transition-colors duration-100 hover:bg-transparent">
                      {config.colunas.map((col) => (
                        <th
                          key={col.campo}
                          className="sticky top-0 z-10 h-[30px] whitespace-nowrap bg-surface-2 px-2.5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground"
                        >
                          {col.rotulo}
                        </th>
                      ))}
                      {podeGerenciar && (
                        <th className="sticky top-0 z-10 h-[30px] whitespace-nowrap bg-surface-2 px-2.5 text-left align-middle text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                          Ações
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {resultado.data.map((linha) => (
                      <tr
                        key={String(linha.id)}
                        className="group border-b border-border transition-colors duration-100 hover:bg-surface-2"
                      >
                        {config.colunas.map((col) => (
                          <td key={col.campo} className="h-9 whitespace-nowrap px-2.5 py-0.5 align-middle">
                            {String(linha[col.campo] ?? '')}
                          </td>
                        ))}
                        {podeGerenciar && (
                          <td className="h-9 whitespace-nowrap px-2.5 py-0.5 align-middle">
                            <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <Link
                                href={`/cadastros/${config.recurso}/${String(linha.id)}/editar`}
                                className="inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2.5 text-xs font-semibold text-fg-secondary outline-none transition-colors duration-100 hover:bg-surface-3 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35"
                              >
                                Editar
                              </Link>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* Paginação simples */}
        {resultado && resultado.total > resultado.pageSize && (
          <div className="flex items-center gap-2 border-t border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">
              Página {resultado.page} de {totalPaginas}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/cadastros/${config.recurso}?page=${page - 1}`}
                  className="inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border-strong bg-card px-2.5 text-xs font-semibold text-foreground shadow-1 outline-none transition-colors duration-100 hover:border-fg-faint hover:bg-surface-2 active:bg-surface-3 focus-visible:ring-[3px] focus-visible:ring-ring/35"
                >
                  Anterior
                </Link>
              )}
              {page < totalPaginas && (
                <Link
                  href={`/cadastros/${config.recurso}?page=${page + 1}`}
                  className="inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border-strong bg-card px-2.5 text-xs font-semibold text-foreground shadow-1 outline-none transition-colors duration-100 hover:border-fg-faint hover:bg-surface-2 active:bg-surface-3 focus-visible:ring-[3px] focus-visible:ring-ring/35"
                >
                  Próximo
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
