'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  TEXTO_VAZIO,
  mascararCfop,
  rotuloData,
  type FiltrosLista,
  type LinhaEnquadramento,
} from '@/lib/fiscal-enquadramentos';

/** Ids aceitos pelo parâmetro `sort` do servidor. */
const COLUNAS = [
  { id: 'operacao', rotulo: 'Operação' },
  { id: 'cfop', rotulo: 'Operação fiscal (CFOP)' },
  { id: 'vigenciaInicio', rotulo: 'Início de vigência' },
  { id: 'estabelecimento', rotulo: 'Estabelecimento' },
  { id: 'tpNF', rotulo: 'Tipo da nota' },
  { id: 'finNFe', rotulo: 'Finalidade' },
] as const;

interface Props {
  linhas: LinhaEnquadramento[];
  total: number;
  pageSize: number;
  carregando: boolean;
  erro: string | null;
  filtros: FiltrosLista;
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
  onOrdenar: (coluna: string) => void;
  onPagina: (pagina: number) => void;
  onTentarNovamente: () => void;
}

/** Grade paginada e ordenada no servidor; Enter ou clique seleciona o enquadramento. */
export function GradeEnquadramentos({
  linhas, total, pageSize, carregando, erro, filtros, selecionadoId,
  onSelecionar, onOrdenar, onPagina, onTentarNovamente,
}: Props) {
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
  if (linhas.length === 0) return <EmptyState title={TEXTO_VAZIO} />;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-border" aria-busy={carregando}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUNAS.map((coluna) => {
                const ativa = filtros.sort === coluna.id;
                const Icone = !ativa ? ArrowUpDown : filtros.dir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <TableHead key={coluna.id} aria-sort={ativa ? (filtros.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
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
                <TableCell>{linha.operacao}</TableCell>
                <TableCell className="font-data">{mascararCfop(linha.cfop)}</TableCell>
                <TableCell>{rotuloData(linha.vigenciaInicio)}</TableCell>
                <TableCell>{linha.estabelecimento}</TableCell>
                <TableCell>{linha.tpNf}</TableCell>
                <TableCell>{linha.finNfe}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <nav aria-label="Paginação" className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {total} {total === 1 ? 'registro' : 'registros'} · Página {filtros.page} de {totalPaginas}
        </span>
        <span className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={filtros.page <= 1} onClick={() => onPagina(filtros.page - 1)}>
            Anterior
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={filtros.page >= totalPaginas} onClick={() => onPagina(filtros.page + 1)}>
            Próxima
          </Button>
        </span>
      </nav>
    </div>
  );
}
