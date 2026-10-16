'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  mascararCnpjAlfanumerico,
  rotuloRegime,
  type EstabelecimentoLinha,
  type FiltrosGrade,
  type OrdenacaoGrade,
  type Paginado,
} from '@/lib/fiscal-empresas';
import { PillSituacao } from './pill-situacao';

export interface EstadoGrade {
  dados: Paginado<EstabelecimentoLinha> | null;
  carregando: boolean;
  erro: string | null;
}

interface GradeEstabelecimentosProps {
  estado: EstadoGrade;
  filtros: FiltrosGrade;
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
  onOrdenar: (coluna: OrdenacaoGrade) => void;
  onPagina: (pagina: number) => void;
  onTentarNovamente: () => void;
  onLimparFiltros: () => void;
  temFiltro: boolean;
}

const COLUNAS: Array<{ id: OrdenacaoGrade; rotulo: string }> = [
  { id: 'empresa', rotulo: 'Empresa' },
  { id: 'estabelecimento', rotulo: 'Estabelecimento' },
  { id: 'cnpj', rotulo: 'CNPJ' },
  { id: 'regime', rotulo: 'Regime tributário' },
  { id: 'uf', rotulo: 'Estado' },
];

function CabecalhoOrdenavel({
  coluna,
  filtros,
  onOrdenar,
}: {
  coluna: (typeof COLUNAS)[number];
  filtros: FiltrosGrade;
  onOrdenar: (coluna: OrdenacaoGrade) => void;
}) {
  const ativa = filtros.sort === coluna.id;
  const Icone = !ativa ? ArrowUpDown : filtros.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={ativa ? (filtros.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
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
}

/** Grade paginada no servidor; Enter ou clique seleciona o estabelecimento. */
export function GradeEstabelecimentos({
  estado,
  filtros,
  selecionadoId,
  onSelecionar,
  onOrdenar,
  onPagina,
  onTentarNovamente,
  onLimparFiltros,
  temFiltro,
}: GradeEstabelecimentosProps) {
  const { dados, carregando, erro } = estado;

  if (erro && !dados) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 p-4 text-xs text-destructive">
        {erro}
        <Button type="button" size="sm" variant="secondary" onClick={onTentarNovamente}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (carregando && !dados) {
    return (
      <div role="status" aria-label="Carregando estabelecimentos" className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }

  const linhas = dados?.data ?? [];
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.pageSize)) : 1;

  if (linhas.length === 0) {
    return (
      <EmptyState
        title="Nenhum resultado para o período, filtro ou situação escolhidos."
        description="Limpe os filtros ou cadastre um novo registro."
        action={
          temFiltro ? (
            <Button type="button" size="sm" variant="secondary" onClick={onLimparFiltros}>
              Limpar filtros
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {erro && (
        <p role="alert" className="flex items-center gap-3 text-xs text-destructive">
          {erro}
          <Button type="button" size="sm" variant="secondary" onClick={onTentarNovamente}>
            Tentar novamente
          </Button>
        </p>
      )}
      <div className="overflow-x-auto rounded-md border border-border" aria-busy={carregando}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUNAS.map((c) => (
                <CabecalhoOrdenavel key={c.id} coluna={c} filtros={filtros} onOrdenar={onOrdenar} />
              ))}
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => {
              const selecionada = linha.id === selecionadoId;
              return (
                <TableRow
                  key={linha.id}
                  tabIndex={0}
                  aria-selected={selecionada}
                  data-state={selecionada ? 'selected' : undefined}
                  className="cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  onClick={() => onSelecionar(linha.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onSelecionar(linha.id);
                    }
                  }}
                >
                  <TableCell>{linha.empresa.razaoSocial}</TableCell>
                  <TableCell className="font-medium">{linha.nome}</TableCell>
                  <TableCell className="font-data">{mascararCnpjAlfanumerico(linha.cnpj)}</TableCell>
                  <TableCell>{rotuloRegime(linha.regime)}</TableCell>
                  <TableCell>{linha.uf}</TableCell>
                  <TableCell>
                    <PillSituacao situacao={linha.situacao} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <nav aria-label="Paginação" className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {dados?.total ?? 0} {dados?.total === 1 ? 'registro' : 'registros'} · Página {filtros.page} de {totalPaginas}
        </span>
        <span className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={filtros.page <= 1} onClick={() => onPagina(filtros.page - 1)}>
            Anterior
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={filtros.page >= totalPaginas}
            onClick={() => onPagina(filtros.page + 1)}
          >
            Próxima
          </Button>
        </span>
      </nav>
    </div>
  );
}
