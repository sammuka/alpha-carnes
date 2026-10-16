'use client';

import { useEffect, useRef, useState } from 'react';
import { ComboboxField } from '@/components/ui/combobox-field';
import {
  AVISO_REFINAR,
  TEXTO_VAZIO_COMBO,
  buscarOpcoes,
  type OpcaoCombo,
  type ResultadoBusca,
  type TipoBusca,
} from '@/lib/fiscal-enquadramentos';

interface Props {
  id: string;
  tipo: TipoBusca;
  value: string;
  /** Rótulo do item selecionado, exibido mesmo quando ele não está na página de resultados. */
  rotulo: string;
  placeholder: string;
  searchPlaceholder: string;
  onChange: (opcao: OpcaoCombo | null) => void;
  clearable?: boolean;
  disabled?: boolean;
}

const ATRASO_MS = 250;

/** Combo pesquisável que consulta o cadastro no servidor a cada digitação (debounce) e descarta resposta obsoleta. */
export function ComboboxBusca({ id, tipo, value, rotulo, placeholder, searchPlaceholder, onChange, clearable, disabled }: Props) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pedido = useRef(0);

  useEffect(() => {
    if (!aberto) return;
    const numero = ++pedido.current;
    const atual = () => numero === pedido.current;
    const espera = setTimeout(() => {
      setCarregando(true);
      setErro(null);
      buscarOpcoes(tipo, termo)
        .then((r) => { if (atual()) setResultado(r); })
        .catch((falha: unknown) => {
          if (!atual()) return;
          setResultado(null);
          setErro(falha instanceof Error ? falha.message : 'Falha ao buscar.');
        })
        .finally(() => { if (atual()) setCarregando(false); });
    }, termo ? ATRASO_MS : 0);
    return () => clearTimeout(espera);
  }, [aberto, termo, tipo]);

  const opcoes = resultado?.opcoes ?? [];
  const itens = opcoes.map((o) => ({ id: o.id, label: o.rotulo }));
  if (value && rotulo && !termo && !itens.some((i) => i.id === value)) itens.unshift({ id: value, label: rotulo });

  return (
    <ComboboxField
      id={id}
      items={itens}
      value={value}
      clearable={clearable}
      disabled={disabled}
      onChange={(novo) => onChange(novo ? (opcoes.find((o) => o.id === novo) ?? { id: novo, rotulo }) : null)}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={carregando ? 'Buscando…' : erro ? '' : TEXTO_VAZIO_COMBO}
      onSearchChange={setTermo}
      onOpenChange={setAberto}
      footer={(erro || resultado?.truncado) ? (
        <div className="border-t px-3 py-2 text-xs">
          {erro && <p role="alert" className="text-destructive">{erro}</p>}
          {resultado?.truncado && !erro && <p role="status" className="text-muted-foreground">{AVISO_REFINAR}</p>}
        </div>
      ) : undefined}
    />
  );
}
