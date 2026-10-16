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
  /** Último envio recusado por alteração concorrente: mostra Recarregar dados. */
  conflito?: boolean;
  /** A ficha de origem foi removida por outra pessoa: o digitado fica, mas o reenvio é bloqueado. */
  removido?: boolean;
  onRecarregar?: () => Promise<void>;
  onFechar: () => void;
  onConfirmar: (corpo: { vigenciaInicio: string; vigenciaFim: string; prioridade: number; justificativa: string }) => Promise<void>;
}

export function DuplicarDialog({ aberto, prioridadeOrigem, erro, conflito = false, removido = false, onRecarregar, onFechar, onConfirmar }: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={(aberta) => { if (!aberta && !enviando) onFechar(); }}>
      <DialogContent onCloseAutoFocus={retornoFoco} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Duplicar perfil</DialogTitle>
        </DialogHeader>
        <FormularioDuplicar
          prioridadeOrigem={prioridadeOrigem}
          erro={erro}
          conflito={conflito}
          removido={removido}
          enviando={enviando}
          onEnviando={setEnviando}
          onRecarregar={onRecarregar}
          onFechar={onFechar}
          onConfirmar={onConfirmar}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Montado só enquanto o diálogo está aberto: os campos iniciam ao abrir e nenhuma atualização da ficha os apaga. */
function FormularioDuplicar({ prioridadeOrigem, erro, conflito, removido, enviando, onEnviando, onRecarregar, onFechar, onConfirmar }: Omit<Props, 'aberto'> & { removido?: boolean; enviando: boolean; onEnviando: (v: boolean) => void }) {
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [prioridade, setPrioridade] = useState(prioridadeOrigem);
  const [motivo, setMotivo] = useState('');
  return (
    <form
      className="grid gap-3 px-4 pb-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (enviando || removido) return;
        onEnviando(true);
        void onConfirmar({ vigenciaInicio: inicio, vigenciaFim: fim, prioridade, justificativa: limparJustificativa(motivo) })
          .finally(() => onEnviando(false));
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
      {removido && <p role="alert" className="text-sm text-destructive">Este enquadramento foi removido por outro usuário. Não é possível duplicá-lo; feche o diálogo.</p>}
      {!removido && erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {conflito && !removido && onRecarregar && (
        <div>
          <Button type="button" variant="secondary" disabled={enviando} onClick={() => void onRecarregar()}>Recarregar dados</Button>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={enviando} onClick={onFechar}>Cancelar</Button>
        <Button type="submit" disabled={enviando || removido}>Duplicar</Button>
      </div>
    </form>
  );
}
