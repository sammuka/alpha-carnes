'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { textoExibindo } from '@/lib/fiscal-comum-ui';

export interface ColunaGrade<L> {
  /** Id aceito pelo parâmetro `sort` do servidor. */
  id: string;
  rotulo: string;
  celula: (linha: L) => ReactNode;
  className?: string;
  /** Falso quando o servidor não ordena por esta coluna (por exemplo, Situação na T05). */
  ordenavel?: boolean;
}

interface Props<L extends { id: string }> {
  colunas: ColunaGrade<L>[];
  linhas: L[];
  total: number;
  pageSize: number;
  carregando: boolean;
  erro: string | null;
  sort: string;
  dir: 'asc' | 'desc';
  page: number;
  selecionadoId: string | null;
  textoVazio: string;
  onSelecionar: (id: string) => void;
  onOrdenar: (coluna: string) => void;
  onPagina: (pagina: number) => void;
  onTentarNovamente: () => void;
}

/**
 * Grade das telas fiscais: paginada e ordenada no servidor, com o rodapé "Exibindo N de M registros"
 * do protótipo. Enter ou clique seleciona a linha.
 */
export function GradeFiscal<L extends { id: string }>({
  colunas, linhas, total, pageSize, carregando, erro, sort, dir, page, selecionadoId, textoVazio,
  onSelecionar, onOrdenar, onPagina, onTentarNovamente,
}: Props<L>) {
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  if (erro) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 p-4 text-xs text-destructive">
        {erro}
        <Button type="button" size="sm" variant="secondary" onClick={onTentarNovamente}>Tentar novamente</Button>
      </div>
    );
  }
  if (carregando && linhas.length === 0) return <Skeleton className="h-24" />;
  if (linhas.length === 0) return <EmptyState title={textoVazio} />;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-border" aria-busy={carregando}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {colunas.map((coluna) => {
                if (coluna.ordenavel === false) return <TableHead key={coluna.id}>{coluna.rotulo}</TableHead>;
                const ativa = sort === coluna.id;
                const Icone = !ativa ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <TableHead key={coluna.id} aria-sort={ativa ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-semibold hover:text-foreground"
                      onClick={() => onOrdenar(coluna.id)}
                    >
                      {coluna.rotulo}
                      <Icone className="size-3" aria-hidden="true" />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow
                key={linha.id}
                tabIndex={0}
                aria-selected={selecionadoId === linha.id}
                data-state={selecionadoId === linha.id ? 'selected' : undefined}
                className="cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                onClick={() => onSelecionar(linha.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSelecionar(linha.id);
                  }
                }}
              >
                {colunas.map((coluna) => (
                  <TableCell key={coluna.id} className={coluna.className}>{coluna.celula(linha)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {textoExibindo(linhas.length, total)} · Ordenação por coluna · Selecionar linha abre a ficha · Página {page} de {totalPaginas}
        </span>
        <span className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPagina(page - 1)}>
            Anterior
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={page >= totalPaginas} onClick={() => onPagina(page + 1)}>
            Próxima
          </Button>
        </span>
      </nav>
    </div>
  );
}
