'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';

interface Props {
  aberto: boolean;
  prioridadeOrigem: number;
  erro: string | null;
  onFechar: () => void;
  onConfirmar: (corpo: { vigenciaInicio: string; vigenciaFim: string; prioridade: number; justificativa: string }) => void;
}

export function DuplicarDialog({ aberto, prioridadeOrigem, erro, onFechar, onConfirmar }: Props) {
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [prioridade, setPrioridade] = useState(prioridadeOrigem);
  const [motivo, setMotivo] = useState('');
  if (!aberto) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Duplicar perfil" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <form
        className="grid w-full max-w-md gap-3 rounded-lg bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirmar({ vigenciaInicio: inicio, vigenciaFim: fim, prioridade, justificativa: motivo });
        }}
      >
        <h2 className="text-base font-semibold">Duplicar perfil</h2>
        <label className="grid gap-1 text-xs">Início de vigência<DatePickerField aria-label="Início de vigência da cópia" value={inicio} onChange={setInicio} /></label>
        <label className="grid gap-1 text-xs">Fim de vigência<DatePickerField aria-label="Fim de vigência da cópia" value={fim} onChange={setFim} /></label>
        <label className="grid gap-1 text-xs">Prioridade
          <input aria-label="Prioridade da cópia" type="number" min={1} className="h-8 rounded-md border px-2" value={prioridade} onChange={(e) => setPrioridade(Number(e.target.value))} />
        </label>
        <label className="grid gap-1 text-xs">Motivo
          <textarea aria-label="Motivo da duplicação" className="min-h-16 rounded-md border px-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onFechar}>Cancelar</Button>
          <Button type="submit">Duplicar</Button>
        </div>
      </form>
    </div>
  );
}
