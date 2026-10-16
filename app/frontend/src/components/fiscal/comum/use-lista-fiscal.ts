'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TEXTO_SERVICO_INDISPONIVEL } from '@/lib/fiscal-comum-ui';

/** Atraso da busca por texto: a lista só pergunta ao servidor quando a digitação para. */
export const ATRASO_BUSCA_MS = 250;

export interface FiltrosBase {
  search: string;
  sort: string;
  dir: 'asc' | 'desc';
  page: number;
}

interface Opcoes<F extends FiltrosBase, L, C> {
  /** Chave do `sessionStorage` onde filtros e ordenação sobrevivem à navegação. */
  chave: string;
  padrao: F;
  /** Funções de módulo: a identidade precisa ser estável. */
  listar: (filtros: F) => Promise<{ data: L[]; total: number; pageSize: number }>;
  contagens: (filtros: F) => Promise<C>;
  /** Muda quando um evento em tempo real pede nova leitura. */
  recarga: number;
}

function lerFiltros<F>(chave: string, padrao: F): F {
  if (typeof window === 'undefined') return padrao;
  try {
    const bruto = window.sessionStorage.getItem(chave);
    return bruto ? { ...padrao, ...JSON.parse(bruto) as Partial<F> } : padrao;
  } catch {
    return padrao;
  }
}

/** Lista paginada e ordenada no servidor, com contagens, estado de carga e erro visível. */
export function useListaFiscal<F extends FiltrosBase, L, C>({ chave, padrao, listar, contagens, recarga }: Opcoes<F, L, C>) {
  const [filtros, setFiltros] = useState<F>(() => lerFiltros(chave, padrao));
  const [linhas, setLinhas] = useState<L[]>([]);
  const [paginacao, setPaginacao] = useState({ total: 0, pageSize: 20 });
  const [totais, setTotais] = useState<C | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const pedido = useRef(0);
  const [busca, setBusca] = useState(filtros.search);

  useEffect(() => {
    if (busca === filtros.search) return undefined;
    const espera = setTimeout(() => setFiltros((atual) => ({ ...atual, search: busca, page: 1 })), ATRASO_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [busca, filtros.search]);

  const carregar = useCallback(async () => {
    const numero = ++pedido.current;
    setCarregando(true);
    setErro(null);
    try {
      const [lista, contagem] = await Promise.all([listar(filtros), contagens(filtros)]);
      if (numero !== pedido.current) return;
      setLinhas(lista.data);
      setPaginacao({ total: lista.total, pageSize: lista.pageSize });
      setTotais(contagem);
      // Filtrou ou removeu a última linha da página atual: volta para a última página existente.
      const ultima = Math.max(1, Math.ceil(lista.total / lista.pageSize));
      if (filtros.page > ultima) setFiltros((atual) => ({ ...atual, page: ultima }));
    } catch (falha) {
      if (numero !== pedido.current) return;
      setErro(falha instanceof Error ? falha.message : TEXTO_SERVICO_INDISPONIVEL);
    } finally {
      if (numero === pedido.current) setCarregando(false);
    }
  }, [filtros, listar, contagens]);

  useEffect(() => { void carregar(); }, [carregar, recarga]);

  useEffect(() => {
    window.sessionStorage.setItem(chave, JSON.stringify(filtros));
  }, [chave, filtros]);

  function ordenar(coluna: string) {
    setFiltros((atual) => ({
      ...atual,
      sort: coluna,
      dir: atual.sort === coluna && atual.dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }

  return { filtros, setFiltros, busca, setBusca, linhas, total: paginacao.total, pageSize: paginacao.pageSize, contagens: totais, carregando, erro, ordenar, carregar };
}
