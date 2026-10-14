'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Devolve o foco ao controle que abriu um drawer ou diálogo. O Radix só restaura o foco quando
 * existe um `Trigger`; aqui tudo abre por estado, então o elemento ativo é guardado na abertura e
 * refocado em `onCloseAutoFocus`. A captura roda em layout effect, antes de o Radix mover o foco
 * para dentro do conteúdo. Se o controle deixou de existir (ex.: a ação mudou a tela), não faz nada.
 */
export function useRetornoFoco(aberto: boolean): (evento: Event) => void {
  const origem = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (aberto) origem.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [aberto]);

  return useCallback((evento: Event) => {
    evento.preventDefault();
    const alvo = origem.current;
    origem.current = null;
    if (alvo?.isConnected) alvo.focus();
  }, []);
}
