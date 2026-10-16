'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { limparJustificativa } from '@/lib/fiscal-enquadramentos';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

interface Props {
  aberto: boolean;
  prioridadeOrigem: number;
  erro: string | null;
  onFechar: () => void;
  onConfirmar: (corpo: { vigenciaInicio: string; vigenciaFim: string; prioridade: number; justificativa: string }) => void;
}

export function DuplicarDialog({ aberto, prioridadeOrigem, erro, onFechar, onConfirmar }: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  return (
    <Dialog open={aberto} onOpenChange={(aberta) => { if (!aberta) onFechar(); }}>
      <DialogContent onCloseAutoFocus={retornoFoco} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Duplicar perfil</DialogTitle>
        </DialogHeader>
        <FormularioDuplicar prioridadeOrigem={prioridadeOrigem} erro={erro} onFechar={onFechar} onConfirmar={onConfirmar} />
      </DialogContent>
    </Dialog>
  );
}

/** Montado só enquanto o diálogo está aberto: os campos iniciam ao abrir e nenhuma atualização da ficha os apaga. */
function FormularioDuplicar({ prioridadeOrigem, erro, onFechar, onConfirmar }: Omit<Props, 'aberto'>) {
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [prioridade, setPrioridade] = useState(prioridadeOrigem);
  const [motivo, setMotivo] = useState('');
  return (
    <form
      className="grid gap-3 px-4 pb-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        onConfirmar({ vigenciaInicio: inicio, vigenciaFim: fim, prioridade, justificativa: limparJustificativa(motivo) });
      }}
    >
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
  );
}
