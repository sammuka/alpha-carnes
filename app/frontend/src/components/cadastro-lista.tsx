import Link from 'next/link';
import type { CadastroConfig } from '@/lib/cadastros-config';
import type { Paginado } from '@/lib/cadastros';

interface CadastroListaProps {
  config: CadastroConfig;
  resultado: Paginado<Record<string, unknown>> | null;
  erro: string | null;
  podeGerenciar: boolean;
  page: number;
}

/** Tabela de listagem de um cadastro, com estados de erro e vazio. */
export function CadastroLista({ config, resultado, erro, podeGerenciar, page }: CadastroListaProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{config.titulo}</h1>
        {podeGerenciar && (
          <Link
            href={`/cadastros/${config.recurso}/novo`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Novo
          </Link>
        )}
      </div>

      {/* Estado de erro */}
      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Erro ao carregar {config.titulo.toLowerCase()}: {erro}
        </div>
      )}

      {/* Filtro de busca (GET — server-side) */}
      <form method="get" className="flex gap-2">
        <input
          type="text"
          name="search"
          aria-label="Buscar"
          placeholder="Buscar..."
          className="h-10 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted">
          Buscar
        </button>
      </form>

      {/* Estado vazio */}
      {!erro && (!resultado || resultado.data.length === 0) ? (
        <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
      ) : (
        !erro &&
        resultado && (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted">
              <tr>
                {config.colunas.map((col) => (
                  <th key={col.campo} className="border border-border p-2 text-left font-medium">
                    {col.rotulo}
                  </th>
                ))}
                {podeGerenciar && <th className="border border-border p-2 text-left font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {resultado.data.map((linha) => (
                <tr key={String(linha.id)} className="hover:bg-muted/50">
                  {config.colunas.map((col) => (
                    <td key={col.campo} className="border border-border p-2">
                      {String(linha[col.campo] ?? '')}
                    </td>
                  ))}
                  {podeGerenciar && (
                    <td className="border border-border p-2">
                      <Link
                        href={`/cadastros/${config.recurso}/${String(linha.id)}/editar`}
                        className="text-primary hover:underline"
                      >
                        Editar
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {/* Paginação simples */}
      {resultado && resultado.total > resultado.pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {resultado.page} de {Math.ceil(resultado.total / resultado.pageSize)}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/cadastros/${config.recurso}?page=${page - 1}`} className="text-primary hover:underline">
                Anterior
              </Link>
            )}
            {page < Math.ceil(resultado.total / resultado.pageSize) && (
              <Link href={`/cadastros/${config.recurso}?page=${page + 1}`} className="text-primary hover:underline">
                Próximo
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
