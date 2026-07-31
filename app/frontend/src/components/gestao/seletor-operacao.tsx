'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { listarOperacoes, type Operacao } from '@/lib/gestao-operacoes';

interface SeletorOperacaoProps {
  className?: string;
  onOperacaoChange?: (operacao: Operacao | null) => void;
}

export function SeletorOperacao({ className, onOperacaoChange }: SeletorOperacaoProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const operacaoId = searchParams.get('operacaoId') ?? '';

  const selecionar = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set('operacaoId', id);
      else params.delete('operacaoId');
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    void listarOperacoes()
      .then((lista) => {
        if (!ativo) return;
        setOperacoes(lista);
        const urlId = searchParams.get('operacaoId');
        if (urlId && lista.some((o) => o.id === urlId)) return;
        const primeiraAberta = lista.find((o) => o.status !== 'fechada');
        if (primeiraAberta) selecionar(primeiraAberta.id);
      })
      .catch((e: Error) => {
        if (ativo) setErro(e.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [searchParams, selecionar]);

  const operacaoAtual = operacoes.find((o) => o.id === operacaoId) ?? null;

  useEffect(() => {
    onOperacaoChange?.(operacaoAtual);
  }, [operacaoAtual, onOperacaoChange]);

  if (carregando) {
    return (
      <div className={`flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground ${className ?? ''}`}>
        <Loader2 size={16} className="animate-spin" />
        Carregando operações…
      </div>
    );
  }

  if (erro) {
    return (
      <div className={`rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive ${className ?? ''}`}>
        {erro}
      </div>
    );
  }

  if (operacoes.length === 0) {
    return (
      <div className={`rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground ${className ?? ''}`}>
        Nenhuma operação cadastrada
      </div>
    );
  }

  return (
    <select
      value={operacaoId}
      onChange={(e) => selecionar(e.target.value)}
      className={`h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground outline-none focus:border-primary ${className ?? ''}`}
      aria-label="Selecionar operação"
    >
      {operacoes.map((o) => (
        <option key={o.id} value={o.id}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}
