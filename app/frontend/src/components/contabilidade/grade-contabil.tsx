'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { PillSituacao } from '@/components/fiscal/empresas/pill-situacao';
import type { SituacaoEstabelecimento } from '@/lib/fiscal-empresas';

export const TEXTO_VAZIO = 'Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.';

export interface ColunaContabil<L> {
  rotulo: string;
  /** Chave aceita pelo parâmetro `ordenar` do servidor; ausente quando a coluna não ordena (Situação). */
  ordenar?: string;
  celula: (linha: L) => ReactNode;
}

interface Props<L extends { codigo: string }> {
  /** Classe de gancho da grade (os testes contam `.<classe> tbody tr`). */
  className: string;
  colunas: ColunaContabil<L>[];
  linhas: L[];
  total: number;
  pagina: number;
  totalPaginas: number;
  ordenar: string;
  direcao: 'asc' | 'desc';
  carregando: boolean;
  selecionado: string | undefined;
  marcadas: string[];
  /** Texto do rótulo acessível da caixa de seleção (`Selecionar <texto>`). */
  rotuloLinha: (linha: L) => string;
  onSelecionar: (codigo: string) => void;
  onMarcar: (codigo: string) => void;
  onOrdenar: (chave: string) => void;
  onPagina: (pagina: number) => void;
}

/** Selo de situação da grade e da ficha, com as cores do cadastro fiscal (mesmo enum de cinco situações). */
export function SeloSituacao({ situacao, rotulo }: { situacao: string; rotulo: string }) {
  return <PillSituacao situacao={situacao as SituacaoEstabelecimento} rotulo={rotulo} />;
}

const SELETOR = 'h-8 rounded-md border border-border-strong bg-background px-2 text-xs';
const LINK = cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50');

/** Abaixo de 800px cada linha vira um cartão com os rótulos das colunas (`data-rotulo`); a mesma linha, o mesmo checkbox. */
const CARTAO_LINHA = 'max-[800px]:grid max-[800px]:gap-1 max-[800px]:rounded-md max-[800px]:border! max-[800px]:p-3';
const CARTAO_CELULA = 'max-[800px]:flex max-[800px]:h-auto max-[800px]:gap-1.5 max-[800px]:whitespace-normal max-[800px]:p-0 max-[800px]:before:font-bold max-[800px]:before:content-[attr(data-rotulo)]';

/**
 * Grade das telas contábeis: seleção múltipla, ordenação e paginação no servidor e o rodapé
 * "Exibindo N de M registros" do protótipo. Enter ou clique seleciona a linha.
 */
export function GradeContabil<L extends { codigo: string }>({
  className, colunas, linhas, total, pagina, totalPaginas, ordenar, direcao, carregando, selecionado, marcadas,
  rotuloLinha, onSelecionar, onMarcar, onOrdenar, onPagina,
}: Props<L>) {
  return (
    <div className="min-w-0 space-y-2">
      {/* Os cartões abaixo de 800px não têm cabeçalho: a ordenação por coluna passa a este seletor. */}
      <div className="flex flex-wrap gap-2 min-[800px]:hidden">
        <select aria-label="Ordenar por" className={SELETOR} value={ordenar} onChange={(evento) => onOrdenar(evento.target.value)}>
          {colunas.filter((coluna) => coluna.ordenar).map((coluna) => <option key={coluna.rotulo} value={coluna.ordenar}>{coluna.rotulo}</option>)}
        </select>
        {/* onOrdenar na coluna ativa inverte a direção; com duas opções, toda troca é uma inversão. */}
        <select aria-label="Direção da ordenação" className={SELETOR} value={direcao} onChange={() => onOrdenar(ordenar)}>
          <option value="asc">Crescente</option>
          <option value="desc">Decrescente</option>
        </select>
      </div>
      <div className={cn(className, 'overflow-x-auto rounded-md border border-border max-[800px]:border-0')} aria-busy={carregando}>
        <Table className="max-[800px]:block">
          <TableHeader className="max-[800px]:hidden">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8"><span className="sr-only">Selecionar</span></TableHead>
              {colunas.map((coluna) => {
                if (!coluna.ordenar) return <TableHead key={coluna.rotulo}><span className="font-semibold normal-case">{coluna.rotulo}</span></TableHead>;
                const ativa = ordenar === coluna.ordenar;
                const Icone = !ativa ? ArrowUpDown : direcao === 'asc' ? ArrowUp : ArrowDown;
                const chave = coluna.ordenar;
                return (
                  <TableHead key={coluna.rotulo} aria-sort={ativa ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button
                      type="button"
                      aria-label={`Ordenar por ${coluna.rotulo}`}
                      className="inline-flex items-center gap-1 font-semibold hover:text-foreground"
                      onClick={() => onOrdenar(chave)}
                    >
                      {coluna.rotulo}
                      <Icone className="size-3" aria-hidden="true" />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody className="max-[800px]:grid max-[800px]:gap-3">
            {linhas.length === 0 && carregando ? null : linhas.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colunas.length + 1} className="p-3">
                  <EmptyState title={TEXTO_VAZIO} />
                </TableCell>
              </TableRow>
            ) : linhas.map((linha) => (
              <TableRow
                key={linha.codigo}
                tabIndex={0}
                aria-selected={selecionado === linha.codigo}
                data-state={selecionado === linha.codigo ? 'selected' : undefined}
                className={cn('cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring', CARTAO_LINHA)}
                onClick={() => onSelecionar(linha.codigo)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter' && evento.target === evento.currentTarget) {
                    evento.preventDefault();
                    onSelecionar(linha.codigo);
                  }
                }}
              >
                <TableCell className="max-[800px]:h-auto max-[800px]:p-0">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    aria-label={`Selecionar ${rotuloLinha(linha)}`}
                    checked={marcadas.includes(linha.codigo)}
                    onChange={() => onMarcar(linha.codigo)}
                  />
                </TableCell>
                {colunas.map((coluna) => <TableCell key={coluna.rotulo} data-rotulo={coluna.rotulo} className={CARTAO_CELULA}>{coluna.celula(linha)}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <span>Exibindo {linhas.length} de {total}</span> {total === 1 ? 'registro' : 'registros'} · Ordenação por coluna · Selecionar linha abre a ficha · <span>Página {pagina} de {totalPaginas}</span>
        </span>
        <Pagination aria-label="Paginação da lista" className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationLink
                href="#"
                size="sm"
                className={LINK}
                aria-label="Página anterior"
                aria-disabled={pagina <= 1}
                onClick={(evento) => { evento.preventDefault(); if (pagina > 1) onPagina(pagina - 1); }}
              >Anterior</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink
                href="#"
                size="sm"
                className={LINK}
                aria-label="Próxima página"
                aria-disabled={pagina >= totalPaginas}
                onClick={(evento) => { evento.preventDefault(); if (pagina < totalPaginas) onPagina(pagina + 1); }}
              >Próxima</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
