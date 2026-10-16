'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Último gatilho de menu que recebeu o foco (o botão ou um item do menu aberto por ele). Um item de menu sai
 * do DOM quando o menu fecha; se a ação abriu um drawer ou diálogo, o foco volta a este gatilho.
 */
let gatilhoDeMenu: HTMLElement | null = null;
let ouvindo = false;

function lembrarGatilhoDeMenu(evento: FocusEvent): void {
  const alvo = evento.target;
  if (!(alvo instanceof HTMLElement)) return;
  if (alvo.matches('[data-slot="dropdown-menu-trigger"]')) {
    gatilhoDeMenu = alvo;
    return;
  }
  const rotulo = alvo.closest('[role="menu"]')?.getAttribute('aria-labelledby');
  const gatilho = rotulo ? document.getElementById(rotulo) : null;
  if (gatilho) gatilhoDeMenu = gatilho;
}

/**
 * Devolve o foco ao controle que abriu um drawer ou diálogo. O Radix só restaura o foco quando
 * existe um `Trigger`; aqui tudo abre por estado, então o elemento ativo é guardado na abertura e
 * refocado em `onCloseAutoFocus`. A captura roda em layout effect, antes de o Radix mover o foco
 * para dentro do conteúdo. Se o controle deixou de existir (item de menu, por exemplo), o foco vai para o
 * gatilho do menu que o abriu; sem ele, não faz nada.
 */
export function useRetornoFoco(aberto: boolean): (evento: Event) => void {
  const origem = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ouvindo) return;
    ouvindo = true;
    document.addEventListener('focusin', lembrarGatilhoDeMenu);
  }, []);

  useLayoutEffect(() => {
    if (!aberto) return;
    const ativo = document.activeElement;
    origem.current = ativo instanceof HTMLElement && ativo !== document.body ? ativo : null;
  }, [aberto]);

  return useCallback((evento: Event) => {
    evento.preventDefault();
    const alvo = origem.current;
    origem.current = null;
    if (alvo?.isConnected) alvo.focus();
    else if (gatilhoDeMenu?.isConnected) gatilhoDeMenu.focus();
  }, []);
}
