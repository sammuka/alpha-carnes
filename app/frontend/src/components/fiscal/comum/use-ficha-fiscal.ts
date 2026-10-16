'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Opcoes<D, H> {
  /** Função de módulo: lê a ficha e o histórico juntos. */
  buscar: (id: string) => Promise<[D, H[]]>;
  /** Muda quando um evento em tempo real pede nova leitura. */
  recarga: number;
  mensagemNaoEncontrada: string;
}

/**
 * Ficha selecionada e histórico, sempre lidos do servidor. A resposta de um pedido antigo não
 * sobrescreve a do mais novo; `carregando` cobre a ficha e o histórico.
 */
export function useFichaFiscal<D, H>({ buscar, recarga, mensagemNaoEncontrada }: Opcoes<D, H>) {
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<D | null>(null);
  const [historico, setHistorico] = useState<H[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pedido = useRef(0);

  const carregar = useCallback(async (id: string) => {
    const numero = ++pedido.current;
    setCarregando(true);
    try {
      const [ficha, eventos] = await buscar(id);
      if (numero !== pedido.current) return;
      setDetalhe(ficha);
      setHistorico(eventos);
      setErro(null);
    } catch (falha) {
      if (numero !== pedido.current) return;
      if ((falha as { status?: number }).status === 404) {
        setDetalhe(null);
        setSelecionadoId(null);
        setErro(mensagemNaoEncontrada);
        return;
      }
      setErro(falha instanceof Error ? falha.message : 'Falha na operação.');
    } finally {
      if (numero === pedido.current) setCarregando(false);
    }
  }, [buscar, mensagemNaoEncontrada]);

  useEffect(() => {
    if (selecionadoId) void carregar(selecionadoId);
  }, [selecionadoId, recarga, carregar]);

  function selecionar(id: string) {
    if (id === selecionadoId) {
      void carregar(id);
      return;
    }
    setDetalhe(null);
    setHistorico([]);
    setErro(null);
    setSelecionadoId(id);
  }

  function limpar() {
    pedido.current += 1;
    setSelecionadoId(null);
    setDetalhe(null);
    setHistorico([]);
    setCarregando(false);
  }

  return { selecionadoId, detalhe, historico, setHistorico, carregando, erro, setErro, carregar, selecionar, limpar };
}
