'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { normalizarCest, normalizarNcm } from '@/lib/fiscal-enquadramentos';

interface Props {
  aberto: boolean;
  tipo: 'cfops' | 'ncms' | null;
  onFechar: () => void;
  onConfirmar: (corpo: { codigo: string; descricao: string; justificativa: string }) => void;
}

export function CodigoFiscalDialog({ aberto, tipo, onFechar, onConfirmar }: Props) {
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [motivo, setMotivo] = useState('');
  if (!aberto || !tipo) return null;
  const titulo = tipo === 'cfops' ? 'Operação fiscal (CFOP)' : 'Classificação fiscal (NCM)';
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <form
        className="grid w-full max-w-md gap-3 rounded-lg bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirmar({
            codigo: tipo === 'ncms' ? normalizarNcm(codigo) : codigo.replace(/\D/g, ''),
            descricao: descricao.trim(),
            justificativa: motivo.trim(),
          });
        }}
      >
        <h2 className="text-base font-semibold">{titulo}</h2>
        <p className="text-xs text-muted-foreground">Cadastro manual. A tabela oficial completa não está carregada; confira o código na documentação fiscal.</p>
        <label className="grid gap-1 text-xs">Código
          <input aria-label="Código" className="h-8 rounded-md border px-2" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs">Descrição
          <input aria-label="Descrição" className="h-8 rounded-md border px-2" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs">Motivo
          <textarea aria-label="Motivo do código" className="min-h-16 rounded-md border px-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onFechar}>Cancelar</Button>
          <Button type="submit">Salvar rascunho</Button>
        </div>
      </form>
    </div>
  );
}

export function mascaraCest(valor: string): string {
  return normalizarCest(valor);
}
