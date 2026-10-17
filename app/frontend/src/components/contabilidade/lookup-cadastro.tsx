'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

export interface OpcaoCadastro { codigo: string; nome: string }

/**
 * Popup "Selecionar <campo>" do padrão Pesquisar do protótipo (`.lookup-popup` / `.lookup-card`).
 * Modal: Escape fecha de qualquer foco e Tab/Shift+Tab ciclam dentro dele; o clique no scrim não fecha.
 * Quem abre devolve o foco ao botão Pesquisar em `onFechar`.
 */
export function LookupCadastro({ rotulo, busca, onBusca, opcoes, onEscolher, onFechar, erro, truncado = false }: {
  rotulo: string;
  busca: string;
  onBusca: (texto: string) => void;
  opcoes: OpcaoCadastro[];
  onEscolher: (opcao: OpcaoCadastro) => void;
  onFechar: () => void;
  erro?: string;
  truncado?: boolean;
}) {
  const popup = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        onFechar();
        return;
      }
      if (evento.key !== 'Tab' || !popup.current) return;
      const focaveis = Array.from(popup.current.querySelectorAll<HTMLElement>('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((el) => !el.hasAttribute('disabled'));
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (!primeiro || !ultimo) return;
      const dentro = popup.current.contains(document.activeElement);
      if (!dentro || (evento.shiftKey && document.activeElement === primeiro) || (!evento.shiftKey && document.activeElement === ultimo)) {
        evento.preventDefault();
        (evento.shiftKey && dentro ? ultimo : primeiro).focus();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <div
      ref={popup}
      role="dialog"
      aria-modal="true"
      aria-label={`Selecionar ${rotulo}`}
      className="fixed inset-0 z-[120] grid place-items-center bg-lookup-scrim p-3.5"
    >
      <div className="w-[min(490px,95vw)] overflow-hidden rounded-[9px] bg-card shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
          <h2 className="text-sm font-bold">Selecionar {rotulo}</h2>
          <Button type="button" size="sm" variant="secondary" onClick={onFechar}>Fechar</Button>
        </div>
        <input
          type="search"
          autoFocus
          placeholder="Pesquisar pelo nome ou descrição"
          aria-label="Pesquisar cadastro"
          className="m-3 h-9 w-[calc(100%-24px)] rounded-md border border-border-strong px-2 text-xs"
          value={busca}
          onChange={(evento) => onBusca(evento.target.value)}
        />
        <div className="max-h-[315px] overflow-auto">
          {opcoes.map((opcao) => (
            <button type="button" key={opcao.codigo} className="block w-full border-b border-border px-3.5 py-2.5 text-left hover:bg-surface-2" onClick={() => onEscolher(opcao)}>
              <b className="block text-xs">{opcao.nome}</b>
              <small className="mt-1 block text-[10px] text-muted-foreground">Cadastro ativo</small>
            </button>
          ))}
        </div>
        {erro && <p role="alert" className="px-3.5 py-2 text-xs text-destructive">{erro}</p>}
        {truncado && <p className="px-3.5 py-2 text-xs text-muted-foreground">Refine a busca para ver mais contas.</p>}
        <p className="px-3.5 py-2.5 text-[10px] text-muted-foreground">A seleção utiliza uma referência interna invisível, nunca digitação de GUID.</p>
      </div>
    </div>
  );
}
